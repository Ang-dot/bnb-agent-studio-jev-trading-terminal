export interface CaptureReceipt {id:string;status:'pending'|'compiling'|'completed'|'stored'|'unconfirmed'|'failed';affectedPageIds:string[];compiledAt?:string|null;availableAt?:string;contentHash?:string;detail?:string}
export interface MemoryEpisode {
  id:string; kind:'decision'|'observation'|'outcome'|'review';token:string;pool:string;name:string;createdAt:number;
  decisionId?:string; signature:string;summary:string;content:Record<string,unknown>;
  baseline?:{priceUsd:number;marketAt:number|null;action:string;executed:boolean};
  followUps:{minutes:number;dueAt:number;status:'waiting'|'observed'|'unavailable';detail?:string}[];
  capture:{status:'queued'|'retrying'|CaptureReceipt['status'];sourceId?:string;pageIds:string[];attempts:number;nextAt:number;checkedAt?:number;compiledAt?:number;availableAt?:number;contentHash?:string;statusChecks?:number;detail?:string};
  recalledBy:{decisionId:string;at:number;pageId:string;assessment?:string}[];
}
export interface JournalView {
  recent: MemoryEpisode[];
  token: MemoryEpisode[];
  linked?: MemoryEpisode;
  counts: { saved: number; available: number; recalled: number };
}
export const memoryAvailable = (capture:MemoryEpisode['capture']) => capture.status==='completed'||capture.status==='stored';
export const memoryAvailableAt = (capture:MemoryEpisode['capture']) => capture.availableAt??capture.compiledAt;
