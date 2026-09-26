import type { Decision, Pool } from '../../../src/types.js';
import type { MonitorTrigger } from '../../../src/monitoring.js';

export interface AssessmentJob {
  requestId: string;
  pool: Pool;
  monitoring?: MonitorTrigger;
}
export interface AssessmentGuard {
  assertActive(): Promise<void>;
}
export interface AssessmentResult {
  outcome: 'completed' | 'skipped' | 'duplicate';
  decision: Decision;
}
export interface AssessmentRunner {
  assess(pool: Pool, monitoring: MonitorTrigger | undefined, guard: AssessmentGuard): Promise<AssessmentResult>;
}
export const STUDIO_RUNTIME_VERSION = '0.0.14';
export const ASSESSMENT_SERVICE_VERSION = '1.0.0';
