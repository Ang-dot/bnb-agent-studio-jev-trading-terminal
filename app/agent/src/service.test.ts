import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { B402Seller } from '@bnbagent/studio-runtime/b402';
import { startAssessmentService } from './service.js';
import type { AssessmentWork } from './work.js';
import type { Pool } from '../../../src/types.js';

const token = 'test-only-private-service-token-'.repeat(2);
const pool = {address:'0x'+'1'.repeat(40),token:'0x'+'2'.repeat(40),name:'TEST'} as Pool;
const guard = {assertActive:async()=>{}};
const stops: (()=>Promise<void>)[] = [];
const deferred = () => { let resolve!:()=>void; const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve}; };
afterEach(async()=>{for(const stop of stops.splice(0)) await stop();vi.restoreAllMocks();});
function fixtureWork(): AssessmentWork {
  return vi.fn(async job => ({
    outcome:'skipped' as const, startedAt:Date.now(),completedAt:Date.now(),durationMs:1,stages:[],
    decision:{id:job.requestId,time:Date.now(),pool:job.pool.address,name:job.pool.name,action:'hold' as const,status:'not_evaluated' as const,reasons:['Fixture only'],memories:[],memoryStatus:'Not queried',checks:[]},
  }));
}
describe('private Studio HTTP assessment boundary',()=>{
  it('uses the real Studio work handler and returns a correlated receipt',async()=>{
    const handle=vi.spyOn(B402Seller.prototype,'handle');
    const work=fixtureWork();
    const service=await startAssessmentService({work,authToken:token});stops.push(service.close);
    const result=await service.runner.assess(pool,undefined,guard);
    expect(handle).toHaveBeenCalledOnce();expect(work).toHaveBeenCalledOnce();
    expect(result.decision.assessmentReceipt).toMatchObject({service:'BNB Agent Studio',runtimeVersion:'0.0.14',transport:'private-http',outcome:'skipped',requestId:result.decision.id});
    expect(service.info()).toMatchObject({state:'ready',visibility:'backend-only',payments:false});
  });
  it('rejects unauthenticated, browser-origin and unadmitted requests before work',async()=>{
    const work=fixtureWork();const service=await startAssessmentService({work,authToken:token});stops.push(service.close);
    const body=JSON.stringify({prompt:JSON.stringify({requestId:randomUUID()})});
    const request=(headers:Record<string,string>)=>fetch(service.endpoint,{method:'POST',headers:{'content-type':'application/json',...headers},body});
    expect((await request({})).status).toBe(403);
    expect((await request({authorization:`Bearer ${token}`,origin:'https://attacker.invalid'})).status).toBe(403);
    expect((await request({authorization:`Bearer ${token}`})).status).toBe(409);
    expect(work).not.toHaveBeenCalled();
  });
  it('refuses a replay of the exact HTTP request',async()=>{
    const work=fixtureWork();let duplicateStatus=0;
    const service=await startAssessmentService({work,authToken:token,fetchImpl:async(input,init)=>{
      const response=await fetch(input,init);duplicateStatus=(await fetch(input,init)).status;return response;
    }});stops.push(service.close);
    await service.runner.assess(pool,undefined,guard);
    expect(duplicateStatus).toBe(409);expect(work).toHaveBeenCalledOnce();
  });
  it('rejects altered responses and never retries the work',async()=>{
    const work=fixtureWork();const service=await startAssessmentService({work,authToken:token,fetchImpl:async(input,init)=>{
      const r=await fetch(input,init);const body=await r.json() as {result:string};
      return Response.json({result:body.result.replace('Fixture only','Tampered output')});
    }});stops.push(service.close);
    await expect(service.runner.assess(pool,undefined,guard)).rejects.toThrow('Agent Studio');
    expect(work).toHaveBeenCalledOnce();
  });
  it('fails closed after the listener is stopped',async()=>{
    const work=fixtureWork();const service=await startAssessmentService({work,authToken:token});
    await service.close();await expect(service.runner.assess(pool,undefined,guard)).rejects.toThrow('Agent Studio');
    expect(work).not.toHaveBeenCalled();
  });
  it('paces skipped request envelopes for one minute without an hourly lockout',async()=>{
    let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
    const work=fixtureWork();const service=await startAssessmentService({work,authToken:token,maxPerMinute:1});stops.push(service.close);
    await service.runner.assess(pool,undefined,guard);
    await expect(service.runner.assess(pool,undefined,guard)).rejects.toThrow('Agent Studio');
    expect(work).toHaveBeenCalledOnce();
    now+=60000;
    await service.runner.assess(pool,undefined,guard);
    expect(work).toHaveBeenCalledTimes(2);
  });
  it('does not run a second job concurrently or continue after cancellation',async()=>{
    const entered=deferred(),release=deferred();
    const nextStage=vi.fn();
    const work:AssessmentWork=async(job,guard)=>{
      entered.resolve();await release.promise;await guard.assertActive();nextStage();
      return fixtureWork()(job,guard);
    };
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const service=await startAssessmentService({work,authToken:token,timeoutMs:40});stops.push(service.close);
    const first=service.runner.assess(pool,undefined,guard);
    const rejected=expect(first).rejects.toThrow('Agent Studio');
    await entered.promise;
    await expect(service.runner.assess(pool,undefined,guard)).rejects.toThrow('Agent Studio');
    await rejected;release.resolve();
    await service.close();expect(nextStage).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain(token);
  });
});
