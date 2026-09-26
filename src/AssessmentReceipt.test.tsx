import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentReceiptView } from './AssessmentReceipt.js';
import type { Decision } from './types.js';

const decision:Decision = {id:'decision',time:5000,pool:'0x'+'1'.repeat(40),name:'TEST',memoryStatus:'Cold start',status:'held',action:'hold',memories:[],reasons:[],checks:[],
  assessmentReceipt:{service:'BNB Agent Studio',runtimeVersion:'0.0.14',serviceVersion:'1.0.0',transport:'private-http',requestId:'request-123',outcome:'completed',startedAt:1000,completedAt:5000,durationMs:4000,
    stages:[{name:'JEV',startedAt:4500,durationMs:500,status:'completed'}]},
};
describe('Studio assessment receipt',()=>{
  it('separates JEV API latency, pipeline time and memory write status',()=>{
    const html=renderToStaticMarkup(<AssessmentReceiptView decision={decision} />);
    expect(html).toContain('BNB Agent Studio');expect(html).toContain('request-123');
    expect(html).toContain('JEV API round-trip');expect(html).toContain('500 ms');
    expect(html).toContain('4.00 s');expect(html).toContain('No linked memory episode');
    expect(html).not.toContain('inference time');expect(html).not.toContain('Memory improved');
  });
  it('does not fabricate receipts for historical decisions or code exits',()=>{
    expect(renderToStaticMarkup(<AssessmentReceiptView decision={{...decision,assessmentReceipt:undefined}} />)).toBe('');
  });
  it('distinguishes service delivery from a completed JEV assessment',()=>{
    const html=renderToStaticMarkup(<AssessmentReceiptView decision={{...decision,assessmentReceipt:{...decision.assessmentReceipt!,outcome:'skipped',stages:[{name:'Living Brain',startedAt:1200,durationMs:70,status:'failed'}]}}} />);
    expect(html).toContain('Assessment stopped');expect(html).toContain('Failed');expect(html).toContain('Not called');
  });
});
