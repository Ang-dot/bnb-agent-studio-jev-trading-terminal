// Offline conversion only. Usage: node build-cortex.mjs /path/to/pial_Full_obj
// Source meshes: Anderson Winkler, Brainder. CC BY-SA 3.0. See NOTICE.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Provide the extracted Brainder pial_Full_obj directory.');
const parts = ['lh', 'rh'].map(hemisphere => {
  const vertices = [], faces = [];
  for (const line of readFileSync(join(source, `${hemisphere}.pial.obj`), 'utf8').split('\n')) {
    if (line.startsWith('v ')) vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if (line.startsWith('f ')) faces.push(line.slice(2).trim().split(/\s+/).map(v => Number(v.split('/')[0]) - 1));
  }
  // Vertex clustering reduces transfer/paint cost while retaining the cortical folds.
  const clusters = new Map(), sums = [], count = [], remap = [];
  for (const vertex of vertices) {
    const key = vertex.map(n => Math.round(n / 1.55)).join(',');
    let index = clusters.get(key);
    if (index === undefined) { index = sums.length; clusters.set(key, index); sums.push([0, 0, 0]); count.push(0); }
    vertex.forEach((n, axis) => { sums[index][axis] += n; });
    count[index]++; remap.push(index);
  }
  const positions = sums.flatMap((sum, index) => sum.map(n => n / count[index]));
  const indices = [], seen = new Set();
  for (const face of faces) {
    const ids = face.map(i => remap[i]);
    if (new Set(ids).size < 3) continue;
    const key = [...ids].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key); indices.push(...ids);
  }
  console.log(hemisphere, sums.length, 'vertices,', indices.length / 3, 'triangles');
  return { positions, indices };
});

const all = parts.flatMap(part => part.positions);
const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
all.forEach((n, i) => { const axis = i % 3; minimum[axis] = Math.min(minimum[axis], n); maximum[axis] = Math.max(maximum[axis], n); });
const center = minimum.map((n, i) => (n + maximum[i]) / 2);
const scale = 2.55 / (maximum[0] - minimum[0]);
const buffers = [Buffer.from('LBC2')];
for (const part of parts) {
  const header = Buffer.alloc(8); header.writeUInt32LE(part.positions.length / 3, 0); header.writeUInt32LE(part.indices.length, 4);
  if (part.positions.length / 3 > 65_535) throw new Error('Hemisphere exceeds the 16-bit index budget.');
  const positions = new Int16Array(part.positions.length);
  const quantize = value => Math.round(value / 4 * 32767);
  for (let i = 0; i < part.positions.length; i += 3) {
    positions[i] = quantize((part.positions[i] - center[0]) * scale);
    positions[i + 1] = quantize((part.positions[i + 2] - center[2]) * scale);
    positions[i + 2] = quantize((part.positions[i + 1] - center[1]) * scale);
  }
  // RAS → display coordinates swaps axes; reverse triangle winding to preserve normals.
  const indices = new Uint16Array(part.indices);
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  buffers.push(header, Buffer.from(positions.buffer), Buffer.from(indices.buffer));
}
writeFileSync(fileURLToPath(new URL('./cortex.bin', import.meta.url)), Buffer.concat(buffers));
