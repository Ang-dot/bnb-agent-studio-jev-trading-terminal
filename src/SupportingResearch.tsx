import { apiPath } from "./api-path.js";
import { useEffect, useState } from "react";
import { Activity, Clock3, Database, Droplets, ExternalLink, Fingerprint, Users } from "lucide-react";
import type { SupportingEvidence } from "./enrichment.js";
import type { Decision } from "./types.js";
import "./supporting-research.css";

const money = (n: number | null | undefined) => n == null ? "Unavailable" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(n);
const percent = (n: number | null | undefined) => n == null ? "Unavailable" : n.toFixed(2) + "%";
const count = (n: number | null | undefined) => n == null ? "Unavailable" : n.toLocaleString("en-US");
const time = (n: number | null | undefined) => n == null ? "Unavailable" : new Date(n).toLocaleString("en-GB");
const short = (s: string) => s.slice(0,6)+"…"+s.slice(-4);
const labels: Record<string,string> = {dev:"Developer",bundler:"Bundler",rat_trader:"Insider",sniper:"Sniper",smart_degen:"Smart money",renowned:"KOL",kol:"KOL"};
function Address({value}:{value:string|null}) { return value ? <a href={`https://bscscan.com/address/${value}`} target="_blank" rel="noreferrer" title={value}>{short(value)} <ExternalLink size={11}/></a> : <>Unavailable</>; }
const receipts: Record<string,string> = {info:"Token info · pool & windows",creator:"Creator launches · peak cap sorted",holders:"Top 20 holders · share sorted",traders:"Top 20 traders · sell USD sorted",smartmoney:"Latest 100 BSC smart-money events"};

