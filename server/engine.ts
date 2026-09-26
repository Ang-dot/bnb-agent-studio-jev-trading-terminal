import { createHash, randomUUID } from "node:crypto";
import type { Decision, Pool, TerminalState } from "../src/types.js";
import { Providers } from "./providers.js";
import { applyPaperFill, evaluatePolicy, marketExecutable, netExitUnit } from "./policy.js";
import { paperExit } from "./exits.js";
import type { Store } from "./store.js";
import { proposedSwap, sdkInfo } from "./bnb.js";
import type { MonitorTrigger } from "../src/monitoring.js";
import type { SupportingEvidence } from "../src/enrichment.js";
import { researchInput } from './research-input.js';
import type { MemoryLoop } from './memory-loop.js';
interface Observation {
  context: MonitorTrigger;
  active: () => boolean;
  paper?: boolean;
}
export const liveBlockers = [
  "Live signer is not configured or authorized.",
  "Live capital, position, loss and slippage limits are not approved.",
  "PancakeSwap quote/simulation and transaction reconciliation are not implemented in this first slice.",
  "TiDB and production deployment have not been validated; provider smoke checks are not a live-trading readiness guarantee.",
];
export class Engine {
  pools: Pool[] = [];
  busy = false;
  discoveryError: string | null = null;
  exitError: string | null = null;
  private checkingExits = false;
  constructor(
    readonly store: Store,
    readonly providers: Providers,
    private evidence?: (token: string, at: number) => SupportingEvidence | undefined | Promise<SupportingEvidence | undefined>,
    private learning?: MemoryLoop,
  ) {}
  async discover() {
    try {
      const state = await this.store.read();
      // GMGN launch monitoring is the only discovery universe. Refresh existing
      // positions by their persisted token+pool identities, including on restart.
      const pools = this.pools.filter(p => state.approvedPools.includes(p.address) ||
        state.ledger.positions.some(h => h.pool === p.address) || Date.now() - p.discoveredAt < 86400000);
      let unavailable = false;
      for (const id of new Set([
        ...state.approvedPools,
        ...state.ledger.positions.map((p) => p.pool),
      ]))
          try {
            const token = state.ledger.positions.find(p => p.pool === id)?.token ??
              pools.find(p => p.address === id)?.token ??
              state.decisions.find(d => d.pool === id && d.snapshot?.pool === id)?.snapshot?.token;
            if (!token) throw new Error('Stored pool has no token identity');
            const fresh = await this.providers.pool(id, token);
            const index = pools.findIndex(p => p.address === id);
            if (index < 0) pools.push(fresh); else pools[index] = fresh;
          } catch {
            unavailable = true;
            /* Previous observed data stays visibly aged, never execution-ready. */ const prior =
              this.pools.find((p) => p.address === id);
            if (prior && !pools.some(p => p.address === id)) pools.push(prior);
          }
      this.pools = pools;
      this.discoveryError = unavailable ? 'Some original pools are unavailable from GMGN. Retained marks remain aged; no pool substitution.' : null;
    } catch {
      this.discoveryError =
        "Market discovery unavailable. Last observed data is retained with its timestamp.";
    }
  }
  async state(): Promise<TerminalState> {
    return {
      ...(await this.store.read()),
      pools: this.pools,
      providers: [...this.providers.statuses.values()],
      busy: this.busy,
      discoveryError: this.discoveryError,
      database: this.store.label,
      sdk: sdkInfo(),
      liveBlockers,
      exitError: this.exitError,
    };
  }
  async cycle(manualPool?: string, observation?: Observation, inventoryOnly=false) {
    if (observation && !manualPool)
      throw new Error("Monitoring requires an explicit inspection pool");
    if (this.busy) throw new Error("A decision cycle is already running");
    this.busy = true;
    try {
      const state = await this.store.read();
      if (state.halted) throw new Error("Kill switch is latched");
      const approved = manualPool ? [manualPool] : [...new Set([...(inventoryOnly?[]:state.approvedPools),...state.ledger.positions.map(p=>p.pool)])];
      // Existing positions stay under observation. Only approved pools can execute.
      const targets = this.pools.filter((p) => approved.includes(p.address));
      if (!targets.length) throw new Error("Select a pool before evaluating");
      const results: (Decision | undefined)[] = [];
      for (const pool of targets)
        results.push(await this.evaluate(pool, !manualPool || observation?.paper === true, observation));
      await this.store.mutate((s) => {
        s.lastCycleAt = Date.now();
      });
      return results;
    } finally {
      this.busy = false;
    }
  }
  private async evaluate(
    pool: Pool,
    allowExecution: boolean,
    observation?: Observation,
  ): Promise<Decision | undefined> {
    const session = (await this.store.read()).paperSession;
    let stage = "Provider configuration";
    const assertActive = async () => {
      if (
        observation &&
        (!observation.active() || (await this.store.read()).halted)
      )
        throw new Error(
          "Monitoring paused or evidence expired before JEV; no new model call.",
        );
    };
    const decision: Decision = {
      id: randomUUID(),
      time: Date.now(),
      pool: pool.address,
      name: pool.name,
      action: "hold",
      status: "not_evaluated",
      reasons: [],
      memories: [],
      memoryStatus: "Not queried",
      checks: [],
    };
    const missing = [
      "Bitquery",
      "Jev",
      "Living Brain",
      "Grok / X",
    ].filter((name) => this.providers.statuses.get(name)?.state === "missing");
    if (missing.length) {
      decision.reasons = [
        `Connect ${missing.join(", ")} to run Jev + memory. No model call or paper fill was made.`,
      ];
      await this.record(decision);
      return decision;
    }
    try {
      await assertActive();
      // Research can be slow. Refresh market data AFTER it completes, not before.
      stage = "Grok / X";
      decision.research = await this.providers.research(pool);
      if (!["ready", "no_results"].includes(decision.research.status)) {
        decision.reasons = [
          decision.research.detail,
          "X evidence unavailable; no Jev call or execution.",
        ];
        await this.record(decision);
        return decision;
      }
      await assertActive();
      stage = "GMGN market pool";
      const fresh = await this.providers.pool(pool.address, pool.token);
      stage = "Bitquery";
      decision.snapshot = await this.providers.snapshot(fresh);
      const position = (await this.store.read()).ledger.positions.find(p=>p.pool===pool.address);
      if(position) decision.snapshot.position = {quantity:position.quantity,costUsd:position.costUsd,returnPct:(netExitUnit(decision.snapshot)*position.quantity/position.costUsd-1)*100,takeProfits:position.takeProfits??0};
      if (observation) decision.snapshot.monitoring = observation.context;
      decision.id = createHash("sha256")
        .update(`paper-v1:${decision.snapshot.candleId}`)
        .digest("hex")
        .slice(0, 24);
      if ((await this.store.read()).decisions.some((d) => d.id === decision.id))
        return;
      stage = "Living Brain";
      decision.supportingEvidenceAt = Date.now();
      try {
        const evidence=await this.evidence?.(pool.token.toLowerCase(),decision.supportingEvidenceAt);
        if(evidence?.token===pool.token.toLowerCase()&&evidence.completedAt<=decision.supportingEvidenceAt&&evidence.startedAt>=decision.supportingEvidenceAt-300000){
          decision.supportingEvidence=structuredClone(evidence);
          decision.researchInput=researchInput(evidence,pool.token,pool.address,decision.supportingEvidenceAt);
        }
      } catch { /* Research is optional and never synthesised. */ }
      decision.memories = decision.researchInput ? await this.providers.memories(fresh,decision.researchInput) : await this.providers.memories(fresh);
      decision.memoryReadAt=Date.now();
      if(this.learning)decision.memories=await this.learning.annotate(decision.memories,decision.memoryReadAt);
      decision.memoryStatus = decision.memories.length
        ? `${decision.memories.length} active pages retrieved`
        : "Connected · cold start (no relevant memories)";
      await assertActive();
      stage = "JEV";
      // Freeze the exact, semantically qualified projection sent to this model call.
      decision.judgment = decision.researchInput ? await this.providers.judge(decision.snapshot,decision.memories,decision.research,decision.researchInput) : await this.providers.judge(
        decision.snapshot,
        decision.memories,
        decision.research,
      );
      decision.time = Date.now();
      // Reload and evaluate INSIDE the transaction so a stop/pause during an API call wins.
      stage = "Paper ledger";
      await this.store.mutate((s) => {
        if (s.decisions.some((d) => d.id === decision.id)) return;
        decision.executionContext = {
          inspectionOnly: !allowExecution,
          running: s.running,
          halted: s.halted,
        };
        const outcome = evaluatePolicy({
          now: Date.now(),
          approved: s.approvedPools.includes(pool.address) || (!!observation?.paper && observation.active()),
          halted: s.halted,
          ledger: s.ledger,
          memoryReady: true,
          snapshot: decision.snapshot!,
          judgment: decision.judgment!,
          research: decision.research!,
        });
        decision.checks = outcome.checks;
        decision.action = outcome.action;
        decision.reasons = outcome.reasons;
        decision.status = "held";
        // Manual inspection never executes. A running autonomous paper loop can fill.
        if (
          outcome.action !== "hold" &&
          allowExecution &&
          s.running &&
          !s.halted &&
          s.paperSession === session &&
          (!observation || observation.active())
        ) {
          decision.intent = proposedSwap(
            decision.snapshot!,
            outcome.action,
          ) as Record<string, unknown>;
          s.ledger = applyPaperFill(
            s.ledger,
            decision.snapshot!,
            outcome.action,
            decision.id,
            Date.now(),
          );
          decision.status = "executed";
          decision.fill = s.ledger.fills[0];
        } else if (outcome.action !== "hold") {
          decision.reasons.push(
            allowExecution
              ? !s.running ? "Autonomous paper execution is paused." : "Paper session changed or attention expired during assessment; no fill."
              : "Inspection only; no execution authorized by this request.",
          );
        }
        s.decisions.unshift(decision);
        s.decisions = s.decisions.slice(0, 500);
      });
      if(this.learning) await this.learning.record(decision).catch(()=>{});
      if (decision.status === "executed" && !this.learning) {
        try {
          const status = await this.providers.capture(decision);
          await this.store.mutate((s) => {
            const d = s.decisions.find((x) => x.id === decision.id);
            if (d) d.memoryCapture = status;
          });
        } catch {
          await this.store.mutate((s) => {
            const d = s.decisions.find((x) => x.id === decision.id);
            if (d)
              d.memoryCapture =
                "Capture failed; durable paper ledger retained. Manual retry required.";
          });
        }
      }
    } catch (error) {
      decision.status = "not_evaluated";
      decision.action = "hold";
      decision.reasons = [
        error instanceof Error &&
        error.message ===
          "Monitoring paused or evidence expired before JEV; no new model call."
          ? error.message
          : stage + " request or response validation failed. No fill; retry after fresh evidence arrives.",
      ];
      await this.record(decision);
    }
    return decision;
  }
  // Independent from research/model latency and entry screening. Never signs or sends a transaction.
  async checkExits() {
    if(this.checkingExits) return;
    const start=await this.store.read();
    if(!start.running||start.halted||!start.ledger.positions.length) return;
    this.checkingExits=true;
    const errors:string[]=[];
    try {
      for(const held of start.ledger.positions) {
        try {
          const fresh=await this.providers.pool(held.pool,held.token);
          const snapshot=await this.providers.snapshot(fresh);
          if(!marketExecutable(snapshot,Date.now())) throw new Error("Stale exit price");
          let record:Decision|undefined;
          await this.store.mutate(s=>{
            if(!s.running||s.halted||s.paperSession!==start.paperSession) return;
            const position=s.ledger.positions.find(p=>p.pool===held.pool);
            if(!position||position.token.toLowerCase()!==snapshot.token.toLowerCase()) return;
            snapshot.position={quantity:position.quantity,costUsd:position.costUsd,returnPct:(netExitUnit(snapshot)*position.quantity/position.costUsd-1)*100,takeProfits:position.takeProfits??0};
            const exit=paperExit(position,snapshot,Date.now());
            position.peakNetUnitUsd=Math.max(position.peakNetUnitUsd??0,netExitUnit(snapshot));
            if(!exit) return;
            const id=createHash("sha256").update("exit-v1:"+snapshot.candleId+":"+exit.reason).digest("hex").slice(0,24);
            if(s.ledger.consumedDecisions.includes(id)) return;
            s.ledger=applyPaperFill(s.ledger,snapshot,"sell",id,Date.now(),exit);
            record={id,time:Date.now(),pool:held.pool,name:held.name,action:"sell",status:"executed",ruleExit:exit.reason,
              reasons:["Code exit: "+exit.reason+" · "+(exit.sellFraction*100)+"% of remaining position. Simulated at observed price, not a guaranteed fill."],
              snapshot,fill:s.ledger.fills[0],memories:[],memoryStatus:"Not queried for deterministic exit",checks:[],
              executionContext:{inspectionOnly:false,running:true,halted:false},intent:proposedSwap(snapshot,"sell") as Record<string,unknown>};
            s.decisions.unshift(record);s.decisions=s.decisions.slice(0,500);
          });
          if(record) {
            if(this.learning){await this.learning.record(record).catch(()=>{});continue;}
            try {
              const captured=await this.providers.capture(record);
              await this.store.mutate(s=>{const d=s.decisions.find(d=>d.id===record!.id);if(d)d.memoryCapture=captured;});
            } catch {
              await this.store.mutate(s=>{const d=s.decisions.find(d=>d.id===record!.id);if(d)d.memoryCapture="Capture failed; paper fill remains recorded.";});
            }
          }
        } catch {errors.push(held.name);}
      }
      this.exitError=errors.length?"Exit price unavailable for "+errors.join(", ")+". No fill fabricated; retrying.":null;
    } finally {this.checkingExits=false;}
  }
  private async record(d: Decision) {
    await this.store.mutate((s) => {
      if (s.decisions.some((x) => x.id === d.id)) return;
      s.decisions.unshift(d);
      s.decisions = s.decisions.slice(0, 500);
    });
    if(this.learning) await this.learning.record(d).catch(()=>{});
  }
}
