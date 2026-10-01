import {describe,it,expect,vi} from 'vitest';
import {launchPaperPool,launchPaperSnapshot,launchPaperVerification,launchEntrySetup} from './launch-paper.js';
import {marketExecutable,evaluatePolicy,emptyLedger,applyPaperFill,buyAmount,copycatStatus,needsProbe} from './policy.js';
import {paperExit} from './exits.js';
import {readGraduation} from './graduation.js';
import {Providers} from './providers.js';
import {GmgnMarketData} from './gmgn-market.js';
import {LaunchFeed} from './launch-feed.js';
import type {Launch} from '../src/launches.js';
import type {LaunchActivity} from '../src/monitoring.js';
import type {XResearch,Judgment,Snapshot} from '../src/types.js';
const now=1790000000000,token='0x'+'a'.repeat(40);
const launch:Launch={id:token,address:token,platform:'flap',symbol:'MOON',name:'Moon',stage:'bonding',
  createdAt:now-120000,observedAt:now,firstSeenAt:now-120000,reportedGraduatedAt:null,priceUsd:1,
  liquidityUsd:4000,marketCapUsd:20000,volume24h:1200,progress:.5,holders:30,top10:.2,logo:null,quote:null,riskFlags:[]};
const activity:LaunchActivity={token,observedAt:now,volume5mUsd:600,swaps5m:12,buys5m:8,sells5m:4,riskFlags:[]};
const snapshot=():Snapshot=>({...launchPaperSnapshot(launchPaperPool(launch,activity,now),now),entrySetup:launchEntrySetup(launch,[],now)});
const judgment:Judgment={action:'buy',confidence:.7,probabilities:{buy:.7,sell:.1,hold:.2},quality:2,toxic:.1,model:'test',requestId:'test',costUsd:0};
function research():XResearch {
  const unknown={verdict:'unknown' as const,summary:'Unknown',evidenceIds:[]};
  return {token,status:'no_results',detail:'No accepted CA posts',model:'test',window:{from:now-86400000,to:now},
    collectedAt:now,expiresAt:now+300000,searchCalls:1,rejectedCount:0,sources:[],narrative:{
      version:'narrative-v1',status:'ready',metadata:{token,name:'Moon',symbol:'MOON',description:'Lunar launch meme',reportedXHandle:null,source:'GMGN',requestedAt:now,receivedAt:now},
      angle:'Lunar launch',themeSources:[{url:'https://x.com/source/status/1',postId:'1',handle:'source',publishedAt:now-1000,timestampSource:'post-id',summary:'Current event'}],
      findings:{fit:{verdict:'supports',summary:'Fit',evidenceIds:['TOKEN']},catalyst:{verdict:'supports',summary:'Event',evidenceIds:['T1']},timing:{verdict:'supports',summary:'Current',evidenceIds:['T1']},originality:unknown,community:unknown,kol:unknown,promotion:unknown},
      spreadSample:{posts:0,authors:0,largestAuthorShare:null},issues:[]}};
}
const context=()=>({now,approved:true,halted:false,memoryReady:true,ledger:emptyLedger(),snapshot:snapshot(),judgment,research:research()});
describe('aggressive launch paper path',()=>{
  it.each(['new','bonding'] as const)('accepts %s without a DEX pool or fabricated trade time',async stage=>{
    const resolver=vi.fn();
    const verification=await readGraduation({...launch,stage},resolver,()=>now);
    expect(verification).toMatchObject({status:'paper_launch',pool:`launch:${token}`});
    expect(resolver).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({marketAt:0,source:'gmgn-paper',change1h:null});
    expect(marketExecutable(snapshot(),now)).toBe(true);
    for(const patch of [{marketAt:now},{source:'bitquery' as const},{token:'0x'+'b'.repeat(40)},{observedAt:now+1},{priceUsd:0}])
      expect(marketExecutable({...snapshot(),...patch},now)).toBe(false);
    expect(marketExecutable(snapshot(),now+90001)).toBe(false);
  });
  it('allows a $25 narrative probe before token X spread, with higher modeled costs',()=>{
    const c=context();expect(evaluatePolicy(c).action).toBe('buy');
    expect(buyAmount(c.ledger,c.snapshot,true)).toBe(25);
    const ledger=applyPaperFill(c.ledger,c.snapshot,'buy','entry',now,{probe:true});
    expect(ledger.cashUsd).toBe(1974.75);
    expect(ledger.fills[0]).toMatchObject({priceUsd:1.03,feeUsd:.25,priceSource:'gmgn-paper',modeledSlippageBps:300});
    expect(ledger.positions[0].costUsd).toBe(25.25);
  });
  it('holds on unbacked narrative, wrong or stale metadata, missing flow and copycat conflict',()=>{
    const changes=[
      (c:ReturnType<typeof context>)=>{c.research.narrative!.findings!.fit.verdict='unknown';},
      (c:ReturnType<typeof context>)=>{c.research.narrative!.metadata.token='wrong';},
      (c:ReturnType<typeof context>)=>{c.research.narrative!.metadata.requestedAt=now-300001;},
      (c:ReturnType<typeof context>)=>{c.snapshot.launchQuote!.activity=undefined;},
      (c:ReturnType<typeof context>)=>{c.research.narrative!.findings!.originality.verdict='cautions';},
      (c:ReturnType<typeof context>)=>{c.research.status='error';},
      (c:ReturnType<typeof context>)=>{c.snapshot.launchQuote!.activity={...activity,observedAt:now+1};},
      (c:ReturnType<typeof context>)=>{c.snapshot.launchQuote!.riskFlags=['honeypot'];},
    ];
    for(const change of changes){const c=context();change(c);expect(evaluatePolicy(c).action).toBe('hold');}
  });
  it('distinguishes market cap, liquidity and a measured chase; unknown is not a bottom',()=>{
    const c=context();c.snapshot.entrySetup!.marketCapUsd=40000;
    expect(evaluatePolicy(c).action).toBe('hold');
    Object.assign(c.snapshot.entrySetup!,{distanceFromLowPct:20,rangeLowUsd:.84,candleTo:now});
    expect(evaluatePolicy(c).action).toBe('buy');
    Object.assign(c.snapshot.entrySetup!,{marketCapUsd:20000,distanceFromLowPct:150});
    expect(evaluatePolicy(c).action).toBe('hold');
    c.snapshot.entrySetup=undefined;expect(evaluatePolicy(c).action).toBe('hold');
    const rival=context();rival.snapshot.entrySetup!.competingTickers=1;expect(evaluatePolicy(rival).action).toBe('buy');
  });
  it('resolves rivalry only with fresh token-bound citations and retains cited conflict vetoes',()=>{
    const c=context();c.snapshot.entrySetup!.competingTickers=2;
    const f=c.research.narrative!.findings!.originality;
    expect(copycatStatus(c.snapshot,c.research,now)).toBe('unresolved');
    f.verdict='supports';f.evidenceIds=['T1'];
    expect(copycatStatus(c.snapshot,c.research,now)).toBe('unresolved');
    c.research.status='ready';c.research.sources=[{...c.research.narrative!.themeSources[0],identityExcerpt:token}];
    f.evidenceIds=['X1'];expect(copycatStatus(c.snapshot,c.research,now)).toBe('supported');
    expect(needsProbe(c.snapshot,c.research,now)).toBe(true); // Every initial entry is a probe.
    c.snapshot.position={quantity:25,costUsd:25,returnPct:10,takeProfits:0};
    expect(needsProbe(c.snapshot,c.research,now)).toBe(false);
    f.evidenceIds=['X2'];expect(copycatStatus(c.snapshot,c.research,now)).toBe('unresolved');
    f.evidenceIds=['X1'];c.research.narrative!.metadata.token='wrong';
    expect(copycatStatus(c.snapshot,c.research,now)).toBe('unresolved');
    c.research.narrative!.metadata.token=token;c.research.narrative!.metadata.requestedAt=now-300001;
    expect(copycatStatus(c.snapshot,c.research,now)).toBe('unresolved');
    c.research.narrative!.metadata.requestedAt=now;f.verdict='cautions';
    expect(evaluatePolicy(c).checks.find(x=>x.label==='Copycat evidence')?.pass).toBe(false);
    c.snapshot.entrySetup!.competingTickers=0;
    expect(evaluatePolicy(c).action).toBe('hold'); // Valid caution matters even without a feed rival.
  });
  it('requires actual recent candles for the low and excludes old/future candles',()=>{
    const candle=(time:number,low:number)=>({time:time/1000,open:1,close:1,low,high:2,volume:1});
    const result=launchEntrySetup(launch,[candle(now-120000,.8),candle(now-60000,.9),candle(now,1),candle(now+60000,.01),candle(now-3600000,.01)],now);
    expect(result.rangeLowUsd).toBe(.8);expect(result.distanceFromLowPct).toBe(25);
    expect(launchEntrySetup(launch,[candle(now,1)],now).rangeLowUsd).toBeNull();
  });
  it('retains the same simulated identity and entry basis across graduation and rejects stale exit marks',()=>{
    const first=snapshot(),ledger=applyPaperFill(emptyLedger(),first,'buy','entry',now);
    const graduated={...launch,stage:'graduated_reported' as const,reportedGraduatedAt:now,priceUsd:2.5};
    const after=launchPaperSnapshot(launchPaperPool(graduated,activity,now),now);
    expect(after.pool).toBe(first.pool);expect(launchPaperVerification(graduated,now).status).toBe('paper_launch');
    const exit=paperExit(ledger.positions[0],after,now)!;
    const sold=applyPaperFill(ledger,after,'sell','principal',now,exit);
    expect(sold.positions[0].investedUsd).toBe(25.25);expect(sold.positions[0].principalRecovered).toBe(true);
    expect(sold.cashUsd).toBeCloseTo(2000);
    expect(paperExit(ledger.positions[0],after,now+90001)).toBeNull();
    expect(()=>applyPaperFill(ledger,{...after,pool:'0x'+'b'.repeat(40)},'buy','duplicate',now)).toThrow('Position limit');
  });
  it('reads narrative metadata before any Pancake pool exists',async()=>{
    const market=new GmgnMarketData(async()=>({address:token,name:'Moon',symbol:'MOON',link:{description:'Lunar meme',twitter_username:'moon'}}),()=>now);
    expect(await market.metadataForToken(token)).toMatchObject({token,description:'Lunar meme',reportedXHandle:'moon'});
    await expect(market.poolForToken(token)).rejects.toThrow();
  });
  it('routes provider refresh and snapshots through launch marks without a DEX price call',async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    try {
      const feed=new LaunchFeed();feed.state.launches=[launch];vi.spyOn(feed,'activity').mockResolvedValue([activity]);vi.spyOn(feed,'tokenCandles').mockResolvedValue([]);
      const fetch=vi.fn(),providers=new Providers({},fetch,undefined,{launches:feed});
      const pool=await providers.pool(`launch:${token}`,token),snap=await providers.snapshot(pool,{entryContext:true});
      expect(snap.source).toBe('gmgn-paper');expect(snap.entrySetup?.marketCapUsd).toBe(20000);expect(fetch).not.toHaveBeenCalled();
      vi.mocked(feed.tokenCandles).mockClear();await providers.snapshot(pool);expect(feed.tokenCandles).not.toHaveBeenCalled();
      feed.state.launches=[];await expect(providers.pool(pool.address,token)).rejects.toThrow('unavailable');
    } finally {vi.useRealTimers();}
  });
});

it('allows a cultural-hook probe without a news event or KOL, but never skips fit or fresh flow',()=>{
 const c=context(),f=c.research.narrative!.findings!;
 f.catalyst={verdict:'unknown',summary:'No news event',evidenceIds:[]};f.timing={...f.catalyst};
 c.judgment={...c.judgment,confidence:.56,quality:1.3};expect(evaluatePolicy(c).action).toBe('buy');
 f.fit={verdict:'unknown',summary:'Ticker does not establish a hook',evidenceIds:[]};
 c.research.status='ready';c.research.sources=[{...c.research.narrative!.themeSources[0],identityExcerpt:token}];
 expect(evaluatePolicy(c).action).toBe('hold'); // CA posts cannot bypass fit.
});
