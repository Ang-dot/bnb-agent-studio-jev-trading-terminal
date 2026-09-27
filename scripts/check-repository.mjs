// Source-only hygiene guard. Findings print rule names, never matched secrets.
// This complements (not replaces) Gitleaks and a publication review.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const privatePath = /(?:^|\/)(?:\.env(?:\..+)?|\.dev\.vars(?:\..+)?|\.npmrc|\.netrc|\.?createos\.json|\.data|\.local-notes|\.runtime[^/]*|node_modules|dist|coverage|backups|exports|artifacts|test-results|playwright-report|\.wrangler|\.aws|\.ssh|\.gmgn|\.createos|\.tidbcloud|\.codex|\.agents|\.idea|\.vscode)(?:\/|$)|\.(?:sqlite(?:-[^/]*)?|db|pem|key|p12|pfx|dump|bak|log|tar|tar\.gz|zip)$/i;
const secretRules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['OpenRouter credential', /sk-or-v1-[a-f0-9]{32,}/i],
  ['GMGN credential', /gmgn_[a-z0-9]{24,}/i],
  ['Living Brain credential', /lbk_[A-Za-z0-9_-]{20,}/],
  ['GitHub credential', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['AWS access credential', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['credential-bearing URL', /\b(?:mysql|postgres(?:ql)?|https?):\/\/[^\s/:]+:[^\s/@]+@/],
  ['personal absolute path', /(?:\/Users|\/home)\/[^\s/]+\//],
];

export function inspectFile(path, content) {
  const findings = [];
  if (path !== '.env.example' && privatePath.test(path)) findings.push('private/local file');
  for (const [label, pattern] of secretRules) if (pattern.test(content)) findings.push(label);
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Include prospective source files, not just the current index. Force-added
  // private files remain visible here even when ignore rules would exclude them.
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
  const findings = [];
  let inspected = 0;
  for (const file of files) {
    if (!existsSync(file)) continue; // A tracked deletion is not a release file.
    if (lstatSync(file).isSymbolicLink()) { findings.push({ file, rule: 'symlink requires review' }); continue; }
    const buffer = readFileSync(file);
    const content = buffer.includes(0) ? '' : buffer.toString('utf8');
    for (const rule of inspectFile(file, content)) findings.push({ file, rule });
    inspected++;
  }
  console.log(JSON.stringify({ inspected, findings }, null, 2));
  if (findings.length) process.exitCode = 1;
}
