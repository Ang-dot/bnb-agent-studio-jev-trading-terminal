import { gzipSync, gunzipSync } from 'node:zlib';
import type { AgentState } from '../src/types.js';

// Preserve compatibility with versioned cloud rows and local JSON.
export function encodeState(state: AgentState): string {
  const raw = JSON.stringify(state);
  if (Buffer.byteLength(raw) > 64 * 1024 * 1024) throw new Error('Journal storage capacity reached');
  const encoded = 'gzip-v1:' + gzipSync(raw).toString('base64');
  if (Buffer.byteLength(encoded) > 5 * 1024 * 1024) throw new Error('Journal storage capacity reached');
  return encoded;
}

export function decodeState(data: string): AgentState {
  return JSON.parse(data.startsWith('gzip-v1:')
    ? gunzipSync(Buffer.from(data.slice(8), 'base64'), { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8')
    : data);
}
