import type { Memory } from './types.js';

export function memorySearchLabel(memory:Memory) {
  if(memory.provider==='mem9')return memory.searchScore===undefined
    ? 'Search relevance not provided'
    : `Search relevance ${memory.searchScore.toPrecision(3)} · not outcome confidence`;
  return memory.similarity===null?'Search similarity not provided'
    : `Search similarity ${(memory.similarity*100).toFixed(1)}% · not outcome confidence`;
}
