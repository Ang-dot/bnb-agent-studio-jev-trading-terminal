import type { DecisionComparison } from './DecisionImpact.js';
import { recordedEvaluations, storyFor, sourceTitle, sourceAttribution, sourceSummary, type RecordedEvaluation } from './recorded-cases.js';
import { getHistoricalPrices, closedAsOf } from './historical-prices.js';

export type Source = {
  id: string;
  title: string;
  attribution: string;
  url: string;
  publishedAt: string;
  kind: 'example';
  note: string;
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type ReplayActionLabel = 'WAIT' | 'REVIEW' | 'ENTRY' | 'HOLD' | 'EXIT' | 'SKIP';
export type ReplayStep = {
  id: string;
  label: string;
  date: string;
  action: ReplayActionLabel;
  candleIndex: number;
  title: string;
  reason: string;
  withoutMemory: string;
  withMemory: string;
  changed: string;
  retained: string;
  unresolved: string;
  activeNodes: string[];
  sourceIds: string[];
};
export type MemoryNode = {
  id: string;
  label: string;
  type: 'research' | 'decision' | 'entity' | 'caveat' | 'event';
  summary: string;
  sourceIds: string[];
  x: number;
  y: number;
};
export type CaseStudy = {
  id: string;
  ticker: string;
  name: string;
  color: string;
  date: string;
  summary: string;
  sources: Source[];
  candles: Candle[];
  steps: ReplayStep[];
  memory: MemoryNode[];
  comparison: DecisionComparison;
  evaluation: RecordedEvaluation;
};


export const SOURCE_NOTICE = 'For education only, not financial advice. Token names and icons are placeholders. BNB Chain does not endorse the tokens shown.';
export const DEMO_NOTICE = 'Asset names, images, contracts, named participants and source links are replaced or omitted for this educational presentation. The historical chart values and recorded model outputs are retained. Curated historical model comparisons for a developer demonstration. JEV was evaluated offline with and without reconstructed prior context. WATCH and ENTRY are recorded model outputs, not instructions to trade. Public participation in a discussion does not establish token endorsement. The memory packets and 3D graph illustrate the proposed Living Brain integration; they are not recorded Living Brain API responses.';
export const PRICE_NOTICE = 'GMGN historical candles · UTC · FDV uses total supply · assessment-time reference, no executed fill';

export const cases: CaseStudy[] = recordedEvaluations.map(record => {
  const history = getHistoricalPrices(record.caseId);
  if (!history) throw new Error(`Missing historical chart: ${record.caseId}`);
  const story = storyFor(record.caseId), candidate = record.candidate;
  const facts = [...candidate.memoryEvidence, ...candidate.currentEvidence];
  const sources: Source[] = facts.map(fact => ({id:fact.id,title:sourceTitle(fact.id),attribution:sourceAttribution(fact.url),url:fact.url,publishedAt:fact.availableAt,kind:'example',note:sourceSummary(fact)}));
  const memory: MemoryNode[] = facts.map((fact,index) => ({id:fact.id,label:sourceTitle(fact.id),type:candidate.currentEvidence.includes(fact)?'event':'research',summary:sourceSummary(fact),sourceIds:[fact.id],x:18+(index%3)*30,y:20+Math.floor(index/3)*26}));
  memory.push({id:`${record.caseId}-decision`,label:'JEV · model output',type:'decision',summary:'The stored JEV responses change from WATCH to ENTRY when the earlier evidence is supplied. This is an offline model assessment under the configured policy. It does not turn a source author’s words into trading instructions, and no trade was executed.',sourceIds:[],x:52,y:79});
  const comparison: DecisionComparison = {status:'tested',eventTitle:story.event,eventTime:candidate.currentEvidence[0].publishedAt,model:record.model,contextTitle:story.link,contextSummary:story.summary,sourceLimit:story.sourceLimit,memories:candidate.memoryEvidence.map(fact=>({id:fact.id,title:sourceTitle(fact.id),date:fact.availableAt,url:fact.url,relationship:story.relationships[fact.id]??'Earlier context supplied to JEV.'})),without:{action:'WATCH',summary:story.without,entryProbability:record.withoutEntryProbability},with:{action:'ENTRY',summary:story.with,entryProbability:record.withEntryProbability},repeats:record.repeatCount,receiptUrl:record.receiptUrl};
  const candleIndex=closedAsOf(history.eventCandles,60,record.cutoff).length-1;
  const steps: ReplayStep[] = ['New event','Recall context','JEV decision'].map((label,index)=>({
    id:`${record.caseId}-${index}`,label,date:record.cutoff,action:index===2?'ENTRY':'WAIT',candleIndex,
    title:[story.event,story.link,'Prior context changes the model assessment'][index],
    reason:[sourceSummary(candidate.currentEvidence[0]),story.summary,story.with][index],
    withoutMemory:story.without,withMemory:story.with,changed:story.summary,
    retained:'The same new event, historical price snapshot, JEV model and assessment policy are used in both conditions.',
    unresolved:'Execution checks, liquidity, taxes and position sizing are separate. No order or historical fill is asserted.',
    activeNodes:index===0?candidate.currentEvidence.map(fact=>fact.id):index===1?facts.map(fact=>fact.id):memory.map(node=>node.id),
    sourceIds:index===0?candidate.currentEvidence.map(fact=>fact.id):facts.map(fact=>fact.id),
  }));
  return {id:record.caseId,ticker:candidate.token.symbol,name:story.name,color:'#F0B90B',date:record.cutoff,summary:story.summary,sources,candles:history.eventCandles,steps,memory,comparison,evaluation:record};
});
export const DEFAULT_CASE_ID = cases.find(study=>study.id==='coin1')?.id ?? cases[0].id;
export function getCase(id: string): CaseStudy {return cases.find(study=>study.id===id)??cases.find(study=>study.id===DEFAULT_CASE_ID)!;}
export function sourceAvailableAt(source: Source): number {
  if (/^\d{4}-\d{2}$/.test(source.publishedAt)) {const [year,month]=source.publishedAt.split('-').map(Number);return Date.UTC(year,month,1)-1;}
  if (/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt)) return Date.parse(`${source.publishedAt}T23:59:59.999Z`);
  return Date.parse(source.publishedAt);
}
