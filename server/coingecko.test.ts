import { describe, expect, it, vi } from 'vitest';
import { CoinGeckoTrades, parsePoolTrades, DEMO_BUDGET } from './coingecko.js';

const pool='0x'+'a'.repeat(40),token='0x'+'b'.repeat(40),quote='0x'+'c'.repeat(40);
const now=Date.parse('2026-09-26T04:00:00Z');
const trade=(patch:Record<string,unknown>={})=>({type:'trade',attributes:{
  from_token_address:quote,to_token_address:token,price_from_in_usd:'600',price_to_in_usd:'0.02',
  block_timestamp:new Date(now-5000).toISOString(),block_number:100,tx_hash:'0x'+'d'.repeat(64),...patch,
}});
describe('CoinGecko Demo pool trades',()=>{
  it('allows demo bursts without a daily cap while preserving monthly and minute limits',async()=>{
    expect(DEMO_BUDGET).toEqual({minute:90,day:0,month:9000});
    let clock=now,saved:string|undefined;
    const persistence={read:async()=>saved,write:async(v:string)=>{saved=v;}};
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({data:[trade()]}));
    const options={key:'fixture-key',fetchImpl,now:()=>clock,persistence,limits:{minute:1,day:0,month:2}};
    await new CoinGeckoTrades(options).read(pool,token);
    await expect(new CoinGeckoTrades(options).read(quote,token)).rejects.toThrow('pace limit');
    clock+=60001;await new CoinGeckoTrades(options).read(pool,token);
    clock+=60001;await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('budget reached');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('selects the target leg of the newest matching pool trade, not the quote price or receipt time',()=>{
    const result=parsePoolTrades({data:[trade({block_timestamp:new Date(now-20000).toISOString()}),trade()]},pool,token,now-1000,now);
    expect(result).toMatchObject({priceUsd:.02,marketAt:now-5000,requestedAt:now-1000,receivedAt:now,
      evidence:{pool,token,network:'bsc',blockNumber:100,txHash:'0x'+'d'.repeat(64)}});
    expect(parsePoolTrades({data:[trade({from_token_address:token,to_token_address:quote,price_from_in_usd:'.03'})]},pool,token,now-1000,now).priceUsd).toBe(.03);
    for(const raw of [{data:[]},{data:[trade({to_token_address:pool})]},
      {data:[trade({block_timestamp:new Date(now+1000).toISOString()})]},
      {data:[trade({price_to_in_usd:null})]},{data:[trade({tx_hash:'invalid'})]}])
      expect(()=>parsePoolTrades(raw,pool,token,now-1000,now)).toThrow();
  });
  it('shares one request and a 60-second cache without refreshing trade evidence timestamps',async()=>{
    let clock=now,saved:string|undefined;
    const persistence={read:async()=>saved,write:async(v:string)=>{saved=v;}};
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({data:[trade()]}));
    const client=new CoinGeckoTrades({key:'fixture-key',fetchImpl,now:()=>clock,persistence});
    const [a,b]=await Promise.all([client.read(pool,token),client.read(pool,token)]);
    expect(a).toEqual(b);expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.coingecko.com/api/v3/onchain/networks/bsc/pools/${pool}/trades`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({headers:{'x-cg-demo-api-key':'fixture-key'},redirect:'error'});
    clock+=30000;expect(await client.read(pool,token)).toEqual(a);expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(saved).not.toContain('fixture-key');
    clock+=30001;await client.read(pool,token);expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('persists daily and monthly reservations across restarts, and refuses unreadable accounting',async()=>{
    let clock=now,saved:string|undefined;
    const persistence={read:async()=>saved,write:async(v:string)=>{saved=v;}};
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({data:[trade()]}));
    const options={key:'fixture-key',fetchImpl,now:()=>clock,persistence,limits:{minute:10,day:1,month:1}};
    await new CoinGeckoTrades(options).read(pool,token);
    clock+=60001;
    await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('budget reached');
    clock+=86400000;
    await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('budget reached');
    saved='corrupted';
    await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('usage record unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('cools down all pools after 429, preserves the cooldown on restart and never exposes upstream bodies',async()=>{
    let saved:string|undefined;
    const persistence={read:async()=>saved,write:async(v:string)=>{saved=v;}};
    const fetchImpl=vi.fn<typeof fetch>(async()=>new Response('fixture-secret',{status:429}));
    const options={key:'fixture-secret',fetchImpl,now:()=>now,persistence};
    await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('rate or account limit');
    await expect(new CoinGeckoTrades(options).read(quote,token)).rejects.toThrow('cooldown');
    expect(fetchImpl).toHaveBeenCalledTimes(1);expect(saved).not.toContain('fixture-secret');
  });
  it('resets the calendar-month budget but does not reset it on a process restart',async()=>{
    let clock=now,saved:string|undefined;
    const persistence={read:async()=>saved,write:async(v:string)=>{saved=v;}};
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({data:[trade()]}));
    const options={key:'fixture',fetchImpl,now:()=>clock,persistence,limits:{minute:90,day:0,month:1}};
    await new CoinGeckoTrades(options).read(pool,token);
    clock+=60001;await expect(new CoinGeckoTrades(options).read(pool,token)).rejects.toThrow('budget reached');
    clock=Date.parse('2026-10-01T00:00:00Z');await new CoinGeckoTrades(options).read(pool,token);
    expect(JSON.parse(saved!).monthCalls).toBe(1);expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('does not substitute an old price or leak upstream errors after a failed refresh',async()=>{
    let clock=now,saved:string|undefined;
    const fetchImpl=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({data:[trade()]})).mockRejectedValue(new Error('fixture-secret'));
    const client=new CoinGeckoTrades({key:'fixture-secret',fetchImpl,now:()=>clock,persistence:{read:async()=>saved,write:async(v)=>{saved=v;}}});
    await client.read(pool,token);clock+=60001;
    await expect(client.read(pool,token)).rejects.toThrow('GeckoTerminal pool-trade response unavailable or invalid');
    await expect(client.read(pool,token)).rejects.not.toThrow('fixture-secret');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
