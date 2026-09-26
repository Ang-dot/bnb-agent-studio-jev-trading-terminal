import express from 'express';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { B402Seller, B402SellerPolicy } from '@bnbagent/studio-runtime/b402';
import { loadStudioToml } from '@bnbagent/studio-runtime/config';
import type { AssessmentServiceInfo } from '../../../src/types.js';
import { withAssessmentSignal } from '../../../server/assessment-signal.js';
import { ASSESSMENT_SERVICE_VERSION, STUDIO_RUNTIME_VERSION, type AssessmentGuard, type AssessmentJob, type AssessmentResult, type AssessmentRunner } from './assessment.js';
import type { AssessmentWork } from './work.js';

const ticketSchema = z.object({requestId:z.string().uuid()}).strict();
const envelopeSchema = z.object({prompt:z.string().max(100)}).strict();
const digest = (text:string) => createHash('sha256').update(text).digest('hex');
const failure = () => new Error('Agent Studio assessment unavailable or invalid. No direct-model fallback.');
const eq = (a:string,b:string) => Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));

interface Ticket {
  job: AssessmentJob;
  guard: AssessmentGuard;
  controller: AbortController;
  claimed: boolean;
  running?: Promise<string>;
  responseDigest?: string;
}

// Custom self-hosted adapter of Studio's X402-only work-serving recipe.
// One process/container, separate authenticated loopback HTTP listener. Nothing
// below is mounted on the public app. Stock FREE mode is NOT access control.
export async function startAssessmentService(options: {
  work: AssessmentWork;
  authToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPerHour?: number;
}) {
  const cfg = loadStudioToml(fileURLToPath(new URL('../studio.toml',import.meta.url)));
  const policy = B402SellerPolicy.fromToml(cfg);
  // Changing pricing cannot silently enable payments, signing or facilitator I/O.
  if (!policy.enabled || policy.priceUsd !== '0' || policy.workTimeoutSeconds !== 150 ||
      JSON.stringify((cfg.stack as {protocols?:unknown})?.protocols) !== '["X402"]') throw failure();
  const secret = options.authToken ?? randomBytes(32).toString('hex');
  if (secret.length < 32) throw failure();
  const tickets = new Map<string,Ticket>();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 140000;
  let closed = false, attempts:number[] = [], completedRequests = 0, lastCompletedAt:number|undefined;
  const seller = await B402Seller.create({
    cfg, networkName:'bsc-mainnet',
    // Required address-shaped argument, UNUSED in FREE mode. No wallet is
    // created, read, funded or unlocked; this is not an agent identity.
    walletAddress:'0x0000000000000000000000000000000000000000',
    resourceUrl:'http://127.0.0.1/x402', env:{},
    runWork: async ({prompt}) => {
      const {requestId} = ticketSchema.parse(JSON.parse(prompt));
      const ticket = tickets.get(requestId);
      if (!ticket?.claimed || ticket.running) throw failure();
      const running = withAssessmentSignal(ticket.controller.signal,async()=>{
        const work = await options.work(ticket.job, {assertActive:async()=>{
          ticket.controller.signal.throwIfAborted();
          await ticket.guard.assertActive();
          ticket.controller.signal.throwIfAborted();
        }});
        ticket.controller.signal.throwIfAborted();
        const result: AssessmentResult = {outcome:work.outcome,decision:{...work.decision,assessmentReceipt:{
          service:'BNB Agent Studio',runtimeVersion:STUDIO_RUNTIME_VERSION,serviceVersion:ASSESSMENT_SERVICE_VERSION,
          transport:'private-http',requestId,outcome:work.outcome,startedAt:work.startedAt,completedAt:work.completedAt,
          durationMs:work.durationMs,stages:work.stages,
        }}};
        const serialized = JSON.stringify(result);
        if (Buffer.byteLength(serialized)>2*1024*1024) throw failure();
        ticket.responseDigest = digest(serialized);
        return serialized;
      }).catch(()=>{throw failure();}); // Never let provider errors reach runtime logging.
      ticket.running = running;
      return running;
    },
  });
  if (seller.state !== 'active' || seller.protocol !== 'x402') { seller.stop();throw failure(); }
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if (closed || req.socket.remoteAddress!=='127.0.0.1' || req.headers.origin || !eq(req.get('authorization')??'',`Bearer ${secret}`))
      return void res.status(403).json({error:'Private assessment service'});
    next();
  });
  app.post('/x402',express.json({limit:'1kb'}),async(req,res)=>{
    let ticket:Ticket|undefined;
    try {
      if (!req.is('application/json') || Object.keys(req.query).length) return void res.status(400).json({error:'Invalid assessment envelope'});
      const envelope=envelopeSchema.parse(req.body), {requestId}=ticketSchema.parse(JSON.parse(envelope.prompt));
      ticket=tickets.get(requestId);
      // Only the qualified backend scheduler can issue a ticket. It carries
      // immutable evidence identities and the current admission/stop guard.
      if (!ticket || ticket.claimed || ticket.controller.signal.aborted) return void res.status(409).json({error:'Assessment ticket unavailable'});
      ticket.claimed=true;
      const current=ticket;
      res.once('close',()=>{if(!res.writableEnded)current.controller.abort();});
      const out=await seller.handle({method:'POST',path:'/x402',headers:{'content-type':'application/json'},body:JSON.stringify(envelope)});
      if (!res.destroyed) res.status(out.status).set(out.headers).send(out.body);
    } catch {
      if (!res.destroyed) res.status(400).json({error:'Invalid assessment request'});
    }
  });
  app.use((_req,res)=>res.status(404).json({error:'Unknown private route'}));
  app.use((_error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(400).json({error:'Invalid assessment request'}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const address=server.address();if (!address||typeof address==='string') throw failure();
  const endpoint=`http://127.0.0.1:${address.port}/x402`;
  const runner: AssessmentRunner={assess:async(pool,monitoring,guard)=>{
    const now=Date.now();attempts=attempts.filter(at=>now-at<3600000);
    if(closed||tickets.size||attempts.length>=(options.maxPerHour??60))throw failure();
    await guard.assertActive();
    // Recheck after async admission to preserve single flight under races.
    if(closed||tickets.size)throw failure();
    attempts.push(now);
    const requestId=randomUUID(),controller=new AbortController();
    const ticket:Ticket={job:structuredClone({requestId,pool,monitoring}),guard,controller,claimed:false};
    tickets.set(requestId,ticket);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);timer.unref();
    try {
      const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:controller.signal,
        headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},
        body:JSON.stringify({prompt:JSON.stringify({requestId})})});
      if(!response.ok)throw failure();
      const envelope=z.object({result:z.string().max(2*1024*1024)}).strict().parse(await response.json());
      // Verify the HTTP-delivered payload against the work hook's output, not
      // an unvalidated cast. No retry or same-process/direct-work fallback.
      if(!ticket.responseDigest||!eq(digest(envelope.result),ticket.responseDigest))throw failure();
      const result=JSON.parse(envelope.result) as AssessmentResult;
      if(result.decision.assessmentReceipt?.requestId!==requestId||result.decision.pool!==pool.address)throw failure();
      completedRequests++;lastCompletedAt=Date.now();
      return result;
    } catch {throw failure();}
    finally {
      clearTimeout(timer);controller.abort();
      // A timed-out upstream may still be unwinding. Never overlap a new job
      // or start a late model call while the previous work is pending.
      if(ticket.running)void ticket.running.catch(()=>{}).finally(()=>tickets.delete(requestId));
      else tickets.delete(requestId);
    }
  }};
  return {
    runner, endpoint,
    info:():AssessmentServiceInfo=>({name:'BNB Agent Studio',runtimeVersion:STUDIO_RUNTIME_VERSION,serviceVersion:ASSESSMENT_SERVICE_VERSION,
      state:closed?'unavailable':'ready',visibility:'backend-only',payments:false,completedRequests,lastCompletedAt}),
    close:async()=>{
      if(closed)return;closed=true;
      for(const ticket of tickets.values())ticket.controller.abort();
      seller.stop();server.closeAllConnections();
      await new Promise<void>(resolve=>server.close(()=>resolve()));
      await Promise.allSettled([...tickets.values()].flatMap(t=>t.running?[t.running]:[]));
    },
  };
}
