import { z } from 'zod';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { JsonPersistence } from './cloud-store.js';

const address=z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(v=>v.toLowerCase()).refine(v=>!/^0x0{40}$/.test(v));
const price=z.union([z.number(),z.string().trim().min(1)]).transform(Number).refine(v=>Number.isFinite(v)&&v>0);
const identity=z.object({from_token_address:address,to_token_address:address});
const event=z.object({block_timestamp:z.string().datetime({offset:true}),block_number:z.number().int().positive(),tx_hash:z.string().regex(/^0x[0-9a-fA-F]{64}$/)});
export interface PoolTrade {
  priceUsd:number;marketAt:number;requestedAt:number;receivedAt:number;
  evidence:{network:'bsc';pool:string;token:string;txHash:string;blockNumber:number};
}

// Pool identity is pinned in the request path; token identity is matched in
// each returned swap. API receipt time must never replace the block timestamp.
export function parsePoolTrades(raw:unknown,pool:string,token:string,requestedAt:number,receivedAt:number):PoolTrade {
  pool=address.parse(pool);token=address.parse(token);
  if(pool===token||![requestedAt,receivedAt].every(Number.isFinite)||requestedAt<=0||receivedAt<requestedAt||receivedAt-requestedAt>90000)
    throw new Error('Invalid GeckoTerminal request identity or timing');
  const rows=z.object({data:z.array(z.object({type:z.literal('trade'),attributes:z.record(z.unknown())}))}).parse(raw).data;
  const matching=rows.flatMap(({attributes:a})=>{
    const ids=identity.parse(a);
    if(ids.from_token_address!==token&&ids.to_token_address!==token)return [];
    if(ids.from_token_address===ids.to_token_address)throw new Error('Invalid GeckoTerminal token identity');
    const t=event.parse(a),marketAt=Date.parse(t.block_timestamp);
    if(!Number.isFinite(marketAt)||marketAt<=0||marketAt>receivedAt)throw new Error('Invalid GeckoTerminal block timestamp');
    return [{priceUsd:price.parse(ids.from_token_address===token?a.price_from_in_usd:a.price_to_in_usd),marketAt,requestedAt,receivedAt,
      evidence:{network:'bsc' as const,pool,token,txHash:t.tx_hash.toLowerCase(),blockNumber:t.block_number}}];
  }).sort((a,b)=>b.marketAt-a.marketAt);
  if(!matching.length)throw new Error('No matching GeckoTerminal pool trade');
  return matching[0];
}

export class CoinGeckoError extends Error {}
export const DEMO_BUDGET:Readonly<{minute:number;day:number;month:number}>=Object.freeze({minute:90,day:0,month:9000});
const usageSchema=z.object({version:z.literal(1),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),month:z.string().regex(/^\d{4}-\d{2}$/),
  dayCalls:z.number().int().nonnegative(),monthCalls:z.number().int().nonnegative(),lastAt:z.number().finite().nonnegative(),recent:z.array(z.number().finite()).max(100),blockedUntil:z.number().finite().nonnegative()});
type Usage=z.infer<typeof usageSchema>;
const emptyUsage=(now:number):Usage=>({version:1,day:new Date(now).toISOString().slice(0,10),month:new Date(now).toISOString().slice(0,7),dayCalls:0,monthCalls:0,lastAt:now,recent:[],blockedUntil:0});

export function coinGeckoFileBudget(path='.data/coingecko-usage.json'):JsonPersistence {
  return {read:async()=>{try{return await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}},
    write:async value=>{await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path+'.tmp',value,{mode:0o600});await rename(path+'.tmp',path);}};
}

