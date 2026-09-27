import type { Decision } from './types.js';
import { frontendRoute, type FrontendEdition } from './frontend-route.js';
import { apiPath } from './api-path.js';

export const REPOSITORY_URL = 'https://github.com/Ang-dot/bnb-agent-studio-jev-trading-terminal';
export const architectureComponents = {
  studio: {name:'BNB Agent Studio', tagline:'From custom logic to a reusable agent service.', role:'Serves the research, memory and JEV assessment as one bounded request.', advantage:'A replaceable work hook, a defined deadline and a consistent delivery boundary.', demo:'Private runtime inside NodeOps. No payment or public inference endpoint.', note:'Authentication and receipts are provided by our application adapter.', step:1},
  sdk: {name:'BNB Agent SDK', tagline:'A chain-native foundation, separate from the model.', role:'Provides BNB Chain context, draft identity metadata and the unsigned intent / executor interface.', advantage:'A shared chain interface separates what the model proposes from what execution code is allowed to do.', demo:'Chain constants and unsigned intents are integrated. No live signer, registered identity or live swap is enabled.', note:'ERC-8004 metadata is a draft, not an on-chain registration. Commerce and payment rails are not activated.', step:1},
  gmgn: {name:'GMGN', tagline:'See a launch before deciding whether to chase it.', role:'Discovers Flap and Four.meme launches, tracks graduation and supplies charts, creator, holder, flow and depth context.', advantage:'Combines launch lifecycle and wallet behavior in one evidence source. A volume spike can be considered alongside who is holding and selling.', demo:'Observe new launches; qualify after GMGN-reported graduation. Optional enrichment keeps its timestamps and missing fields.', note:'GMGN charts are token-wide. They are not substituted for a timestamped trade from the selected execution pool.', step:0},
  grok: {name:'Grok / X', tagline:'Put the market move in its narrative context.', role:'Collects cited social research matched to the token contract within a bounded time window.', advantage:'Adds the story, claims and counter-evidence that numeric liquidity and swap thresholds cannot describe.', demo:'Accepted citations enter the assessment. Reviewed research can be captured with the episode for future recall.', note:'A cited post is evidence of a claim, not proof that the claim is true. Invalid or unavailable research is not fabricated.', step:0},
  geckoterminal: {name:'GeckoTerminal API', tagline:'Anchor the decision to the right pool and time.', role:'Supplies timestamped, same-pool trade prices for assessment snapshots, paper fills and outcome observations.', advantage:'Keeps pool identity and trade time explicit, so a fresh API response is not mistaken for a fresh trade.', demo:'REST pool trades complement GMGN context. A shared 60-second cache and durable 9,000-request monthly app guard support targeted demos.', note:'Demo freshness starts from 60 seconds, not a high-frequency feed. Missing or stale trades cannot price a fill. An observed trade is not an executable quote.', step:0},
  jev: {name:'JEV by TypeSafe', tagline:'Context-aware judgment, not another fixed threshold.', role:'Assesses the current snapshot, cited research and recalled episodes to return a typed BUY, SELL or HOLD judgment.', advantage:'Combines mixed contextual evidence on repeated assessments; a threshold alone cannot interpret a narrative or a relevant prior outcome.', demo:'JEV proposes actions and source assessments. The terminal separates model output from policy checks and actual paper fills.', note:'API round-trip time is not model-internal inference latency. Fast judgment does not imply sub-second end-to-end execution or trading edge.', step:1},
  memory: {name:'Living Brain', tagline:'Give the next assessment access to past experience.', role:'Recalls relevant episodes before JEV judges; ingests observations, decisions, research and linked outcomes afterward.', advantage:'Retains context across assessments, including HOLDs and no-fill decisions—not just trades that look successful.', demo:'A durable outbox tracks accepted, compiling, compiled and later-recalled episodes. Available follow-up marks are linked to their source.', note:'Capture is asynchronous. Recall is not model retraining, and a recalled page does not prove that memory improved returns.', step:3},
  paper: {name:'Paper policy + execution', tagline:'Let JEV judge. Keep permission and money rules in code.', role:'Rechecks freshness, session state, capital, sizing and inventory before recording a simulated fill.', advantage:'An inspectable boundary prevents a model response from bypassing limits or turning a paused session into an order.', demo:'Paper simulation only. JEV can propose exits; separate deterministic protection rules remain active when execution is armed.', note:'Live execution is locked. Fees and slippage are simulation assumptions, not guaranteed prices or achievable returns.', step:2},
  nodeops: {name:'NodeOps', tagline:'A persistent runtime beyond the browser session.', role:'Hosts the application worker and embedded private Studio service in one container.', advantage:'Discovery and assessment can run without a visitor keeping the terminal open.', demo:'One worker owns the durable lease. The private Studio listener is not exposed as a public inference API.', note:'This is custom hosting, not a managed Agent Studio cloud deployment or an independently isolated agent process.', step:1},
  nodereal: {name:'NodeReal', tagline:'A read-only window into BNB Chain.', role:'Provides RPC access for an explicit on-demand chain connectivity check.', advantage:'Offers a chain-level diagnostic separate from the market-data and model providers.', demo:'An operator-only read check is wired. It is not a required request in every JEV assessment.', note:'NodeReal is not presented as the launch discovery source, graduation verifier or an enabled live trading service.', step:0},
} as const;
export type ArchitectureComponent = keyof typeof architectureComponents;
export function architectureForEdition(edition: FrontendEdition) {
  if (edition === 'token2049') return architectureComponents;
  return {
    ...architectureComponents,
    memory: {
      ...architectureComponents.memory,
      name: 'MEM9',
      demo: 'KBW uses an isolated journal and Mem9 app scope. Explicit episodes are stored with confirmed memory IDs and recalled through Mem9 search.',
      note: 'Direct storage and search use Mem9’s API. Ambiguous writes are reconciled by episode reference. Relevance scores are not outcome confidence or proof of better returns.',
    },
  };
}
export const architectureSteps: {label:string;description:string;component:ArchitectureComponent}[] = [
  {label:'Observe',description:'Find opportunities in real time',component:'gmgn'},
  {label:'Assess',description:'Turn evidence into a judgment',component:'studio'},
  {label:'Execute',description:'Apply rules in a controlled way',component:'paper'},
  {label:'Remember',description:'Capture outcomes for next time',component:'memory'},
];
export interface ArchitectureState {component:ArchitectureComponent;step:number;presenting:boolean}
export const initialArchitecture:ArchitectureState = {component:'studio',step:1,presenting:false};
type Action = {type:'select';component:ArchitectureComponent}|{type:'step';step:number}|{type:'present'|'exit'|'next'|'previous'};
export function architectureReducer(state:ArchitectureState,action:Action):ArchitectureState {
  if(action.type==='select')return {...state,component:action.component,step:architectureComponents[action.component].step};
  if(action.type==='exit')return {...state,presenting:false};
  const step=action.type==='present'?0:action.type==='step'?Math.max(0,Math.min(3,action.step)):Math.max(0,Math.min(3,state.step+(action.type==='next'?1:-1)));
  return {component:architectureSteps[step].component,step,presenting:action.type==='present'||state.presenting};
}
export const pageForPath=(path:string)=>frontendRoute(path).page;

// Explicit visitor action only: no polling, provider invocation or operator API.
export async function loadLatestReceipt(fetchImpl:typeof fetch=fetch,signal?:AbortSignal):Promise<Decision|null> {
  const response=await fetchImpl(apiPath('/api/state'),{method:'GET',cache:'no-store',signal});
  if(!response.ok)throw new Error('Recorded assessments are temporarily unavailable.');
  const data=await response.json();
  if(!Array.isArray(data.decisions))throw new Error('Recorded assessments are temporarily unavailable.');
  return data.decisions.filter((d:Decision)=>d.assessmentReceipt?.service==='BNB Agent Studio').sort((a:Decision,b:Decision)=>b.time-a.time)[0]??null;
}
