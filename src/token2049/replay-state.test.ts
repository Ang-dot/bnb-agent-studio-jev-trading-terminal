import { describe, expect, it, vi } from 'vitest';
import * as caseModule from './cases.js';
import { cases, DEFAULT_CASE_ID, getCase, sourceAvailableAt } from './cases.js';
import { createInitialReplayState, getAvailableSources, getCheckpoint, getReplayStep, getVisibleCandles, getVisibleMemory, hydrateReplayState, initialReplayState, replayReducer } from './replay-state.js';

const atPhase = (id: string, phase: number) => replayReducer(createInitialReplayState(id), { type: 'step', step: phase });

describe('recorded historical case contracts', () => {
  it('presents three explanatory phases at one recorded cutoff with valid evidence references', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map(study => study.id)).size).toBe(cases.length);
    for (const study of cases) {
      expect(study.steps).toHaveLength(3);
      expect(new Set(study.steps.map(step => step.date))).toEqual(new Set([study.evaluation.cutoff]));
      const sources = new Map(study.sources.map(source => [source.id, source]));
      const nodes = new Set(study.memory.map(node => node.id));
      for (const step of study.steps) {
        for (const id of step.sourceIds) {
          expect(sources.has(id)).toBe(true);
          expect(sourceAvailableAt(sources.get(id)!)).toBeLessThanOrEqual(Date.parse(step.date));
        }
        for (const id of step.activeNodes) expect(nodes.has(id)).toBe(true);
      }
      for (const node of study.memory) for (const id of node.sourceIds) expect(sources.has(id)).toBe(true);
      expect(study.comparison.without.action).toBe('WATCH');
      expect(study.comparison.with.action).toBe('ENTRY');
      expect(study.steps.some(step => step.action === 'HOLD' || step.action === 'EXIT')).toBe(false);
      expect(study.steps.at(-1)!.unresolved).toMatch(/No order or historical fill/);
    }
  });

  it('uses conservative availability for sources with only date or month precision', () => {
    const source = cases[0].sources[0];
    expect(sourceAvailableAt({ ...source, publishedAt: '2025-03-14' })).toBe(Date.parse('2025-03-14T23:59:59.999Z'));
    expect(sourceAvailableAt({ ...source, publishedAt: '2024-02' })).toBe(Date.parse('2024-02-29T23:59:59.999Z'));
  });
});

