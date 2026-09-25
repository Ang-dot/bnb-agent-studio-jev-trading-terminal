export interface CaptureReceipt {id:string;status:'pending'|'compiling'|'completed'|'failed';affectedPageIds:string[];compiledAt?:string|null}
export interface MemoryEpisode {
  id:string; kind:'decision'|'observation'|'outcome'|'review';token:string;pool:string;name:string;createdAt:number;
  decisionId?:string; signature:string;summary:string;content:Record<string,unknown>;
  baseline?:{priceUsd:number;marketAt:number;action:string;executed:boolean};
  followUps:{minutes:number;dueAt:number;status:'waiting'|'observed'|'unavailable';detail?:string}[];
  capture:{status:'queued'|'retrying'|'pending'|'compiling'|'completed'|'failed';sourceId?:string;pageIds:string[];attempts:number;nextAt:number;checkedAt?:number;compiledAt?:number;detail?:string};
  recalledBy:{decisionId:string;at:number;pageId:string;assessment?:string}[];
}
