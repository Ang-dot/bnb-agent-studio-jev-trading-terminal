import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryRecallPanel } from './MemoryRecallPanel.js';
import type { Decision, Memory } from './types.js';

const memories:Memory[]=[
  {pageId:'outcome',slug:'outcome',title:'Measured follow-up',summary:'Outcome details',preview:'Thirty minute follow-up',
    outcome:'30m observed gross price change -12.4%',recordedAt:1790762400000,episodeKind:'outcome',
    similarity:null,provider:'mem9',status:'active'},
  {pageId:'observation',slug:'observation',title:'Earlier observation',summary:'Observation details',preview:'No decision recorded',
    recordedAt:1790762400000,episodeKind:'observation',similarity:null,provider:'mem9',status:'active'},
];

describe('retrieved memory panel',()=>{
  it('shows every result, measured outcome, and individual relevance without implying all were useful',()=>{
    const record={memories,memoryStatus:'2 active memories retrieved from MEM9',judgment:{
      assessments:[
        {id:'memory_alignment',valueLabel:'Mixed or unclear'},
        {id:'memory_1',kind:'memory',referenceId:'outcome',valueLabel:'Relevant caution'},
        {id:'memory_2',kind:'memory',referenceId:'observation',valueLabel:'Not relevant'},
      ],
    }} as unknown as Decision;
    const html=renderToStaticMarkup(<MemoryRecallPanel memoryName="MEM9" record={record} emptyTitle="No matches"
      onMemory={()=>{}} onEvidence={()=>{}}/>);
    expect(html).toContain('Measured follow-up');
    expect(html).toContain('Earlier observation');
    expect(html).toContain('30m observed gross price change -12.4%');
    expect(html).toContain('Relevant caution');
    expect(html).toContain('Not relevant');
    expect(html).toContain('Mixed or unclear');
  });
});
