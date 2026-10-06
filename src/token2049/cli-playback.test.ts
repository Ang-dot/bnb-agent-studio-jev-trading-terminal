import { describe, expect, it } from 'vitest';
import {
  cliConfiguration, cliPlaybackReducer, cliShortcut, initialCliPlayback,
  tradingReturnHref, type CliPlaybackState,
} from './cli-playback.js';

function advance(state: CliPlaybackState, times: number) {
  for (let i = 0; i < times; i++) state = cliPlaybackReducer(state, { type: 'next' });
  return state;
}

describe('terminal setup playback', () => {
  it('requires an explicit memory choice, even after repeated advances', () => {
    const waiting = advance(initialCliPlayback, 30);
    expect(waiting).toMatchObject({ step: 7, memory: null });
    expect(cliConfiguration(waiting)).toMatchObject({ decisionJournal: true, livingBrain: false });
    expect(cliPlaybackReducer(initialCliPlayback, { type: 'choose-memory', choice: 'attach' })).toBe(initialCliPlayback);
  });

  it('undoes the runtime setup and clears a choice when crossing back over it', () => {
    const waiting = advance(initialCliPlayback, 6);
    const selected = cliPlaybackReducer(waiting, { type: 'choose-memory', choice: 'attach' });
    const configured = advance(selected, 1);
    expect(cliConfiguration(configured).livingBrain).toBe(true);
    const beforeSetup = cliPlaybackReducer(configured, { type: 'previous' });
    expect(cliConfiguration(beforeSetup).livingBrain).toBe(false);
    const undoneChoice = cliPlaybackReducer(beforeSetup, { type: 'previous' });
    expect(undoneChoice).toEqual(waiting);
    const skipped = advance(cliPlaybackReducer(undoneChoice, { type: 'choose-memory', choice: 'skip' }), 20);
    expect(skipped).toMatchObject({ step: 12, memory: 'skip' });
    expect(cliConfiguration(skipped)).toMatchObject({ decisionJournal: true, livingBrain: false, priorContextRestored: false });
  });

  it('restores the same completed state after backward and forward playback', () => {
    const chosen = cliPlaybackReducer(advance(initialCliPlayback, 6), { type: 'choose-memory', choice: 'attach' });
    const completed = advance(chosen, 4);
    const rewound = cliPlaybackReducer(cliPlaybackReducer(completed, { type: 'previous' }), { type: 'previous' });
    expect(cliConfiguration(rewound).priorContextRestored).toBe(false);
    expect(advance(rewound, 2)).toEqual(completed);
    expect(cliPlaybackReducer(completed, { type: 'next' })).toBe(completed);
    expect(cliPlaybackReducer(initialCliPlayback, { type: 'previous' })).toBe(initialCliPlayback);
  });

  it('switches the assistant without changing the runtime choice, evidence step or configuration', () => {
    const selected = cliPlaybackReducer(advance(initialCliPlayback, 6), { type: 'choose-memory', choice: 'attach' });
    const resumed = advance(selected, 3);
    const switched = cliPlaybackReducer(resumed, { type: 'set-assistant', assistant: 'claude' });
    expect(switched).toEqual({ ...resumed, assistant: 'claude' });
    expect(cliConfiguration(switched)).toEqual(cliConfiguration(resumed));
    expect(cliPlaybackReducer(switched, { type: 'reset' })).toEqual({ ...initialCliPlayback, assistant: 'claude' });
  });

  it('can revisit the choice without carrying memory state into the alternate branch', () => {
    const finished = advance(cliPlaybackReducer(advance(initialCliPlayback, 6), { type: 'choose-memory', choice: 'attach' }), 4);
    const revisited = cliPlaybackReducer(finished, { type: 'revisit-choice' });
    expect(revisited).toMatchObject({ step: 7, memory: null });
    expect(cliConfiguration(revisited)).toMatchObject({ decisionJournal: true, livingBrain: false, priorContextRestored: false });
  });
});

describe('terminal keyboard contract', () => {
  it('leaves focused controls, text selection, composition, dialogs and modified keys alone', () => {
    for (const blocked of ['repeat', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'interactiveTarget', 'selectedText', 'dialogOpen']) {
      expect(cliShortcut(initialCliPlayback, { key: 'Enter', [blocked]: true })).toBeNull();
    }
    expect(cliShortcut(initialCliPlayback, { key: 'Tab' })).toBeNull();
    expect(cliShortcut(initialCliPlayback, { key: 'Escape' })).toBe('release');
  });

  it('does not interpret an advance key as consent at the choice prompt', () => {
    const waiting = advance(initialCliPlayback, 6);
    for (const key of ['Enter', ' ', 'ArrowDown']) expect(cliShortcut(waiting, { key })).toBeNull();
    expect(cliShortcut(waiting, { key: '1' })).toEqual({ type: 'choose-memory', choice: 'attach' });
    expect(cliShortcut(waiting, { key: '2' })).toEqual({ type: 'choose-memory', choice: 'skip' });
    expect(cliShortcut(initialCliPlayback, { key: '1' })).toBeNull();
    expect(cliShortcut(waiting, { key: 'Home' })).toEqual({ type: 'reset' });
    expect(cliShortcut(waiting, { key: 'ArrowUp' })).toEqual({ type: 'previous' });
  });
});

describe('return to the trading replay', () => {
  it('preserves an explicit replay link over stale saved state', () => {
    expect(tradingReturnHref('?case=coin1&step=0', JSON.stringify({ caseId: 'coin3', checkpoints: { coin3: 3 } })))
      .toBe('/token2049?case=coin1&step=0');
  });

  it('restores the selected case checkpoint and ignores unrelated checkpoint positions', () => {
    expect(tradingReturnHref('', JSON.stringify({ caseId: 'coin3', checkpoints: { coin3: 2, coin1: 4 }, playing: true })))
      .toBe('/token2049?case=coin3&step=2');
    expect(tradingReturnHref('', '{broken')).toBe('/token2049');
    expect(tradingReturnHref('', JSON.stringify({ caseId: 'coin3', checkpoints: { coin3: -1 } })))
      .toBe('/token2049?case=coin3');
  });
});
