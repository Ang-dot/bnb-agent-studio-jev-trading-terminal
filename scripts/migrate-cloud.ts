// Operator-run once after stopping the laptop worker. No provider calls or orders.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { CloudStore } from '../server/cloud-store.js';
const source=process.argv[2];
if(!source || !process.argv.includes('--apply') || !process.env.TIDB_DATABASE_URL || process.env.WORKER_ENABLED!=='false') throw new Error('Explicit source, --apply and disabled cloud worker required');
let reachable=false;
try {await fetch('http://127.0.0.1:8787/api/health',{signal:AbortSignal.timeout(1000)});reachable=true;}catch{}
if(reachable)throw new Error('Stop the laptop worker before migration');
const dir=resolve(source),local=new DatabaseSync(join(dir,'terminal.sqlite'),{readOnly:true});
const raw=local.prepare('SELECT data FROM terminal_state WHERE id=1').get()!.data as string;local.close();
const state=JSON.parse(raw);
if(state.running || !Array.isArray(state.decisions)||!Array.isArray(state.ledger?.fills))throw new Error('Source must contain a paused valid ledger');
const hash=createHash('sha256').update(raw).digest('hex');
const archive=new DatabaseSync(join(dir,'evidence.sqlite'),{readOnly:true});
const evidence=archive.prepare('SELECT data,raw FROM evidence ORDER BY observed_at').all().map(r=>({data:JSON.parse(r.data as string),raw:JSON.parse(r.raw as string)}));archive.close();
const records=['monitor','replay','gmgn-cooldown'].filter(n=>existsSync(join(dir,n+'.json'))).map(n=>({name:n,data:readFileSync(join(dir,n+'.json'),'utf8')}));
for(const r of records)JSON.parse(r.data);
const savedLaunch=process.argv.find(a=>a.startsWith('--launches='))?.slice(11);
if(savedLaunch){const data=readFileSync(savedLaunch,'utf8');const f=JSON.parse(data);if(f.source!=='GMGN'||!Array.isArray(f.launches))throw new Error('Invalid launch snapshot');records.push({name:'launches',data});}
const cloud=await new CloudStore(process.env.TIDB_DATABASE_URL).init();
let timer:NodeJS.Timeout|undefined,phase='acquire';
try {
  if(!await cloud.acquire())throw new Error('Another worker owns the cloud lease');
  let lost=false;timer=setInterval(()=>void cloud.renew().catch(()=>{lost=true;}),10000);
  const receipt=await cloud.record('migration').read(),current=await cloud.read();
  if(receipt){if(JSON.parse(receipt).hash!==hash)throw new Error('Cloud migration differs; refusing overwrite');console.log(JSON.stringify({alreadyImported:true}));}
  else {
    if(current.decisions.length||current.ledger.fills.length||current.memoryEpisodes?.length)throw new Error('Cloud ledger is not empty; refusing overwrite');
    phase='evidence';for(const e of evidence){if(lost)throw new Error('Migration lease lost');await cloud.save(e.data,e.raw);}
    phase='records';for(const r of records)await cloud.record(r.name).write(r.data);
    phase='state';
    await cloud.mutate(s=>{Object.assign(s,state,{running:false,paperSession:randomUUID()});});
    phase='receipt';await cloud.record('migration').write(JSON.stringify({hash,at:Date.now(),sourceRevision:state.revision,decisions:state.decisions.length,evidence:evidence.length}));
  }
  const actual=await cloud.read();
  if(JSON.stringify(actual.ledger)!==JSON.stringify(state.ledger)||JSON.stringify(actual.decisions)!==JSON.stringify(state.decisions)||JSON.stringify(actual.memoryEpisodes)!==JSON.stringify(state.memoryEpisodes))throw new Error('Imported data mismatch');
  console.log(JSON.stringify({verified:true,running:actual.running,decisions:actual.decisions.length,memoryEpisodes:actual.memoryEpisodes?.length,evidence:evidence.length,fills:actual.ledger.fills.length,cash:actual.ledger.cashUsd,records:records.map(r=>r.name),sourceUnmodified:true}));
}catch(error){let message=error instanceof Error?error.message:'';for(const v of Object.values(process.env))if(v&&v.length>8)message=message.replaceAll(v,'[redacted]');console.error(JSON.stringify({migration:'incomplete',phase,code:(error as NodeJS.ErrnoException).code||'VERIFY_MIGRATION',errno:(error as {errno?:number}).errno,detail:message.slice(0,240)}));process.exitCode=1;}
finally{if(timer)clearInterval(timer);await cloud.release();await cloud.close();}
