import { closedAsOf } from './historical-prices.js';
import { cases, DEFAULT_CASE_ID, getCase, sourceAvailableAt, type CaseStudy, type ReplayStep } from './cases';

export type ReplayState = {
  caseId: string;
  checkpoints: Record<string, number>;
  memoryEnabled: boolean;
  playing: boolean;
  reviewComplete: boolean;
};

export type ReplayAction =
  | { type: 'select-case'; caseId: string }
  | { type: 'step'; step: number }
  | { type: 'next'; caseId?: string; autoplay?: boolean }
  | { type: 'previous' }
  | { type: 'toggle-memory' }
  | { type: 'toggle-play' }
  | { type: 'pause' }
  | { type: 'toggle-review' };

export function createInitialReplayState(caseId = DEFAULT_CASE_ID): ReplayState {
  return {
    caseId: getCase(caseId).id,
    checkpoints: Object.fromEntries(cases.map(study => [study.id, 2])),
    memoryEnabled: true,
    playing: false,
    reviewComplete: false,
  };
}

export const initialReplayState: ReplayState = createInitialReplayState();

/** Restore only valid, known-case checkpoints. Reloads never resume unattended playback or full-chart review. */
export function hydrateReplayState(input: unknown): ReplayState {
  const initial = createInitialReplayState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return initial;
  const saved = input as Partial<ReplayState>;
  const checkpoints = saved.checkpoints && typeof saved.checkpoints === 'object' ? saved.checkpoints : {};
  return {
    ...initial,
    caseId: typeof saved.caseId === 'string' ? getCase(saved.caseId).id : initial.caseId,
    checkpoints: Object.fromEntries(cases.map(study => [study.id, boundedStep(study, checkpoints[study.id] ?? 2)])),
    memoryEnabled: typeof saved.memoryEnabled === 'boolean' ? saved.memoryEnabled : initial.memoryEnabled,
  };
}

function boundedStep(study: CaseStudy, value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(study.steps.length - 1, Math.trunc(value))) : 0;
}

export function getCheckpoint(state: ReplayState): number {
  const study = getCase(state.caseId);
  return boundedStep(study, state.checkpoints[study.id] ?? 2);
}

export function getReplayStep(state: ReplayState): ReplayStep {
  return getCase(state.caseId).steps[getCheckpoint(state)];
}

function moveTo(state: ReplayState, index: number): ReplayState {
  const study = getCase(state.caseId);
  const checkpoint = boundedStep(study, index);
  return {
    ...state,
    checkpoints: { ...state.checkpoints, [study.id]: checkpoint },
    reviewComplete: false,
    playing: state.playing && checkpoint < study.steps.length - 1,
  };
}

export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case 'select-case': {
      if (!cases.some(study => study.id === action.caseId)) return state;
      if (action.caseId === state.caseId) return state;
      return { ...state, caseId: action.caseId, playing: false, reviewComplete: false };
    }
    case 'step': return { ...moveTo(state, action.step), playing: false };
    case 'next': {
      if (action.caseId && action.caseId !== state.caseId) return state;
      if (action.autoplay && !state.playing) return state;
      return moveTo(state, getCheckpoint(state) + 1);
    }
    case 'previous': return { ...moveTo(state, getCheckpoint(state) - 1), playing: false };
    case 'toggle-memory': return { ...state, memoryEnabled: !state.memoryEnabled };
    case 'pause': return state.playing ? { ...state, playing: false } : state;
    case 'toggle-play': {
      const finalStep = getCase(state.caseId).steps.length - 1;
      if (getCheckpoint(state) === finalStep) return { ...state, playing: false };
      return { ...state, playing: !state.playing, reviewComplete: false };
    }
    case 'toggle-review': return { ...state, reviewComplete: !state.reviewComplete, playing: false };
    default: return state;
  }
}

/** Complete-chart review changes presentation only, never the evidence checkpoint. */
export function getVisibleCandles(state: ReplayState) {
  const study = getCase(state.caseId);
  return state.reviewComplete ? study.candles : closedAsOf(study.candles,60,getReplayStep(state).date);
}

export function getAvailableSources(state: ReplayState) {
  const study = getCase(state.caseId);
  const step = getCheckpoint(state);
  const referenced = new Set(study.steps.slice(0, step + 1).flatMap(item => item.sourceIds));
  const cutoff = Date.parse(study.steps[step].date);
  return study.sources.filter(source => referenced.has(source.id) && sourceAvailableAt(source) <= cutoff);
}

/** Only nodes revealed by this case's earlier/current steps are exposed; review mode cannot unlock them. */
export function getVisibleMemory(state: ReplayState) {
  if (!state.memoryEnabled) return [];
  const study = getCase(state.caseId);
  const checkpoint = getCheckpoint(state);
  const revealed = new Set(study.steps.slice(0, checkpoint + 1).flatMap(step => step.activeNodes));
  const sources = new Map(study.sources.map(source => [source.id, source]));
  const cutoff = Date.parse(study.steps[checkpoint].date);
  return study.memory.filter(memory => revealed.has(memory.id) && memory.sourceIds.every(id => {
    const source = sources.get(id);
    return source !== undefined && sourceAvailableAt(source) <= cutoff;
  }));
}
