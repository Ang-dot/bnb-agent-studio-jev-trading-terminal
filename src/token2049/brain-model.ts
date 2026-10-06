import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { MemoryNode } from './cases.js';

/** The compact asset contains left and right cortical surfaces; no executable data. */
export function decodeCortex(buffer: ArrayBuffer): BufferGeometry[] {
  const bytes = new Uint8Array(buffer);
  if (buffer.byteLength < 20 || String.fromCharCode(...bytes.slice(0, 4)) !== 'LBC2') throw new Error('Invalid cortical mesh.');
  const view = new DataView(buffer), geometries: BufferGeometry[] = [];
  let offset = 4;
  try {
    for (let hemisphere = 0; hemisphere < 2; hemisphere++) {
      const vertexCount = view.getUint32(offset, true), indexCount = view.getUint32(offset + 4, true);
      offset += 8;
      if (!vertexCount || vertexCount > 65_535 || !indexCount || indexCount % 3 || indexCount > 1_200_000) throw new Error('Invalid cortical mesh counts.');
      const quantized = new Int16Array(buffer.slice(offset, offset + vertexCount * 6));
      const positions = Float32Array.from(quantized, value => value / 32767 * 4);
      offset += vertexCount * 6;
      const indices = new Uint16Array(buffer.slice(offset, offset + indexCount * 2));
      offset += indexCount * 2;
      if (offset > buffer.byteLength || positions.some(n => !Number.isFinite(n)) || indices.some(n => n >= vertexCount)) throw new Error('Invalid cortical mesh coordinates.');
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      geometries.push(geometry);
    }
    if (offset !== buffer.byteLength) throw new Error('Unexpected cortical mesh data.');
    return geometries;
  } catch (error) { geometries.forEach(geometry => geometry.dispose()); throw error; }
}

/** These positions communicate memory relationships, not neuroanatomical function. */
export function memoryAnchor(node: Pick<MemoryNode, 'x' | 'y'>): Vector3 {
  const x = (Math.min(100, Math.max(0, node.x)) - 50) / 50 * 1.6;
  const y = (50 - Math.min(100, Math.max(0, node.y))) / 50 * 1.62;
  const z = 0.52 + Math.sqrt(Math.max(0.05, 1 - (x / 1.8) ** 2 - (y / 1.8) ** 2)) * 0.94;
  return new Vector3(x, y, z);
}

/** A future/missing id breaks a path: it must never create a shortcut between visible nodes. */
export function visibleMemoryLinks(nodes: MemoryNode[], activeIds: string[]): [MemoryNode, MemoryNode][] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  return activeIds.slice(0, -1).flatMap((id, index) => {
    const source = byId.get(id), target = byId.get(activeIds[index + 1]);
    return source && target && source.id !== target.id ? [[source, target] as [MemoryNode, MemoryNode]] : [];
  });
}

type LabelAnchor = { id: string; x: number; y: number; width: number; height: number };
/** Labels may move for legibility; their 3D anchor dots never do. */
export function placeMemoryLabels(anchors: LabelAnchor[], width: number, height: number) {
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  const result = new Map<string, { x: number; y: number }>();
  for (const anchor of [...anchors].sort((a, b) => a.y - b.y)) {
    const positions = [
      [anchor.x - anchor.width / 2, anchor.y + 14], [anchor.x - anchor.width / 2, anchor.y - anchor.height - 14],
      [anchor.x + 15, anchor.y - anchor.height / 2], [anchor.x - anchor.width - 15, anchor.y - anchor.height / 2],
      [anchor.x - anchor.width / 2, anchor.y + 18 + anchor.height], [anchor.x - anchor.width / 2, anchor.y - anchor.height * 2 - 18],
    ];
    const candidates = positions.map(([x, y], index) => {
      const box = { x: Math.max(4, Math.min(width - anchor.width - 4, x)), y: Math.max(8, Math.min(height - 47 - anchor.height, y)), width: anchor.width, height: anchor.height };
      const overlap = placed.reduce((sum, other) => sum + Math.max(0, Math.min(box.x + box.width + 4, other.x + other.width + 4) - Math.max(box.x, other.x)) * Math.max(0, Math.min(box.y + box.height + 4, other.y + other.height + 4) - Math.max(box.y, other.y)), 0);
      return { box, score: overlap * 1000 + index };
    }).sort((a, b) => a.score - b.score);
    const box = candidates[0].box; placed.push(box); result.set(anchor.id, { x: box.x, y: box.y });
  }
  return result;
}