export function SupportingResearch({token,decision,now,eligible}:{token:string;decision?:Decision;now:number;eligible:boolean}) {
  const [latest,setLatest]=useState<SupportingEvidence|null>(null);
  const [failed,setFailed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState<"decision"|"latest">("decision");
  useEffect(()=>{setView("decision");},[token,decision?.id]);
  useEffect(()=>{
    setLatest(null);setFailed(false);setLoading(!!token);
    if(!token)return;
    const c=new AbortController();let busy=false;
    const refresh=async()=>{if(busy)return;busy=true;try{
      const r=await fetch(apiPath(`/api/evidence/${token}`),{signal:c.signal,cache:"no-store"});
      if(!r.ok)throw new Error();
      const data=await r.json();if(!c.signal.aborted){setLatest(data.evidence?.token===token?data.evidence:null);setFailed(false);}
    }catch{if(!c.signal.aborted)setFailed(true);}finally{busy=false;if(!c.signal.aborted)setLoading(false);}};
    void refresh();const timer=window.setInterval(()=>void refresh(),10000);
    return()=>{c.abort();window.clearInterval(timer);};
  },[token]);
  const pinned=decision?.supportingEvidence?.token===token?decision.supportingEvidence:undefined;
  const frozen=view==="decision"&&!!pinned;
  const evidence=frozen?pinned:latest;
  return <section className="tt-research" aria-label="Supporting research">
    <header><div><Database size={17}/><h2>Supporting research</h2><span className="tt-research-tag">GMGN</span></div>{pinned&&latest&&latest.id!==pinned.id&&<div className="tt-research-switch"><button aria-pressed={view==="decision"} onClick={()=>setView("decision")}>At decision</button><button aria-pressed={view==="latest"} onClick={()=>setView("latest")}>Latest</button></div>}</header>
    {!evidence ? <div className="tt-research-empty"><div className="tt-research-flow-labels"><span><Fingerprint size={16}/>Creator</span><span><Users size={16}/>Wallets</span><span><Activity size={16}/>Flow</span><span><Droplets size={16}/>Depth</span></div><p>{loading?"Loading saved observations…":failed?"Research archive unavailable. No replacement data shown.":eligible?"Qualified for monitoring. The next assessment starts background evidence collection.":"Research collection begins after this launch passes monitoring qualification."}</p>{decision&&!pinned&&<small>No supporting snapshot was saved for this historical decision.</small>}</div> :
      <><ResearchEvidenceView evidence={evidence} now={now} frozen={frozen} decisionPool={decision?.pool} usedByJev={frozen&&decision?.researchInput?.evidenceId===evidence.id}/>
      {frozen&&decision?.researchInput&&<div className="tt-research-verdicts">{decision.researchInput.sections.map(section=>{
        const a=decision.judgment?.assessments?.find(a=>a.id===section.id&&a.kind==='research');
        return <div key={section.id} id={`evidence-${section.id}`}><span>{section.label} · {section.availability}</span><strong>{a?.valueLabel||'JEV assessment not returned'}</strong><small>{a?`${(a.confidence*100).toFixed(0)}% model confidence · not win probability`:'Context was supplied; no interpretation inferred.'}</small><details><summary>How JEV should use this</summary>{section.caveats.map(c=><p key={c}>{c}</p>)}</details></div>;
      })}</div>}
      {frozen&&decision?.researchInput&&<details className="tt-research-input"><summary>Exact research context sent to JEV</summary><p>Frozen before this decision. Documentation-grounded semantics, not a backtested trading edge. Code limits are unchanged.</p><pre>{JSON.stringify(decision.researchInput,null,2)}</pre></details>}
      {!frozen&&decision&&<p className="tt-research-history-note">{!pinned?"This decision has no saved supporting snapshot. ":""}Latest research is separate from the recorded decision; it does not explain or revise that past action.</p>}</>}
  </section>;
}

export function ResearchEvidenceView({evidence:e,now,frozen,decisionPool,usedByJev=false}:{evidence:SupportingEvidence;now:number;frozen:boolean;decisionPool?:string;usedByJev?:boolean}) {
  const [tab,setTab]=useState("flow");
  const [sample,setSample]=useState<"holders"|"traders">("holders");
  const [tag,setTag]=useState("all");
  const f=e.flow.find(f=>f.window==="5m");
  const wallets=e.wallets.filter(w=>w.sample===sample&&(tag==="all"||w.tags.includes(tag)||(tag==="renowned"&&w.tags.includes("kol"))));
  const stale=now-e.startedAt>300000;
  const unavailable=e.sources.filter(s=>s.status!=="ready").map(s=>({info:"token data",creator:"creator history",holders:"holders",traders:"traders",smartmoney:"smart-money events"}[s.key]||s.key));
  const eventsReady=e.sources.find(s=>s.key==="smartmoney")?.status==="ready";
  const walletsReady=e.sources.find(s=>s.key===sample)?.status==="ready";
  return <div className="tt-research-content">
    <div className="tt-research-meta"><span><Clock3 size={12}/>{frozen?"Saved at decision":"Latest observation"} · {time(e.completedAt)}{stale?" · aged":""}</span><span className={usedByJev?'tt-research-used':''}>{usedByJev?'Qualified context supplied to JEV':'Archive only · Not used by JEV or entry rules'}</span></div>
    {!!unavailable.length&&<p className="tt-research-history-note">Partial data · unavailable: {unavailable.join(", ")}.</p>}
    <div className="tt-research-cards" role="group" aria-label="Research categories">
      {[
        {id:"creator",label:"Creator history",Icon:Fingerprint,value:e.creator.totalLaunches===null?"Unavailable":count(e.creator.totalLaunches)+(e.creator.totalLaunches===1?" launch":" launches"),detail:e.creator.graduationRate===null?"Graduation history pending":percent(e.creator.graduationRate*100)+" graduated"},
        {id:"wallets",label:"Wallet behavior",Icon:Users,value:e.top10Share===null?"Unavailable":percent(e.top10Share*100)+" top 10",detail:e.comparison?.top10DeltaPp!=null?(e.comparison.top10DeltaPp>=0?"+":"")+e.comparison.top10DeltaPp.toFixed(2)+" pp vs prior snapshot":"Concentration & tagged wallets"},
        {id:"flow",label:"Short-window flow",Icon:Activity,value:money(f?.netUsd),detail:"Net buy − sell USD · 5m"},
        {id:"pool",label:"Pool depth",Icon:Droplets,value:money(e.pool.quoteUsd),detail:(e.pool.quoteSymbol||"Quote")+" reserves · USD"},
      ].map(c=><button key={c.id} aria-pressed={tab===c.id} onClick={()=>setTab(c.id)}><span><c.Icon size={14}/>{c.label}</span><strong>{c.value}</strong><small>{c.detail}</small></button>)}
    </div>
    <div className="tt-research-detail">
      {tab==="creator"&&<>
        <div className="tt-research-section-title"><h3>Creator track record</h3><Address value={e.creator.address}/></div>
        <p><b>{count(e.creator.graduated)}</b> graduated / <b>{count(e.creator.totalLaunches)}</b> lifetime launches · {percent(e.creator.graduationRate===null?null:e.creator.graduationRate*100)}</p>
        <small>GMGN lifetime counts include this token and may span launchpads. Prior-token sample is filtered to launches created before this token; peak caps are as observed at this snapshot, not known at launch.</small>
        <div className="tt-research-table"><table><thead><tr><th>Prior token</th><th>Peak market cap</th><th>Launched</th></tr></thead><tbody>{e.creator.priorTokens.slice(0,10).map(t=><tr key={t.address}><td>{t.symbol} <Address value={t.address}/></td><td>{money(t.peakMarketCapUsd)}</td><td>{time(t.createdAt)}</td></tr>)}</tbody></table></div>
        {!e.creator.priorTokens.length&&<p>No prior-token rows available in this sample.</p>}<small>Showing up to 10 earlier launches from {count(e.creator.returnedTokenCount)} returned token rows. This is not the complete creator history.</small>
      </>}
      {tab==="wallets"&&<>
        <div className="tt-research-section-title"><h3>Holder & trader behavior</h3><span>Creator holds {percent(e.creatorShare===null?null:e.creatorShare*100)}</span></div>
        <small>GMGN tagged-wallet counts for this token, separate from the filtered sample below.</small>
        <div className="tt-wallet-counts">{Object.entries({creator_wallets:"Creator",bundler_wallets:"Bundler",rat_trader_wallets:"Insider",sniper_wallets:"Sniper",smart_wallets:"Smart money",renowned_wallets:"KOL"}).map(([key,label])=><span key={key}>{label}<b>{count(e.walletCounts[key])}</b></span>)}</div>
        <div className="tt-research-filters"><select aria-label="Wallet sample" value={sample} onChange={v=>setSample(v.target.value as typeof sample)}><option value="holders">Top holders</option><option value="traders">Top sellers by volume</option></select><select aria-label="Wallet tag" value={tag} onChange={v=>setTag(v.target.value)}><option value="all">All tags</option>{Object.entries(labels).filter(([k])=>k!=="kol").map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div className="tt-research-table"><table><thead><tr><th>Wallet / tags</th><th>Holds · USD / supply</th><th>Buys / sells · USD</th><th>Profit · realized / unrealized</th><th>Share Δ · pp</th><th>Last active</th></tr></thead><tbody>{wallets.map(w=><tr key={w.address}><td><Address value={w.address}/><div className="tt-wallet-tags">{w.tags.filter(t=>labels[t]).map(t=><span key={t}>{labels[t]}</span>)}</div></td><td>{money(w.holdingUsd)}<small>{percent(w.holdingShare===null?null:w.holdingShare*100)}</small></td><td>{money(w.buyUsd)} / {money(w.sellUsd)}</td><td>{money(w.realizedUsd)} / {money(w.unrealizedUsd)}<small>Total {money(w.profitUsd)}</small></td><td>{sample==="holders"&&e.comparison?.wallets.find(d=>d.address===w.address)?e.comparison.wallets.find(d=>d.address===w.address)!.shareDeltaPp.toFixed(2):"—"}</td><td>{time(w.lastActiveAt)}</td></tr>)}</tbody></table></div>
        {!wallets.length&&<p>{walletsReady?"No matching wallet rows in this sample. This does not establish absence.":"This wallet query was unavailable. No holdings or trades are inferred."}</p>}
        <small>Up to 20 rows per query; {e.excludedPoolRows} pool/exchange rows excluded. Buys, sells and profit are provider cumulative token metrics, not five-minute flow. Tags overlap and are not verified identities or automatic alpha.</small>
        {e.comparison&&<small>Share changes compare wallets present in both holder samples against {time(e.comparison.previousAt)}. Transfers, pool activity and sample changes can affect the result.</small>}
      </>}
      {tab==="flow"&&<>
        <div className="tt-research-section-title"><h3>Buy / sell pressure</h3><span><i className="tt-flow-buy-key"/> Buy <i className="tt-flow-sell-key"/> Sell</span></div>
        <div className="tt-flow-windows">{e.flow.map(w=><div key={w.window}><strong>{w.window}</strong><div className="tt-flow-bars"><span>{money(w.buyUsd)} <small>buy</small></span><span>{money(w.sellUsd)} <small>sell</small></span><div aria-label={`${w.window} buy versus sell share`} className="tt-flow-bar">{w.buyUsd!==null&&w.sellUsd!==null&&w.buyUsd+w.sellUsd>0&&<><i style={{width:(w.buyUsd/(w.buyUsd+w.sellUsd)*100)+"%"}}/><i style={{width:(w.sellUsd/(w.buyUsd+w.sellUsd)*100)+"%"}}/></>}</div></div><span className="tt-flow-net">{money(w.netUsd)}<small>Net USD</small></span><span>{percent(w.priceChangePct)}<small>Price change</small></span><span>{count(w.swaps)}<small>Swaps</small></span></div>)}</div>
        <small>Rolling windows overlap. Bars show buy/sell share within each window, not comparable absolute volume. Net flow = buy USD − sell USD.</small>
        <details className="tt-research-events"><summary>Smart-money trade events · {eventsReady?e.events.length+" matching this token":"unavailable"}</summary>{e.events.map((event,i)=><div key={event.tx||i}><b>{event.side.toUpperCase()}</b><span>{money(event.usd)}</span><Address value={event.wallet}/><time>{time(event.time)}</time>{event.tx&&<a href={`https://bscscan.com/tx/${event.tx}`} target="_blank" rel="noreferrer">Transaction <ExternalLink size={11}/></a>}</div>)}{!e.events.length&&<p>{eventsReady?"No matching events in the latest 100 BSC smart-money events sampled. This is not a complete token trade feed.":"The smart-money event query was unavailable. This is missing evidence, not zero activity."}</p>}</details>
      </>}
      {tab==="pool"&&<>
        <div className="tt-research-section-title"><h3>Exit capacity</h3><Address value={e.pool.address}/></div>
        <dl className="tt-depth-grid"><div><dt>Exchange</dt><dd>{e.pool.exchange||"Unavailable"}</dd></div><div><dt>Pool created</dt><dd>{time(e.pool.createdAt)}</dd></div><div><dt>Base reserve</dt><dd>{count(e.pool.baseReserve)}<small>{money(e.pool.baseUsd)}</small></dd></div><div><dt>Quote reserve · {e.pool.quoteSymbol||"unknown"}</dt><dd>{count(e.pool.quoteReserve)}<small>{money(e.pool.quoteUsd)} · <Address value={e.pool.quoteAddress}/></small></dd></div><div><dt>$50 sell · estimated impact</dt><dd>{percent(e.pool.impact50Pct)}</dd></div><div><dt>$150 sell · estimated impact</dt><dd>{percent(e.pool.impact150Pct)}</dd></div></dl>
        <small>Constant-product illustration for Pancake V2 only: sell notional ÷ (base reserve USD + sell notional). Excludes fees, taxes, routing, MEV and changing reserves; not an executable quote or position limit. Paper fills still use the existing fixed assumptions.</small>
        {decisionPool&&e.pool.address&&decisionPool.toLowerCase()!==e.pool.address&&<p className="tt-research-warning">GMGN’s pool differs from this decision’s execution pool. Do not apply this depth estimate to that fill.</p>}
      </>}
    </div>
    <details className="tt-research-provenance"><summary>Field availability & observation receipts</summary><p>Requested {time(e.startedAt)} · bundle completed {time(e.completedAt)}. Provider snapshot time is not supplied; receipt times do not guarantee real-time chain state.</p>{e.sources.map(s=><details key={s.key}><summary>{receipts[s.key]||s.key} · {s.status} · {Object.values(s.availability).filter(v=>v==="present").length}/{Object.keys(s.availability).length} fields available</summary><small>Request {time(s.requestedAt)} · received {time(s.receivedAt)}</small><div className="tt-field-list">{Object.entries(s.availability).map(([field,status])=><div key={field}><code>{field}</code><span>{status==="present"?"Available":"Unavailable"}</span></div>)}</div></details>)}<p>Raw responses and observation times are archived server-side. New thresholds remain unvalidated; no historical results are reconstructed using today’s holder or creator data.</p></details>
  </div>;
}
