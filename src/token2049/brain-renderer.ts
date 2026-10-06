import * as THREE from 'three';
import type { MemoryNode } from './cases.js';
import { decodeCortex, memoryAnchor, placeMemoryLabels, visibleMemoryLinks } from './brain-model.js';

export type BrainState = { nodes: MemoryNode[]; activeIds: string[]; enabled: boolean };
export type BrainRenderer = { update: (state: BrainState) => void; dispose: () => void };
type Options = {
  canvas: HTMLCanvasElement; container: HTMLDivElement;
  getButton: (id: string) => HTMLButtonElement | undefined;
  onStatus: (status: 'ready' | 'fallback') => void;
};

let asset: Promise<ArrayBuffer> | undefined;
function loadCortex() {
  asset ??= fetch(new URL('./brain-assets/cortex.bin', import.meta.url).href).then(response => {
    if (!response.ok) throw new Error('Cortical mesh unavailable.');
    return response.arrayBuffer();
  }).catch(error => { asset = undefined; throw error; });
  return asset;
}

function disposeGroup(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    }
  });
  group.clear();
}

export function createBrainRenderer({ canvas, container, getButton, onStatus }: Options, initial: BrainState): BrainRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
  camera.position.set(0, 0.07, 4.95); camera.lookAt(0, 0, 0);
  const brain = new THREE.Group(), cortex = new THREE.Group(), graph = new THREE.Group();
  brain.add(cortex, graph); brain.position.y = 0.28; scene.add(brain);
  const ambient = new THREE.HemisphereLight(0xe6f7ff, 0x473d7e, 1.45); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xe7eaff, 2.2); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5bcafa, 3.2); rim.position.set(4, 1, -2); scene.add(rim);
  const warm = new THREE.PointLight(0xffd66e, 0.7, 8); warm.position.set(1, -1, 3); scene.add(warm);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches, visible = true, disposed = false, loaded = false, failed = false;
  let state = initial, frame = 0, last = 0, width = 1, height = 1;
  let pointerX = 0, pointerY = 0, rotationX = 0.24, rotationY = -0.23;
  const pulses: { curve: THREE.CatmullRomCurve3; object: THREE.Mesh; offset: number }[] = [];
  const glows: THREE.Mesh[] = [];
  const projected = new THREE.Vector3();
  const cortexMaterials: THREE.MeshStandardMaterial[] = [];
  let particleMaterial: THREE.ShaderMaterial | undefined;
  let fiberMaterial: THREE.LineBasicMaterial | undefined;
  const labelSizes = new Map<string, { width: number; height: number }>();
  const measureLabels = () => state.nodes.forEach(node => {
    const label = getButton(node.id)?.querySelector<HTMLElement>('.lb-node-label');
    if (label) labelSizes.set(node.id, { width: label.offsetWidth, height: label.offsetHeight });
  });

  const draw = (time = 0) => {
    if (disposed || failed || !loaded) return;
    const seconds = time / 1000;
    const targetX = 0.24 + (reduced ? 0 : pointerY * 0.19);
    const targetY = -0.23 + (reduced ? 0 : pointerX * 0.36);
    rotationX += (targetX - rotationX) * (reduced ? 1 : 0.075);
    rotationY += (targetY - rotationY) * (reduced ? 1 : 0.075);
    brain.rotation.set(rotationX, rotationY, 0.025);
    brain.scale.setScalar(reduced || !state.enabled ? 1 : 1 + Math.sin(seconds * 0.9) * 0.004);
    brain.updateMatrixWorld(true);
    const labelAnchors: { id: string; x: number; y: number; width: number; height: number }[] = [];
    for (const node of state.nodes) {
      const button = getButton(node.id); if (!button) continue;
      projected.copy(memoryAnchor(node)).applyMatrix4(brain.matrixWorld).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width, y = (-projected.y * 0.5 + 0.5) * height;
      button.style.left = `${x}px`; button.style.top = `${y}px`;
      button.style.setProperty('--node-depth', `${0.88 + (1 - projected.z) * 0.9}`);
      labelAnchors.push({ id: node.id, x, y, ...(labelSizes.get(node.id) ?? { width: 100, height: 20 }) });
    }
    const labels = placeMemoryLabels(labelAnchors, width, height);
    labelAnchors.forEach(anchor => {
      const label = getButton(anchor.id)?.querySelector<HTMLElement>('.lb-node-label'), position = labels.get(anchor.id);
      if (label && position) label.style.transform = `translate(${position.x - anchor.x}px,${position.y - anchor.y}px)`;
    });
    if (particleMaterial) particleMaterial.uniforms.time.value = reduced ? 0 : seconds;
    pulses.forEach(({ curve, object, offset }) => {
      object.position.copy(curve.getPoint((reduced ? offset : seconds * 0.14 + offset) % 1));
    });
    glows.forEach((object, index) => object.scale.setScalar(reduced ? 1 : 1 + Math.sin(seconds * 2.1 + index) * 0.18));
    renderer.render(scene, camera);
  };
  const animate = (time: number) => {
    frame = 0;
    if (disposed || failed || reduced || !visible || document.hidden || !loaded || !state.enabled) return;
    // A small scene does not need the display's full refresh rate.
    if (time - last >= 1000 / 40) { draw(time); last = time; }
    frame = requestAnimationFrame(animate);
  };
  const refresh = () => {
    if (disposed || failed) return;
    draw(performance.now());
    if (!frame && !reduced && visible && !document.hidden && loaded && state.enabled) frame = requestAnimationFrame(animate);
  };

  const update = (next: BrainState) => {
    state = next; disposeGroup(graph); pulses.length = 0; glows.length = 0;
    cortexMaterials.forEach(material => { material.opacity = next.enabled ? 0.12 : 0.07; material.color.set(next.enabled ? 0xffffff : 0xb4bbca); });
    if (particleMaterial) particleMaterial.uniforms.opacity.value = next.enabled ? 1 : 0.08;
    if (fiberMaterial) fiberMaterial.opacity = next.enabled ? 0.46 : 0.04;
    measureLabels();
    if (next.enabled) {
      next.nodes.forEach(node => {
        const active = next.activeIds.includes(node.id);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(active ? 0.038 : 0.026, 12, 8), new THREE.MeshBasicMaterial({ color: active ? 0xffc72c : 0x7498e4, depthTest: false }));
        marker.position.copy(memoryAnchor(node)); marker.renderOrder = 12; graph.add(marker);
        if (active) {
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf0b90b, transparent: true, opacity: 0.16, depthWrite: false, depthTest: false }));
          glow.position.copy(marker.position); glow.renderOrder = 11; graph.add(glow); glows.push(glow);
        }
      });
      visibleMemoryLinks(next.nodes, next.activeIds).forEach(([from, to], index) => {
        const start = memoryAnchor(from), end = memoryAnchor(to), middle = start.clone().lerp(end, 0.5);
        middle.z += 0.28; middle.y += index % 2 ? -0.10 : 0.13;
        const curve = new THREE.CatmullRomCurve3([start, middle, end]);
        const link = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.0075, 6, false), new THREE.MeshBasicMaterial({ color: 0xe4a907, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
        link.renderOrder = 9; graph.add(link);
        const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.023, 5, false), new THREE.MeshBasicMaterial({ color: 0xffce48, transparent: true, opacity: 0.11, depthWrite: false, depthTest: false }));
        halo.renderOrder = 8; graph.add(halo);
        const signal = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 7), new THREE.MeshBasicMaterial({ color: 0xfff3b8, depthTest: false }));
        signal.renderOrder = 13; graph.add(signal); pulses.push({ curve, object: signal, offset: index * 0.22 });
      });
    }
    refresh();
  };

  const resize = () => {
    const bounds = container.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.position.z = camera.aspect < 0.8 ? 5.65 : 4.95;
    camera.updateProjectionMatrix(); measureLabels(); refresh();
  };
  const onPointer = (event: PointerEvent) => {
    if (reduced || !state.enabled || event.pointerType === 'touch') return;
    const bounds = container.getBoundingClientRect();
    pointerX = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    pointerY = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1); if (!frame) refresh();
  };
  const onLeave = () => { pointerX = 0; pointerY = 0; refresh(); };
  const onMotion = () => { reduced = media.matches; if (frame) cancelAnimationFrame(frame); frame = 0; refresh(); };
  const onVisibility = () => { if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; } else refresh(); };
  const onContextLost = (event: Event) => {
    event.preventDefault(); failed = true; if (frame) cancelAnimationFrame(frame); frame = 0; onStatus('fallback');
  };
  const observer = new ResizeObserver(resize); observer.observe(container);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; } else refresh();
  }); intersection.observe(container);
  container.addEventListener('pointermove', onPointer); container.addEventListener('pointerleave', onLeave);
  media.addEventListener('change', onMotion); document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  resize();

  void loadCortex().then(buffer => {
    if (disposed || failed) return;
    const geometries = decodeCortex(buffer);
    const points: number[] = [], connections: number[] = [];
    geometries.forEach((geometry, hemisphere) => {
      const attribute = geometry.getAttribute('position');
      const colors: number[] = [], violet = new THREE.Color(0x8d74c9), cyan = new THREE.Color(0x65b6d0);
      for (let index = 0; index < attribute.count; index++) {
        const blend = THREE.MathUtils.clamp((attribute.getX(index) + 1.3) / 2.6, 0, 1);
        const color = violet.clone().lerp(cyan, blend);
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0.08, transparent: true, depthWrite: false, opacity: 0.12, emissive: 0x5143a3, emissiveIntensity: 0.13 });
      cortexMaterials.push(material);
      const mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = hemisphere; cortex.add(mesh);
      for (let index = 0; index < attribute.count; index += 13) {
        const p = new THREE.Vector3().fromBufferAttribute(attribute, index).multiplyScalar(1.018);
        points.push(p.x, p.y, p.z);
        // Sparse decorative surface fibers. These are distinct from gold evidence paths.
        if (index % 26 === 0) {
          for (const offset of [7, 19]) {
            const next = new THREE.Vector3().fromBufferAttribute(attribute, Math.min(index + offset, attribute.count - 1)).multiplyScalar(1.025);
            if (p.distanceTo(next) < 0.40) connections.push(p.x, p.y, p.z, next.x, next.y, next.z);
          }
        }
      }
    });
    const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    particleMaterial = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 1 }, pixelRatio: { value: renderer.getPixelRatio() }, time: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: 'uniform float pixelRatio; uniform float time; varying float intensity; varying float hue; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; float wave=sin(position.y*3.2+position.x*1.7-time*.9); intensity=.45+.55*pow(max(0.,wave),5.); hue=clamp((position.x+1.3)/2.6,0.,1.); gl_PointSize=clamp((12.+intensity*11.)/-p.z,1.8,6.5)*pixelRatio; }',
      fragmentShader: 'uniform float opacity; varying float intensity; varying float hue; void main(){ float d=length(gl_PointCoord-vec2(.5)); if(d>.5) discard; float core=smoothstep(.23,.08,d); float halo=smoothstep(.5,.12,d)*.14; float a=(core+halo)*opacity*(.7+intensity*.3); vec3 c=mix(vec3(.39,.13,.82),vec3(.01,.59,.78),hue); c=mix(c,vec3(.24,.82,1.),intensity*.13); gl_FragColor=vec4(c,min(a,1.)); }',
    });
    const neurons = new THREE.Points(pointGeometry, particleMaterial); neurons.renderOrder = 4; cortex.add(neurons);
    const fiberGeometry = new THREE.BufferGeometry(); fiberGeometry.setAttribute('position', new THREE.Float32BufferAttribute(connections, 3));
    const fiberColors: number[] = [], violetFiber = new THREE.Color(0x7650ca), cyanFiber = new THREE.Color(0x079fbf);
    for (let i = 0; i < connections.length; i += 3) {
      const color = violetFiber.clone().lerp(cyanFiber, THREE.MathUtils.clamp((connections[i] + 1.3) / 2.6, 0, 1));
      fiberColors.push(color.r, color.g, color.b);
    }
    fiberGeometry.setAttribute('color', new THREE.Float32BufferAttribute(fiberColors, 3));
    fiberMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.46, depthWrite: false, depthTest: false, toneMapped: false });
    const fibers = new THREE.LineSegments(fiberGeometry, fiberMaterial);
    fibers.renderOrder = 3; cortex.add(fibers);
    loaded = true; update(state); onStatus('ready'); refresh();
  }).catch(() => { if (!disposed) { failed = true; onStatus('fallback'); } });

  return {
    update,
    dispose() {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      container.removeEventListener('pointermove', onPointer); container.removeEventListener('pointerleave', onLeave);
      media.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      disposeGroup(brain); renderer.dispose();
    },
  };
}
