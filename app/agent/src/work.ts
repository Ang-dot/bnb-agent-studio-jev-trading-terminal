import { AssessmentBlockedError } from '../../../server/assessment-signal.js';
import { isLaunchPaper } from '../../../src/paper-settings.js';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Decision, AssessmentStage } from '../../../src/types.js';
import type { SupportingEvidence } from '../../../src/enrichment.js';
import type { Providers } from '../../../server/providers.js';
import type { Store } from '../../../server/store.js';
import type { MemoryLoop } from '../../../server/memory-loop.js';
import { researchInput } from '../../../server/research-input.js';
import { netExitUnit } from '../../../server/policy.js';
import { CoinGeckoError } from '../../../server/coingecko.js';
import type { AssessmentGuard, AssessmentJob, AssessmentResult } from './assessment.js';

export interface WorkResult extends AssessmentResult {
  stages: AssessmentStage[];
  startedAt: number;
  completedAt: number;
  durationMs: number;
}
export type AssessmentWork = (job: AssessmentJob, guard: AssessmentGuard) => Promise<WorkResult>;

// Studio's custom work hook owns evidence preparation and model assessment.
// It can read portfolio context, but cannot mutate the ledger or execute orders.
export function createAssessmentWork(deps: {
  providers: Providers;
  store: Pick<Store, 'read'>;
  evidence?: (token: string, at: number) => SupportingEvidence | undefined | Promise<SupportingEvidence | undefined>;
  annotate?: MemoryLoop['annotate'];
  reserveModelCall?: (inventory:boolean)=>boolean;
}): AssessmentWork {
  return async (job, guard) => {
    const { providers, store } = deps, pool = job.pool;
    const memoryProvider = providers.memoryProvider ?? 'Living Brain';
    const startedAt = Date.now(), started = performance.now(), stages: AssessmentStage[] = [];
    let stage = 'Provider configuration';
    const decision: Decision = {
      id: job.requestId, time: startedAt, pool: pool.address, name: pool.name,
      action: 'hold', status: 'not_evaluated', reasons: [], memories: [], memoryStatus: 'Not queried', checks: [],
    };
    const finish = (outcome: AssessmentResult['outcome']): WorkResult => ({
      outcome, decision, stages, startedAt, completedAt: Date.now(), durationMs: Math.round(performance.now() - started),
    });
    const run = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
      stage = name;
      await guard.assertActive();
      const entry: AssessmentStage = { name, startedAt: Date.now(), durationMs: 0, status: 'completed' };
      const at = performance.now(); stages.push(entry);
      try { return await work(); }
      catch (error) { entry.status = 'failed'; throw error; }
      finally { entry.durationMs = Math.round(performance.now() - at); }
    };
    try {
      await guard.assertActive();
      const missing = [...(isLaunchPaper(pool.address) ? [] : [providers.priceProvider]), 'Jev', memoryProvider, 'Grok / X'].filter(name => providers.statuses.get(name)?.state === 'missing');
      if (missing.length) {
        decision.reasons = [`Connect ${missing.join(', ')} to run Jev + memory. No model call or paper fill was made.`];
        return finish('skipped');
      }
      // Detect an already-assessed market minute before metadata/X work. Refresh again
      // after research: a slow X request must never age the preflight mark into a fill.
      const preflight=await run('Market preflight',async()=>{
        const fresh=await providers.pool(pool.address,pool.token);
        return {pool:fresh,snapshot:await providers.snapshot(fresh)};
      });
      if(preflight.snapshot.pool.toLowerCase()!==pool.address.toLowerCase()||preflight.snapshot.token.toLowerCase()!==pool.token.toLowerCase())throw new Error('Preflight identity mismatch');
      const preflightId=createHash('sha256').update(`paper-v1:${preflight.snapshot.candleId}`).digest('hex').slice(0,24);
      if((await store.read()).decisions.some(d=>d.id===preflightId)) return finish('duplicate');
      decision.research = await run('Grok / X', () => providers.research(preflight.pool));
      if (!['ready', 'no_results'].includes(decision.research.status)) {
        stages[stages.length - 1].status = 'failed';
        decision.reasons = [decision.research.detail, 'X evidence unavailable; no Jev call or execution.'];
        return finish('skipped');
      }
      const fresh = await run('GMGN market observation', () => providers.pool(pool.address, pool.token));
      decision.snapshot = await run(isLaunchPaper(pool.address) ? 'GMGN indicative paper mark' : providers.priceProvider, () => providers.snapshot(fresh,{entryContext:true,freshPrice:true}));
      if (decision.snapshot.pool.toLowerCase() !== pool.address.toLowerCase() || decision.snapshot.token.toLowerCase() !== pool.token.toLowerCase())
        throw new Error('Snapshot identity mismatch');
      const state = await store.read();
      const position = state.ledger.positions.find(p => p.pool === pool.address);
      if (position) decision.snapshot.position = {
        quantity: position.quantity, costUsd: position.costUsd,
        returnPct: (netExitUnit(decision.snapshot) * position.quantity / position.costUsd - 1) * 100,
        takeProfits: position.takeProfits ?? 0,
      };
      if (job.monitoring) decision.snapshot.monitoring = job.monitoring;
      decision.id = createHash('sha256').update(`paper-v1:${decision.snapshot.candleId}`).digest('hex').slice(0, 24);
      if (state.decisions.some(d => d.id === decision.id)) return finish('duplicate');
      decision.supportingEvidenceAt = Date.now();
      await run('Supporting research', async () => {
        try {
          const at = decision.supportingEvidenceAt!;
          const evidence = await deps.evidence?.(pool.token.toLowerCase(), at);
          if (evidence?.token === pool.token.toLowerCase() && evidence.completedAt <= at && evidence.startedAt <= at && evidence.startedAt >= at - 300000) {
            decision.supportingEvidence = structuredClone(evidence);
            decision.researchInput = researchInput(evidence, pool.token, pool.address, at);
          }
        } catch { /* Optional archived research; absence is never fabricated. */ }
      });
      decision.memories = await run(memoryProvider, async () => {
        const memories = decision.researchInput ? await providers.memories(fresh, decision.researchInput) : await providers.memories(fresh);
        decision.memoryReadAt = Date.now();
        return deps.annotate ? deps.annotate(memories, decision.memoryReadAt) : memories;
      });
      decision.memoryStatus = decision.memories.length ? `${decision.memories.length} active memories retrieved from ${memoryProvider}` : 'Connected · cold start (no relevant memories)';
      decision.judgment = await run('JEV', async()=>{
        if(deps.reserveModelCall && !deps.reserveModelCall(!!decision.snapshot!.position))
          throw new Error('JEV pacing limit reached; retry next cycle. Code exits remain active.');
        return decision.researchInput
          ? providers.judge(decision.snapshot!, decision.memories, decision.research!, decision.researchInput)
          : providers.judge(decision.snapshot!, decision.memories, decision.research!);
      });
      decision.time = Date.now();
      return finish('completed');
    } catch (error) {
      if(error instanceof Error && error.message==='JEV pacing limit reached; retry next cycle. Code exits remain active.') {
        decision.id=job.requestId; // No inference consumed this market minute; a later retry can use it.
        decision.reasons=[error.message];return finish('skipped');
      }
      decision.reasons = [error instanceof CoinGeckoError ? error.message : error instanceof AssessmentBlockedError
        ? error.message : `${stage} request or response validation failed. No fill; retry after fresh evidence arrives.`];
      return finish('skipped');
    }
  };
}
