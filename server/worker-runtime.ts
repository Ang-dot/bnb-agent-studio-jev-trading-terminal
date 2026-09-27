import type { FrontendEdition } from '../src/frontend-route.js';

export function configuredWorkerEditions(value = 'kbw,token2049'): Set<FrontendEdition> {
  const editions=value.split(',').map(edition=>edition.trim());
  if(!editions.length||editions.some(edition=>edition!=='kbw'&&edition!=='token2049'))
    throw new Error('WORKER_EDITIONS must contain kbw and/or token2049');
  return new Set(editions as FrontendEdition[]);
}

export class WorkerRuntime {
  active=false;
  private closing=false;
  private jobs=new Set<Promise<unknown>>();
  constructor(private guard:()=>Promise<void>=async()=>{}){}
  enable(){if(!this.closing)this.active=true;}
  async assertActive(){
    if(!this.active||this.closing)throw new Error('Worker unavailable');
    try {await this.guard();} catch(e){this.active=false;throw e;}
    if(!this.active||this.closing)throw new Error('Worker unavailable');
  }
  run(work:()=>Promise<unknown>):Promise<void>{
    if(!this.active||this.closing)return Promise.resolve();
    const job=this.assertActive().then(()=>work()).then(()=>{},()=>{}).finally(()=>this.jobs.delete(job));
    this.jobs.add(job);return job;
  }
  async drain(){this.closing=true;this.active=false;await Promise.allSettled([...this.jobs]);}
}
