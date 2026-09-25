import { it, expect } from 'vitest';
import { WorkerRuntime } from './worker-runtime.js';
it('does not do work while disabled or after draining starts',async()=>{
  let calls=0;
  const worker=new WorkerRuntime();
  await worker.run(async()=>{calls++;});expect(calls).toBe(0);
  worker.enable();await worker.run(async()=>{calls++;});expect(calls).toBe(1);
  await worker.drain();await worker.run(async()=>{calls++;});expect(calls).toBe(1);
});
it('waits for in-flight jobs and fails closed when a lease guard fails',async()=>{
  let finish!:()=>void,drained=false;
  const worker=new WorkerRuntime();worker.enable();
  let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const job=worker.run(()=>new Promise<void>(r=>{finish=r;began();}));
  await started;
  const draining=worker.drain().then(()=>{drained=true;});
  expect(drained).toBe(false);finish();await job;await draining;expect(drained).toBe(true);
  const fenced=new WorkerRuntime(async()=>{throw new Error('Lease lost');});fenced.enable();
  let called=false;await fenced.run(async()=>{called=true;});expect(called).toBe(false);expect(fenced.active).toBe(false);
});