// One instance is shared by assessments, exits and memory marks. Cloud budget
// writes use the existing fenced single-worker record; never browser storage.
export class CoinGeckoTrades {
  private cache=new Map<string,{at:number;value?:PoolTrade;error?:CoinGeckoError}>();
  private pending=new Map<string,Promise<PoolTrade>>();
  private budgetTail:Promise<unknown>=Promise.resolve();
  private persistence:JsonPersistence;
  private usage:Usage|undefined;
  private now:()=>number;
  private fetchImpl:typeof fetch;
  private limits:typeof DEMO_BUDGET;
  constructor(private options:{key:string;fetchImpl?:typeof fetch;now?:()=>number;persistence?:JsonPersistence;limits?:typeof DEMO_BUDGET}){
    this.now=options.now??Date.now;this.fetchImpl=options.fetchImpl??fetch;
    this.persistence=options.persistence??coinGeckoFileBudget();this.limits=options.limits??DEMO_BUDGET;
  }
  useBudget(persistence:JsonPersistence){if(this.pending.size)throw new Error('GeckoTerminal requests are active');this.persistence=persistence;this.usage=undefined;this.cache.clear();}
  get detail(){return this.usage?`Demo REST · ${this.usage.monthCalls}/${this.limits.month} monthly app requests · ${this.limits.minute}/min app guard · 60s cache. App-local usage, not account balance.`:'Demo REST · 60s cache; budget not yet loaded.';}
  private budget(change:(state:Usage,now:number)=>void){
    const work=this.budgetTail.then(async()=>{
      const at=this.now(),raw=await this.persistence.read();
      const state=raw===undefined?emptyUsage(at):usageSchema.parse(JSON.parse(raw));
      if(state.lastAt>at)throw new CoinGeckoError('GeckoTerminal usage clock moved backwards; no request sent.');
      const today=new Date(at).toISOString().slice(0,10),month=today.slice(0,7);
      if(state.month!==month){state.month=month;state.monthCalls=0;}
      if(state.day!==today){state.day=today;state.dayCalls=0;}
      state.recent=state.recent.filter(t=>t<=at&&at-t<60000);
      change(state,at);state.lastAt=at;
      await this.persistence.write(JSON.stringify(state));this.usage=state;
    }).catch(error=>{if(error instanceof CoinGeckoError)throw error;throw new CoinGeckoError('GeckoTerminal usage record unavailable; no request sent.');});
    this.budgetTail=work.catch(()=>{});return work;
  }
  async read(pool:string,token:string,options:{fresh?:boolean}={}):Promise<PoolTrade>{
    pool=address.parse(pool);token=address.parse(token);
    if(!this.options.key)throw new CoinGeckoError('GeckoTerminal Demo API key is missing.');
    const key=pool+':'+token,at=this.now(),hit=this.cache.get(key);
    if(hit&&at>=hit.at&&at-hit.at<60000&&(hit.error||!options.fresh)){if(hit.error)throw hit.error;return structuredClone(hit.value!);}
    let task=this.pending.get(key);
    if(!task){
      if(this.pending.size>=32)throw new CoinGeckoError('GeckoTerminal request queue is full.');
      task=this.load(pool,token).then(value=>{this.save(key,{at:value.requestedAt,value});return value;},error=>{
        const safe=error instanceof CoinGeckoError?error:new CoinGeckoError('GeckoTerminal pool-trade response unavailable or invalid.');
        this.save(key,{at:this.now(),error:safe});throw safe;
      }).finally(()=>this.pending.delete(key));
      this.pending.set(key,task);
    }
    return structuredClone(await task);
  }
  private save(key:string,entry:{at:number;value?:PoolTrade;error?:CoinGeckoError}){if(this.cache.size>=128)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,entry);}
  private async load(pool:string,token:string):Promise<PoolTrade>{
    // Reserve BEFORE fetch; failures count conservatively and retries cannot
    // reset the monthly/daily budget across a deployment or process restart.
    await this.budget((s,at)=>{
      if(s.blockedUntil>at)throw new CoinGeckoError('GeckoTerminal provider cooldown active; no request sent.');
      if((this.limits.day>0&&s.dayCalls>=this.limits.day)||s.monthCalls>=this.limits.month)throw new CoinGeckoError('GeckoTerminal Demo request budget reached; fresh-price checks are paused.');
      if(s.recent.length>=this.limits.minute)throw new CoinGeckoError('GeckoTerminal request pace limit reached; retry after the minute window.');
      s.dayCalls++;s.monthCalls++;s.recent.push(at);
    });
    const requestedAt=this.now();
    const response=await this.fetchImpl(`https://api.coingecko.com/api/v3/onchain/networks/bsc/pools/${pool}/trades`,{
      headers:{'x-cg-demo-api-key':this.options.key},redirect:'error',signal:AbortSignal.timeout(15000),
    });
    const receivedAt=this.now();
    if(!response.ok){
      if([401,403,429].includes(response.status))await this.budget((s,at)=>{s.blockedUntil=at+300000;});
      throw new CoinGeckoError(response.status===429?'GeckoTerminal rate or account limit reached; requests cooling down.':
        [401,403].includes(response.status)?'GeckoTerminal authentication or plan access rejected.':`GeckoTerminal returned HTTP ${response.status}; no price substituted.`);
    }
    return parsePoolTrades(await response.json(),pool,token,requestedAt,receivedAt);
  }
}
