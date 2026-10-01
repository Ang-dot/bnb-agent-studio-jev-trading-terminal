import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { MemoryJournal } from './MemoryJournal.js';
import type { MemoryEpisode } from './memory.js';
describe('memory lifecycle UI',()=>{
 it('shows confirmed processing separately from actual recall and never claims profit',()=>{
  const e:MemoryEpisode={id:'e',kind:'decision',token:'t',pool:'p',name:'Token',createdAt:1000,signature:'s',summary:'HOLD · no fill',content:{},followUps:[{minutes:5,dueAt:301000,status:'waiting'}],capture:{status:'completed',sourceId:'source',pageIds:['page'],attempts:1,nextAt:0},recalledBy:[]};
  const html=renderToStaticMarkup(<MemoryJournal view={{recent:[e],token:[e],counts:{saved:1,available:1,recalled:0}}} now={2000} onDecision={()=>{}}/>);
  expect(html).toContain('Experience ledger');expect(html).toContain('Compiled');expect(html).toContain('Not recalled yet');expect(html).toContain('HOLD · no fill');expect(html).toContain('5m outcome');
  expect(html).not.toContain('Memory improved');
 });
});
