import type { HistoricalFact } from './recorded-cases.js';

/** These fixtures are reviewed, redacted presentation summaries, not original model inputs. */
export function sourceSummary(fact: HistoricalFact): string { return fact.content; }
