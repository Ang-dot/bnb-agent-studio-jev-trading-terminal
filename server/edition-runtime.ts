import { createAssessmentWork } from '../app/agent/src/work.js';
import { startAssessmentService } from '../app/agent/src/service.js';
import type { FrontendEdition } from '../src/frontend-route.js';
import type { SupportingEvidence } from '../src/enrichment.js';
import type { Store } from './store.js';
import type { Providers } from './providers.js';
import type { LaunchFeed } from './launch-feed.js';
import type { GraduationVerifier } from './graduation.js';
import type { WorkerRuntime } from './worker-runtime.js';
import type { JsonPersistence } from './cloud-store.js';
import { Engine } from './engine.js';
import { MemoryLoop } from './memory-loop.js';
import { MonitorService } from './monitor.js';

export async function createEditionRuntime(options:{
  edition:FrontendEdition;store:Store;providers:Providers;worker:WorkerRuntime;
  launches:LaunchFeed;graduations:GraduationVerifier;
  evidence:(token:string,at:number)=>Promise<SupportingEvidence|undefined>;
  refreshEvidence:(token:string)=>Promise<unknown>;
  replayBusy:()=>boolean;
  monitorRecord:string|JsonPersistence;
  reserveAssessment:()=>boolean;
}) {
  const {edition,store,providers,worker,launches,graduations}=options;
  const learning=new MemoryLoop(store,providers);
  const studio=await startAssessmentService({work:createAssessmentWork({
    providers,store,evidence:options.evidence,annotate:(memories,at)=>learning.annotate(memories,at),
  })});
  const engine=new Engine(store,providers,{assess:async(...args)=>{
    if(!options.reserveAssessment())throw new Error('Shared assessment budget exhausted');
    return studio.runner.assess(...args);
  }},learning);
  const monitor=await new MonitorService({
    memoryProvider:providers.memoryProvider,
    feed:()=>launches.state,activity:()=>launches.activity(),verify:launch=>graduations.verify(launch,true),
    available:async()=>worker.active&&!engine.busy&&!(await store.read()).halted&&!options.replayBusy()&&
      providers.statuses.get(providers.memoryProvider)?.state!=='missing',
    assess:async(launch,verification,context,active)=>{
      void worker.run(()=>options.refreshEvidence(launch.address));
      const pool=await providers.pool(verification.pool!,launch.address);
      if(pool.token.toLowerCase()!==launch.address||!active())throw new Error('Monitoring evidence unavailable');
      if(!engine.pools.some(p=>p.address===pool.address))engine.pools.push(pool);
      await learning.observe(pool,context).catch(()=>{});
      return (await engine.cycle(pool.address,{context,active,paper:true}))[0];
    },
  },options.monitorRecord).init();
  return {edition,store,providers,learning,studio,engine,monitor};
}
export type EditionRuntime=Awaited<ReturnType<typeof createEditionRuntime>>;

// Legacy clients stay on TOKEN2049. Explicit edition prefixes are consumed
// only here, after the same origin/operator authentication as existing routes.
export function editionApiRoute(url:string):{edition:FrontendEdition;url:string} {
  const match=url.match(/^\/api\/(kbw|token2049)(?=\/|\?|$)/);
  return match?{edition:match[1] as FrontendEdition,url:'/api'+url.slice(match[0].length)}:{edition:'token2049',url};
}
