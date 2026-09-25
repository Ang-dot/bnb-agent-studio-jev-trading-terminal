export interface ResearchSection {
  id: 'Rcreator' | 'Rwallets' | 'Rflow' | 'Rdepth';
  label: string;
  availability: 'available' | 'partial' | 'unavailable';
  facts: Record<string, unknown>;
  caveats: string[];
  receipts: {key:string;requestedAt:number;receivedAt:number;providerAsOf:null}[];
}
export interface ResearchInput {
  version:'bsc-context-v1';
  evidenceId:string;
  token:string;
  cutoffAt:number;
  validation:string;
  sections:ResearchSection[];
}
