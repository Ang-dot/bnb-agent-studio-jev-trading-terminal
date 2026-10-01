import type { MonitorTrigger } from "./monitoring.js";
import type { SupportingEvidence } from "./enrichment.js";
import type { ResearchInput } from "./research-input.js";
import type { MemoryEpisode } from "./memory.js";
import type { NarrativeResearch, TokenNarrativeMetadata } from './narrative.js';
export type Action = "buy" | "sell" | "hold";
export interface Pool {
  address: string;
  token: string;
  name: string;
  symbol: string;
  dex: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  change1h: number | null;
  change24h: number | null;
  buys: number | null;
  sells: number | null;
  discoveredAt: number;
  url: string;
  launchQuote?: LaunchQuote;
  narrativeMetadata?: TokenNarrativeMetadata;
  marketData?: {
    source: 'GMGN'; requestedAt: number; receivedAt: number;
    providerAsOf: null; priceScope: 'token'; metricsScope: 'token';
  };
}
// An observed token mark for paper simulation; never a DEX pool or executable quote.
export interface LaunchQuote {
  kind: 'launch-indicative'; token: string; platform: 'flap' | 'fourmeme';
  stage: 'new' | 'bonding' | 'graduated_reported'; observedAt: number;
  providerAsOf: null; riskFlags: string[]; activity?: import('./monitoring.js').LaunchActivity;
}
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface EntrySetup {
  lookbackMinutes?: 5 | 30;
  candleIntervalMs?: 60000;
  competingTickers?: number;
  token: string; observedAt: number; marketCapUsd: number | null;
  rangeLowUsd: number | null; distanceFromLowPct: number | null;
  candleFrom: number | null; candleTo: number | null;
  source: 'GMGN';
}
export interface Snapshot {
  entrySetup?: EntrySetup;
  position?: { quantity: number; costUsd: number; returnPct: number; takeProfits: number };
  monitoring?: MonitorTrigger;
  pool: string;
  token: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  change1h: number | null;
  buyCount: number | null;
  sellCount: number | null;
  observedAt: number;
  marketAt: number;
  source: "bitquery" | "geckoterminal" | "coingecko" | "gmgn-paper";
  launchQuote?: LaunchQuote;
  tradeEvidence?: {
    kind:'pool-trade';network:'bsc';pool:string;token:string;
    txHash:string;blockNumber:number;requestedAt:number;receivedAt:number;
  };
  // Optional for backward compatibility with already-recorded snapshots.
  metricsSource?: 'GMGN' | 'GeckoTerminal';
  metricsScope?: 'token' | 'pool';
  metricsReceivedAt?: number;
  candleId: string;
}
export interface Judgment {
  action: Action;
  confidence: number;
  probabilities: Record<Action, number>;
  quality: number;
  toxic: number;
  model: string;
  requestId: string;
  costUsd: number;
  assessmentVersion?: "evidence-v1";
  assessments?: EvidenceAssessment[];
  assessmentIssues?: string[];
}
export interface EvidenceAssessment {
  id: string;
  label: string;
  kind: "context" | "x" | "memory" | "research";
  evidenceIds: string[];
  referenceId?: string;
  question: string;
  value: string;
  valueLabel: string;
  confidence: number;
  probabilities: Record<string, number>;
  options: Record<string, string>;
  criteria: Record<string, string>;
}
export interface Memory {
  localProvenance?: {episodeIds:string[];kinds:string[];includesOutcome:boolean};
  pageId: string;
  slug: string;
  title: string;
  summary: string;
  preview?: string;
  similarity: number | null;
  provider?: 'mem9' | 'living-brain';
  searchScore?: number;
  sourceHash?: string;
  episodeKind?: 'decision' | 'observation' | 'outcome' | 'review';
  episodeToken?: string;
  recordedAt?: number;
  outcome?: string;
  limitation?: string;
  status: string;
}
export interface XSource {
  url: string;
  postId: string;
  handle: string | null;
  publishedAt: number;
  timestampSource: "post-id";
  summary: string;
  identityExcerpt: string;
}
export interface XResearchUsage {
  since: number; providerRequests: number; acceptedSearchReceipts: number;
  reportedCostUsd: number; cacheHits: number; coalesced: number; failures: number;
}
export interface XResearch {
  delivery?: 'fresh' | 'cache' | 'shared';
  refreshAt?: number;
  narrative?: NarrativeResearch;
  failureKind?: "timeout" | "http" | "validation" | "network" | "configuration";
  token: string;
  status: "ready" | "no_results" | "unverified" | "error";
  detail: string;
  model: string;
  requestId?: string;
  window: { from: number; to: number };
  collectedAt: number;
  expiresAt: number;
  searchCalls: number;
  sources: XSource[];
  rejectedCount: number;
  costUsd?: number;
}
export interface Position {
  investedUsd?: number;
  acquiredQuantity?: number;
  realizedProceedsUsd?: number;
  principalRecovered?: boolean;
  peakNetUnitUsd?: number;
  takeProfits?: number;
  entries?: number;
  lastEntryAt?: number;
  pool: string;
  token: string;
  name: string;
  quantity: number;
  costUsd: number;
  openedAt: number;
}
export interface Fill {
  priceSource?: Snapshot['source'];
  launchQuote?: LaunchQuote;
  modeledFeeBps?: number;
  modeledSlippageBps?: number;
  reason?: string;
  fraction?: number;
  id: string;
  decisionId: string;
  pool: string;
  name: string;
  side: "buy" | "sell";
  priceUsd: number;
  quantity: number;
  feeUsd: number;
  time: number;
  mode: "paper";
  realizedPnlUsd: number;
}
export interface Ledger {
  cashUsd: number;
  initialCashUsd: number;
  positions: Position[];
  fills: Fill[];
  consumedDecisions: string[];
  realizedPnlUsd: number;
  dailyLoss: Record<string, number>;
}
export interface Decision {
  assessmentReceipt?: AssessmentReceipt;
  memoryReadAt?: number;
  memoryEpisodeId?: string;
  researchInput?: ResearchInput;
  supportingEvidence?: SupportingEvidence;
  supportingEvidenceAt?: number;
  fill?: Fill;
  ruleExit?: string;
  id: string;
  time: number;
  pool: string;
  name: string;
  action: Action;
  status: "executed" | "held" | "not_evaluated";
  reasons: string[];
  snapshot?: Snapshot;
  executionSnapshot?: Snapshot;
  research?: XResearch;
  judgment?: Judgment;
  memories: Memory[];
  memoryStatus: string;
  checks: Check[];
  intent?: Record<string, unknown>;
  memoryCapture?: string;
  executionContext?: {
    inspectionOnly: boolean;
    running: boolean;
    halted: boolean;
  };
}
export interface AssessmentStage {
  name: string;
  startedAt: number;
  durationMs: number;
  status: 'completed' | 'failed';
}
export interface AssessmentReceipt {
  service: 'BNB Agent Studio';
  runtimeVersion: string;
  serviceVersion: string;
  transport: 'private-http';
  requestId: string;
  outcome: 'completed' | 'skipped' | 'duplicate';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  stages: AssessmentStage[];
}
export interface AssessmentServiceInfo {
  name: 'BNB Agent Studio';
  runtimeVersion: string;
  serviceVersion: string;
  state: 'ready' | 'unavailable';
  visibility: 'backend-only';
  payments: false;
  completedRequests: number;
  lastCompletedAt?: number;
}
export interface Check {
  label: string;
  pass: boolean;
  detail: string;
}
export interface ProviderStatus {
  name: string;
  state: "ready" | "missing" | "error" | "configured";
  detail: string;
  checkedAt?: number;
}
export interface AgentState {
  memoryEpisodes?: MemoryEpisode[];
  paperSession?: string;
  revision: number;
  approvedPools: string[];
  running: boolean;
  paperArmRelease?: string;
  halted: boolean;
  ledger: Ledger;
  decisions: Decision[];
  lastCycleAt: number | null;
}
export interface TerminalState extends AgentState {
  xResearchUsage?: XResearchUsage;
  edition?: 'kbw' | 'token2049';
  memoryProvider?: 'MEM9' | 'Living Brain';
  workerActive?: boolean;
  assessmentService?: AssessmentServiceInfo;
  access?: { operator: boolean };
  exitError?: string | null;
  pools: Pool[];
  providers: ProviderStatus[];
  busy: boolean;
  discoveryError: string | null;
  database: string;
  sdk: {
    version: string;
    chainId: number;
    registration: Record<string, unknown>;
    walletAddress: string | null;
  };
  liveBlockers: string[];
}
