export type CliAssistant = 'codex' | 'claude';
export type MemoryChoice = 'attach' | 'skip';

export const CLI_STEPS = 12;
export const MEMORY_CHOICE_STEP = 7;

export interface CliPlaybackState {
  step: number;
  assistant: CliAssistant;
  memory: MemoryChoice | null;
}

export type CliPlaybackAction =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'choose-memory'; choice: MemoryChoice }
  | { type: 'set-assistant'; assistant: CliAssistant }
  | { type: 'reset' }
  | { type: 'revisit-choice' };

export const initialCliPlayback: CliPlaybackState = {
  step: 1,
  assistant: 'codex',
  memory: null,
};

export function cliPlaybackReducer(
  state: CliPlaybackState,
  action: CliPlaybackAction,
): CliPlaybackState {
  switch (action.type) {
    case 'next':
      if (state.step === MEMORY_CHOICE_STEP || state.step >= CLI_STEPS) return state;
      return { ...state, step: state.step + 1 };
    case 'previous': {
      if (state.step <= 1) return state;
      const step = state.step - 1;
      return { ...state, step, memory: step <= MEMORY_CHOICE_STEP ? null : state.memory };
    }
    case 'choose-memory':
      if (state.step !== MEMORY_CHOICE_STEP) return state;
      return { ...state, step: MEMORY_CHOICE_STEP + 1, memory: action.choice };
    case 'set-assistant':
      return state.assistant === action.assistant ? state : { ...state, assistant: action.assistant };
    case 'reset':
      return { ...initialCliPlayback, assistant: state.assistant };
    case 'revisit-choice':
      return state.step < MEMORY_CHOICE_STEP
        ? state
        : { ...state, step: MEMORY_CHOICE_STEP, memory: null };
  }
}

/** Configuration follows the displayed work, so reversing a beat also reverses its state. */
export function cliConfiguration(state: CliPlaybackState) {
  return {
    projectCreated: state.step >= 3,
    decisionJournal: state.step >= 4,
    checksComplete: state.step >= 5,
    livingBrain: state.step >= 9 && state.memory === 'attach',
    priorContextRestored: state.step >= 11 && state.memory === 'attach',
    mode: 'paper' as const,
  };
}

export interface CliShortcutInput {
  key: string;
  repeat?: boolean;
  isComposing?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  interactiveTarget?: boolean;
  selectedText?: boolean;
  dialogOpen?: boolean;
}

export function cliShortcut(
  state: CliPlaybackState,
  input: CliShortcutInput,
): CliPlaybackAction | 'release' | null {
  if (input.repeat || input.isComposing || input.altKey || input.ctrlKey || input.metaKey
      || input.shiftKey || input.interactiveTarget || input.selectedText || input.dialogOpen) return null;
  if (input.key === 'Escape') return 'release';
  if (input.key === 'Home') return { type: 'reset' };
  if (input.key === 'ArrowUp') return { type: 'previous' };
  if (state.step === MEMORY_CHOICE_STEP) {
    if (input.key === '1') return { type: 'choose-memory', choice: 'attach' };
    if (input.key === '2') return { type: 'choose-memory', choice: 'skip' };
    return null;
  }
  if (input.key === 'Enter' || input.key === ' ' || input.key === 'ArrowDown') return { type: 'next' };
  return null;
}

export const scaffoldCommand = [
  'bag init JevMemory \\',
  '  --protocols X402 \\',
  '  --rails b402 \\',
  '  --b402-price 0 \\',
  '  --llm-provider none \\',
  '  --network bsc-testnet \\',
  '  --destination self \\',
  '  --no-onboard \\',
  '  --no-auto-topup',
].join('\n');

export const cliStepLabels = [
  'Your request',
  'Plan the project',
  'Create the scaffold',
  'Implement the agent',
  'Check the first version',
  'Retain the decision journal',
  'Choose memory',
  'Your memory choice',
  'Configure the runtime',
  'Assess the current event',
  'Compare earlier context',
  'Ready for the replay',
] as const;

/** Only presentation case IDs can leave the CLI in a return link. */
export function tradingReturnHref(search: string, savedState?: string | null): string {
  const safeLink = (id: unknown, step: unknown): string | null => {
    if (typeof id !== 'string' || !/^coin[1-4]$/.test(id)) return null;
    const query = new URLSearchParams({case:id});
    if (typeof step === 'number' && Number.isSafeInteger(step) && step >= 0 && step <= 2) query.set('step', String(step));
    return `/token2049?${query}`;
  };
  if (search && search !== '?') {
    const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const step = query.get('step');
    return safeLink(query.get('case'), step === null || step === '' ? undefined : Number(step)) ?? '/token2049';
  }
  try {
    const saved: unknown = JSON.parse(savedState ?? 'null');
    if (!saved || typeof saved !== 'object') return '/token2049';
    const {caseId, checkpoints} = saved as {caseId?:unknown;checkpoints?:Record<string, unknown>};
    return safeLink(caseId, typeof caseId === 'string' ? checkpoints?.[caseId] : undefined) ?? '/token2049';
  } catch { return '/token2049'; }
}
