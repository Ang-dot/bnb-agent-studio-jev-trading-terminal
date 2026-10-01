import { useState } from 'react';
import { Check, Clock3, Database, Fingerprint, RotateCcw, Sparkles } from 'lucide-react';
import { memoryAvailable, type MemoryEpisode } from './memory.js';
import { MemoryLogo, useFrontendEdition } from './FrontendEdition.js';
import './memory-journal.css';
const time=(n:number)=>new Date(n).toLocaleTimeString('en-GB');
const labels:Record<MemoryEpisode['capture']['status'],string>={queued:'Saved locally',retrying:'Retry scheduled',pending:'Accepted',compiling:'Compiling',completed:'Compiled',stored:'Stored in MEM9',unconfirmed:'Write unconfirmed',failed:'Needs attention'};
export function MemoryJournal({episodes,token,now,onDecision}:{episodes:MemoryEpisode[];token:string;now:number;onDecision:(id:string)=>void}){
 const {edition}=useFrontendEdition();
 const direct=edition==='kbw';
 const [scope,setScope]=useState<'token'|'all'>('token');
 const selected=episodes.filter(e=>scope==='all'||e.token===token||e.kind==='review');
 const counts={saved:episodes.length,compiled:episodes.filter(e=>memoryAvailable(e.capture)).length,recalled:episodes.filter(e=>e.recalledBy.length).length};
 return <section className='tt-experience' aria-label='Memory experience ledger'>
  <header><div><MemoryLogo/><span><h2>Experience ledger</h2><small>Observe. Remember. Revisit.</small></span></div><div className='tt-experience-scope'><button aria-pressed={scope==='token'} onClick={()=>setScope('token')}>This token</button><button aria-pressed={scope==='all'} onClick={()=>setScope('all')}>All</button></div></header>
  <div className='tt-experience-counts'><span><Database size={14}/><b>{counts.saved}</b> saved</span><span><Check size={14}/><b>{counts.compiled}</b> {direct?'stored':'compiled'}</span><span><RotateCcw size={14}/><b>{counts.recalled}</b> {direct?'retrieved for JEV':'recalled by JEV'}</span></div>
  <p className='tt-experience-caption'>HOLDs build experience too. Meaningful changes are saved; repeated unchanged ticks are deduplicated.</p>
  <div className='tt-experience-list'>{selected.slice(0,6).map(e=><article key={e.id} className={`tt-experience-item ${now-e.createdAt<12000?'tt-experience-new':''}`}>
    <span className='tt-experience-icon'>{e.kind==='outcome'?<Clock3 size={16}/>:e.kind==='review'?<Sparkles size={16}/>:<Fingerprint size={16}/>}</span>
    <div className='tt-experience-body'><div className='tt-experience-title'><strong>{e.name.split(' / ')[0]}</strong><span>{e.kind}</span><time>{time(e.createdAt)}</time></div><p>{e.summary}</p>
      <div className='tt-experience-stages'><span className='confirmed'>Saved</span><span className={memoryAvailable(e.capture)?'confirmed':e.capture.status==='failed'?'attention':'processing'}>{labels[e.capture.status]}</span><span className={e.recalledBy.length?'recalled':''}>{e.recalledBy.length?`${direct?'Retrieved':'Recalled'} in ${e.recalledBy.length} assessment${e.recalledBy.length===1?'':'s'}`:direct?'Not retrieved yet':'Not recalled yet'}</span></div>
      {!!e.followUps.length&&<div className='tt-experience-outcomes'>{e.followUps.map(f=><span key={f.minutes} title={f.detail}>{f.minutes}m outcome · {f.status==='waiting'?now<f.dueAt?`due ${time(f.dueAt)}`:'sampling pending':f.status}</span>)}</div>}
      {!!e.recalledBy.length&&<div className='tt-experience-recalled'>{e.recalledBy.slice(0,2).map(r=><button key={r.decisionId+r.pageId} onClick={()=>onDecision(r.decisionId)}><RotateCcw size={12}/>JEV {direct?'retrieved':'recalled'} {time(r.at)} · {r.assessment||'relevance not returned'}</button>)}</div>}
      <details><summary>Episode & receipts</summary><p>{e.capture.detail||(direct?'Storage is not proof of usefulness. Recall requires a matching memory ID and unchanged episode content.':'Compilation is not proof of usefulness. Recall is linked only when the returned page ID matches this source’s compiled pages.')}</p><small>Episode {e.id} · Source {e.capture.sourceId||'not confirmed'} · {e.capture.pageIds.length} linked pages{e.capture.checkedAt?` · checked ${time(e.capture.checkedAt)}`:''}</small>{e.decisionId&&<button onClick={()=>onDecision(e.decisionId!)}>View original decision</button>}<pre>{JSON.stringify(e.content,null,2)}</pre></details>
    </div>
  </article>)}</div>
  {!selected.length&&<div className='tt-experience-empty'><Database size={20}/><span>{episodes.length?'No saved episodes for this token yet. Select All to inspect the session.':'The next eligible observation or assessment will start building experience—even without a fill.'}</span></div>}
  <small className='tt-experience-disclaimer'>Follow-up marks are gross price changes, not achievable P&L. {direct?'Stored episode IDs link later recalls to their source.':'Compiled pages may combine several episodes.'} No claim of improved returns.</small>
 </section>;
}
