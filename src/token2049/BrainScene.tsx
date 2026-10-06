import { useEffect, useRef, useState } from 'react';
import type { MemoryNode, ReplayStep } from './cases.js';
import type { BrainRenderer, BrainState } from './brain-renderer.js';
import { cn } from './lib/utils.js';
import './brain-3d.css';

type BrainSceneProps = { nodes: MemoryNode[]; step: ReplayStep; enabled?: boolean; onSelect: (node: MemoryNode) => void; expanded?: boolean };

export function BrainScene({ nodes, step, enabled = true, onSelect, expanded = false }: BrainSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()), renderer = useRef<BrainRenderer | undefined>(undefined);
  const data = useRef<BrainState>({ nodes, activeIds: step.activeNodes, enabled });
  data.current = { nodes, activeIds: step.activeNodes, enabled };
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    let disposed = false;
    void import('./brain-renderer.js').then(({ createBrainRenderer }) => {
      if (disposed || !canvas.current || !stage.current) return;
      renderer.current = createBrainRenderer({
        canvas: canvas.current, container: stage.current, getButton: id => buttons.current.get(id),
        onStatus: next => { if (!disposed) setStatus(next); },
      }, data.current);
    }).catch(() => { if (!disposed) setStatus('fallback'); });
    return () => { disposed = true; renderer.current?.dispose(); renderer.current = undefined; };
  }, []);

  useEffect(() => {
    renderer.current?.update(data.current);
    if (status !== 'ready') for (const node of nodes) {
      const button = buttons.current.get(node.id);
      if (button) {
        button.style.left = `${node.x}%`; button.style.top = `${node.y}%`;
        const label = button.querySelector<HTMLElement>('.lb-node-label'); if (label) label.style.transform = '';
      }
    }
  }, [nodes, step.activeNodes, enabled, status]);

  const fallbackPaths = step.activeNodes.slice(0, -1).flatMap((id, index) => {
    const from = nodes.find(node => node.id === id), to = nodes.find(node => node.id === step.activeNodes[index + 1]);
    return from && to ? [{ from, to }] : [];
  });

  return <div className={cn('lb-brain-scene lb-brain-3d', !enabled && 'is-muted', expanded && 'is-expanded', `is-${status}`)} ref={stage} role="group" aria-label="Conceptual 3D memory brain. Select a memory to inspect its evidence.">
    <div className="lb-brain-aura" aria-hidden="true"/>
    <img src="/assets/living-brain-neural.png" alt="" className="lb-brain-art lb-brain-fallback" draggable={false}/>
    <canvas ref={canvas} aria-hidden="true" className="lb-brain-webgl"/>
    {status !== 'ready' && enabled && <svg className="lb-brain-fallback-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {fallbackPaths.map(({ from, to }) => <path key={`${from.id}-${to.id}`} d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 8} ${to.x} ${to.y}`}/>)}
    </svg>}
    {enabled && nodes.map(node => <button
      key={node.id}
      ref={element => { if (element) buttons.current.set(node.id, element); else buttons.current.delete(node.id); }}
      className={cn('lb-memory-node', step.activeNodes.includes(node.id) && 'is-active')}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      onClick={() => onSelect(node)} aria-label={`Inspect memory: ${node.label}`}>
      <span className="lb-node-dot"/><span className="lb-node-label">{node.label}</span>
    </button>)}
    {!enabled && <div className="lb-brain-disabled"><strong>Current evidence only</strong><span>Living Brain context is excluded<br/>from this comparison.</span></div>}
    <div className="lb-brain-scene-meta">
      <span>{status === 'ready' ? '3D conceptual memory' : status === 'fallback' ? 'Static fallback · 3D unavailable' : 'Preparing 3D memory'}</span>
      {status === 'ready' && <span className="lb-brain-motion-hint">Move cursor to explore</span>}
    </div>
    {status === 'ready' && <a className="lb-brain-mesh-credit" href="https://brainder.org/research/brain-for-blender/" target="_blank" rel="noreferrer" aria-label="Adapted cortical mesh by Anderson Winkler, Brainder, licensed CC BY-SA 3.0">Adapted mesh: A. Winkler · CC BY-SA 3.0</a>}
  </div>;
}
