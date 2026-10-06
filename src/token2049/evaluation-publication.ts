/** Editorial context is separate from the immutable historical model inputs. */
export const HISTORICAL_POLICY_CONTEXT = 'These recorded comparisons used a narrative-attention screening policy. A new public interaction or clarification could qualify when source evidence connected it to the selected token. The runs measured how supplying earlier context changed JEV’s assessment.';
export const EVALUATION_SCOPE = 'The evaluations did not require measured community reaction, social sentiment or participation. They do not establish what caused a price move or what a source author intended.';
export const SOURCE_ATTRIBUTION_CONTEXT = 'Asset identities, named participants, contract addresses and direct source links are omitted from this presentation. Token names and icons are placeholders. BNB Chain does not endorse the tokens shown. This demo is not financial advice.';

export const EVALUATION_PUBLICATION_CONTEXT = {
  recordStatus: 'Redacted educational presentation',
  reviewedOn: '2026-10-06',
  demonstratedClaim: 'Earlier source-backed project and community context changed the recorded assessment of the same public event.',
  historicalPolicy: HISTORICAL_POLICY_CONTEXT,
  untestedClaims: EVALUATION_SCOPE,
  sourceAttribution: SOURCE_ATTRIBUTION_CONTEXT,
  originalRecord: 'Public downloads contain generalized source summaries and recorded output values. They omit the original model inputs and identifying source material. The underlying historical research is retained outside the published presentation.',
} as const;
