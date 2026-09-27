import { describe, expect, it } from 'vitest';
import { inspectFile } from '../scripts/check-repository.mjs';

describe('publication source hygiene', () => {
  it('allows source files and blank example configuration', () => {
    expect(inspectFile('src/App.tsx', 'export const demo = true;')).toEqual([]);
    expect(inspectFile('.env.example', 'OPENROUTER_API_KEY=\nPORT=8787')).toEqual([]);
  });
  it('rejects operational files even if someone force-adds them', () => {
    for (const path of ['.env.local', 'nested/.env.hosting.local', '.data/monitor.json', '.local-notes/qa.md', '.createos.json', 'dump.sqlite', '.npmrc', 'keys/operator.pem']) {
      expect(inspectFile(path, '')).toContain('private/local file');
    }
  });
  it('detects credentials and personal paths without returning their values', () => {
    const key = ['sk', 'or', 'v1'].join('-') + '-' + 'a'.repeat(64);
    const findings = inspectFile('src/bad.ts', key);
    expect(findings).toContain('OpenRouter credential');
    expect(JSON.stringify(findings)).not.toContain(key);
    expect(inspectFile('notes.md', '/Users' + '/someone/project')).toContain('personal absolute path');
    expect(inspectFile('.env.example', 'OPENROUTER_API_KEY=' + key)).toContain('OpenRouter credential');
  });
});