describe('case-isolated replay controller', () => {
  it('opens the recorded decision and bounds navigation without mutating initial state', () => {
    const before = structuredClone(initialReplayState);
    expect(initialReplayState.caseId).toBe(DEFAULT_CASE_ID);
    expect(getCheckpoint(initialReplayState)).toBe(2);
    expect(Object.values(initialReplayState.checkpoints).every(phase => phase === 2)).toBe(true);
    expect(getCheckpoint(replayReducer(initialReplayState, { type: 'previous' }))).toBe(1);
    let state = replayReducer(initialReplayState, { type: 'step', step: -999 });
    expect(getCheckpoint(state)).toBe(0);
    expect(getCheckpoint(replayReducer(state, { type: 'previous' }))).toBe(0);
    state = replayReducer(state, { type: 'step', step: 999 });
    expect(getCheckpoint(replayReducer(state, { type: 'next' }))).toBe(getCase(state.caseId).steps.length - 1);
    expect(initialReplayState).toEqual(before);
  });

  it('preserves independent case phases and resets playback and later-price review on selection', () => {
    const [first, second] = cases;
    expect(second).toBeDefined();
    let state = atPhase(first.id, 0);
    state = replayReducer(state, { type: 'toggle-play' });
    expect(state.playing).toBe(true);
    state = replayReducer(state, { type: 'select-case', caseId: second.id });
    expect(getCheckpoint(state)).toBe(2);
    expect(state.playing).toBe(false);
    state = replayReducer(state, { type: 'step', step: 1 });
    state = replayReducer(state, { type: 'toggle-review' });
    state = replayReducer(state, { type: 'select-case', caseId: first.id });
    expect(getCheckpoint(state)).toBe(0);
    expect(state.checkpoints[second.id]).toBe(1);
    expect(state.reviewComplete).toBe(false);
  });

  it('later-price review cannot change the cutoff, evidence, or revealed memory in any phase', () => {
    for (const study of cases) for (let phase = 0; phase < study.steps.length; phase++) {
      const state = atPhase(study.id, phase);
      const cutoff = Date.parse(getReplayStep(state).date) / 1000;
      const sources = getAvailableSources(state), memory = getVisibleMemory(state);
      expect(getVisibleCandles(state).every(candle => candle.time + 60 <= cutoff)).toBe(true);
      const review = replayReducer(state, { type: 'toggle-review' });
      expect(getVisibleCandles(review)).toEqual(study.candles);
      expect(getReplayStep(review)).toEqual(getReplayStep(state));
      expect(getAvailableSources(review)).toEqual(sources);
      expect(getVisibleMemory(review)).toEqual(memory);
      expect(replayReducer(review, { type: 'previous' }).reviewComplete).toBe(false);
      expect(getVisibleCandles(replayReducer(review, { type: 'toggle-review' }))).toEqual(getVisibleCandles(state));
    }
  });

  it('reveals context by phase without changing event time or price cutoff; exclusion affects memory only', () => {
    for (const study of cases) {
      const event = atPhase(study.id, 0), context = atPhase(study.id, 1), decision = atPhase(study.id, 2);
      expect(getAvailableSources(event).map(source => source.id).sort()).toEqual(study.evaluation.candidate.currentEvidence.map(source => source.id).sort());
      expect(getAvailableSources(context).map(source => source.id).sort()).toEqual(study.sources.map(source => source.id).sort());
      expect(getVisibleMemory(event).length).toBeLessThan(getVisibleMemory(context).length);
      expect(getVisibleMemory(context).length).toBeLessThan(getVisibleMemory(decision).length);
      expect(getVisibleCandles(event)).toEqual(getVisibleCandles(decision));
      const excluded = replayReducer(decision, { type: 'toggle-memory' });
      expect(getVisibleMemory(excluded)).toEqual([]);
      expect(getAvailableSources(excluded)).toEqual(getAvailableSources(decision));
      expect(getReplayStep(excluded)).toEqual(getReplayStep(decision));
      expect(getVisibleCandles(excluded)).toEqual(getVisibleCandles(decision));
    }
  });

  it('blocks referenced future evidence and its dependent graph nodes even during full review', () => {
    const original = caseModule.getCase, study = structuredClone(cases[0]);
    const future = { ...study.sources[0], id: 'future-source-test', publishedAt: new Date(Date.parse(study.evaluation.cutoff) + 1).toISOString() };
    study.sources.push(future);
    study.memory.push({ ...study.memory[0], id: 'future-memory-test', sourceIds: [future.id] });
    study.memory.push({ ...study.memory[0], id: 'missing-source-test', sourceIds: ['unknown-source'] });
    study.steps[2].sourceIds.push(future.id);
    study.steps[2].activeNodes.push('future-memory-test', 'missing-source-test');
    const spy = vi.spyOn(caseModule, 'getCase').mockImplementation(id => id === study.id ? study : original(id));
    try {
      const state = replayReducer(createInitialReplayState(study.id), { type: 'toggle-review' });
      expect(getAvailableSources(state).map(source => source.id)).not.toContain(future.id);
      expect(getVisibleMemory(state).map(node => node.id)).not.toContain('future-memory-test');
      expect(getVisibleMemory(state).map(node => node.id)).not.toContain('missing-source-test');
    } finally { spy.mockRestore(); }
  });

  it('stops at the final phase and ignores queued ticks after pause or case change', () => {
    const [first, second] = cases;
    let state = replayReducer(atPhase(first.id, 1), { type: 'toggle-play' });
    const oldTick = { type: 'next' as const, caseId: first.id, autoplay: true };
    expect(state.playing).toBe(true);
    state = replayReducer(state, oldTick);
    expect(getCheckpoint(state)).toBe(2);
    expect(state.playing).toBe(false);
    expect(replayReducer(state, { type: 'toggle-play' }).playing).toBe(false);
    expect(replayReducer(state, oldTick)).toBe(state);
    state = replayReducer(state, { type: 'select-case', caseId: second.id });
    state = replayReducer(state, { type: 'step', step: 0 });
    state = replayReducer(state, { type: 'toggle-play' });
    expect(replayReducer(state, oldTick)).toBe(state);
    expect(replayReducer(state, { type: 'select-case', caseId: 'missing' })).toBe(state);
  });

  it('pauses idempotently and permits explicit playback afterward', () => {
    const state = atPhase(DEFAULT_CASE_ID, 0);
    expect(replayReducer(state, { type: 'pause' })).toBe(state);
    const paused = replayReducer(replayReducer(state, { type: 'toggle-play' }), { type: 'pause' });
    expect(paused.playing).toBe(false);
    expect(getCheckpoint(paused)).toBe(0);
    expect(replayReducer(paused, { type: 'pause' })).toBe(paused);
    expect(replayReducer(paused, { type: 'next', caseId: paused.caseId, autoplay: true })).toBe(paused);
    expect(replayReducer(paused, { type: 'toggle-play' }).playing).toBe(true);
  });

  it('validates stored phases and defaults missing cases to decision without restoring unattended activity', () => {
    const [first, second] = cases;
    const state = hydrateReplayState({ caseId: second.id, checkpoints: { [first.id]: 99, [second.id]: -2, unknown: 4 }, playing: true, reviewComplete: true, memoryEnabled: false });
    expect(state.caseId).toBe(second.id);
    expect(state.checkpoints[first.id]).toBe(2);
    expect(state.checkpoints[second.id]).toBe(0);
    for (const study of cases.slice(2)) expect(state.checkpoints[study.id]).toBe(2);
    expect(Object.keys(state.checkpoints).sort()).toEqual(cases.map(study => study.id).sort());
    expect(state.playing).toBe(false);
    expect(state.reviewComplete).toBe(false);
    expect(state.memoryEnabled).toBe(false);
    expect(hydrateReplayState({ caseId: 'unknown' }).caseId).toBe(DEFAULT_CASE_ID);
    expect(hydrateReplayState(null)).toEqual(createInitialReplayState());
  });
});
