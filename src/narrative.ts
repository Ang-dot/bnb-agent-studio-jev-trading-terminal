export interface TokenNarrativeMetadata {
  token: string;
  name: string;
  symbol: string;
  description: string | null;
  reportedXHandle: string | null;
  reportedXUrl?: string | null;
  source: 'GMGN';
  requestedAt: number;
  receivedAt: number;
}

export interface ThemeSource {
  url: string;
  postId: string;
  handle: string | null;
  publishedAt: number;
  timestampSource: 'post-id';
  summary: string;
}

export const narrativeDimensions = {
  fit: 'Ticker & description fit',
  catalyst: 'Current catalyst',
  originality: 'Originality & copycats',
  timing: 'Timing',
  community: 'Community discussion',
  kol: 'KOL amplification',
  promotion: 'Promotion & repetition',
} as const;
export type NarrativeDimension = keyof typeof narrativeDimensions;
export interface NarrativeFinding {
  verdict: 'supports' | 'cautions' | 'unknown';
  summary: string;
  evidenceIds: string[];
}

export interface NarrativeResearch {
  version: 'narrative-v1';
  status: 'ready' | 'unavailable';
  metadata: TokenNarrativeMetadata;
  angle: string | null;
  themeSources: ThemeSource[];
  findings: Record<NarrativeDimension, NarrativeFinding> | null;
  spreadSample: {
    posts: number;
    authors: number;
    unknownAuthors?: number;
    largestAuthorShare: number | null;
  };
  issues: string[];
}
