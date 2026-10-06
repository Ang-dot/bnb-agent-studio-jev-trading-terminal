import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeCortex, memoryAnchor, placeMemoryLabels, visibleMemoryLinks } from './brain-model.js';
import type { MemoryNode } from './cases.js';

const node = (id: string, x = 50, y = 50): MemoryNode => ({ id, x, y, label: id, summary: '', sourceIds: [], type: 'decision' });

describe('3D memory evidence boundaries', () => {
  it('never draws a future node or bridges across a missing future node', () => {
    const a = node('past'), b = node('present');
    expect(visibleMemoryLinks([a, b], ['past', 'future', 'present'])).toEqual([]);
    expect(visibleMemoryLinks([a, b], ['past', 'present', 'future'])).toEqual([[a, b]]);
  });

  it('places memory anchors in actual depth while keeping extreme fixture positions finite', () => {
    const center = memoryAnchor(node('center')), edge = memoryAnchor(node('edge', 100, 0));
    expect(center.z).toBeGreaterThan(edge.z);
    expect(memoryAnchor(node('outside', -500, 800)).toArray().every(Number.isFinite)).toBe(true);
  });

  it('keeps neighboring bottom labels apart and clear of the attribution footer', () => {
    const anchors = [{ id: 'a', x: 130, y: 280, width: 150, height: 21 }, { id: 'b', x: 230, y: 278, width: 155, height: 21 }];
    const result = placeMemoryLabels(anchors, 360, 360), a = result.get('a')!, b = result.get('b')!;
    expect(a.y + 21).toBeLessThanOrEqual(313); expect(b.y + 21).toBeLessThanOrEqual(313);
    expect(a.x + 150 <= b.x || b.x + 155 <= a.x || a.y + 21 <= b.y || b.y + 21 <= a.y).toBe(true);
    expect(anchors[0].x).toBe(130); expect(anchors[0].y).toBe(280);
  });
});

describe('bundled anatomical geometry', () => {
  it('loads two distinct, non-flat indexed cortical hemispheres with complete normals', () => {
    const file = readFileSync(new URL('./brain-assets/cortex.bin', import.meta.url));
    const geometries = decodeCortex(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect(geometries).toHaveLength(2);
    for (const geometry of geometries) {
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      expect(bounds.max.z - bounds.min.z).toBeGreaterThan(2);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1);
      expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
      expect(geometry.getIndex()!.count).toBeGreaterThan(30_000);
      geometry.dispose();
    }
  });

  it('rejects malformed or truncated geometry for the fallback path', () => {
    expect(() => decodeCortex(new ArrayBuffer(8))).toThrow();
    const file = readFileSync(new URL('./brain-assets/cortex.bin', import.meta.url));
    expect(() => decodeCortex(file.buffer.slice(file.byteOffset, file.byteOffset + 64))).toThrow();
  });
});
