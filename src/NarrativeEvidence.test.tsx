import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {NarrativeEvidence, NarrativeSummary} from './NarrativeEvidence.js';
import type {EvidenceAssessment, XResearch} from './types.js';

const now = Date.parse('2026-10-01T10:00:00Z'), token = '0x' + '2'.repeat(40);
const unknown = () => ({verdict: 'unknown' as const, summary: 'Not established.', evidenceIds: []});
function fixture(): XResearch {
  return {token, status: 'no_results', detail: 'No matching posts returned.', model: 'fixture', window: {from: now - 86400000, to: now}, collectedAt: now, expiresAt: now + 300000, searchCalls: 2, sources: [], rejectedCount: 0,
    narrative: {version: 'narrative-v1', status: 'ready', angle: 'Lunar mission meme', metadata: {token, name: 'MOON', symbol: 'MOON', description: null, reportedXHandle: null, source: 'GMGN', requestedAt: now, receivedAt: now},
      findings: {fit: unknown(), catalyst: unknown(), originality: unknown(), timing: unknown(), community: unknown(), kol: unknown(), promotion: unknown()},
      themeSources: [{url: 'https://x.com/fixture/status/2103362829185974272', postId: '2103362829185974272', handle: 'fixture', publishedAt: now - 1000, timestampSource: 'post-id', summary: 'Space agency reports on the lunar mission.'}],
      spreadSample: {posts: 0, authors: 0, largestAuthorShare: null}, issues: []}};
}
const strong: EvidenceAssessment = {id: 'narrative_potential', label: 'Narrative potential', kind: 'context', evidenceIds: ['TOKEN', 'T1'], value: 'strong', valueLabel: 'Strong angle', confidence: .9, probabilities: {strong: .9, unknown: .1}, options: {strong: 'Strong angle', unknown: 'Unknown'}, criteria: {}, question: 'Fixture'};

describe('separate narrative and spread display', () => {
  it('shows an early strong angle without implying a trade or token endorsement', () => {
    const html = renderToStaticMarkup(<NarrativeEvidence research={fixture()} assessments={[strong]}/>);
    expect(html).toContain('Strong angle, no token spread observed');
    expect(html).toContain('a small paper probe may qualify');
    expect(html).toContain('0 contract-linked posts'); expect(html).toContain('0 identified authors');
    expect(html).toContain('id="evidence-T1"'); expect(html).toContain('id="evidence-TOKEN"');
    expect(html).toContain('do not establish discussion or endorsement of this token');
    expect(html).toContain('Description unavailable');
  });
  it('escapes adversarial names, descriptions and model claims', () => {
    const research = fixture(), attack = '<script>alert("token")</script>';
    research.narrative!.metadata.description = attack;
    research.narrative!.angle = attack;
    research.narrative!.findings!.fit.summary = attack;
    const html = renderToStaticMarkup(<NarrativeEvidence research={research}/>);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('distinguishes legacy records and failed narrative parsing from a weak angle', () => {
    const research = fixture(); delete research.narrative;
    expect(renderToStaticMarkup(<NarrativeEvidence research={research}/>)).toContain('not collected for this record');
    expect(renderToStaticMarkup(<NarrativeSummary research={research}/>)).toBe('');
    const failed = fixture(); failed.narrative!.status = 'unavailable'; failed.narrative!.findings = null; failed.narrative!.angle = null;
    failed.narrative!.issues = ['Narrative response missing or invalid.'];
    const html = renderToStaticMarkup(<NarrativeEvidence research={failed}/>);
    expect(html).toContain('Assessment unavailable'); expect(html).toContain('Narrative response missing or invalid');
    expect(html).not.toContain('Weak or conflicting angle');
  });
});
