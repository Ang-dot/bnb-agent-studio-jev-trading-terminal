import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from './ui/button.js';
import {
  CLI_STEPS, MEMORY_CHOICE_STEP, cliConfiguration, cliPlaybackReducer, cliShortcut,
  cliStepLabels, initialCliPlayback, scaffoldCommand, tradingReturnHref,
  type CliPlaybackAction, type MemoryChoice,
} from './cli-playback.js';
import './cli.css';

const interactiveSelector = 'a, button, input, textarea, select, summary, [role="button"], [role="tab"], [role="slider"], [contenteditable]:not([contenteditable="false"])';

function readReturnHref() {
  if (typeof window === 'undefined') return '/token2049';
  try {
    return tradingReturnHref(window.location.search, window.sessionStorage.getItem('lb-presentation-state-v3'));
  } catch {
    return tradingReturnHref(window.location.search);
  }
}

function Turn({ speaker, tone, children, step }: {
  speaker?: string;
  tone?: 'user' | 'assistant';
  children: ReactNode;
  step: number;
}) {
  return (
    <div className={`lb-cli-turn${tone ? ` lb-cli-turn--${tone}` : ' lb-cli-turn--work'}`} data-step={step}>
      <span className="lb-cli-speaker">{speaker}</span>
      <span className="lb-cli-prompt" aria-hidden="true">{speaker ? '›' : ''}</span>
      <div className="lb-cli-content">{children}</div>
    </div>
  );
}

function Added({ children }: { children: ReactNode }) {
  return <li><span aria-hidden="true">+</span>{children}</li>;
}

export function BuildAgentPage() {
  const [state, dispatch] = useReducer(cliPlaybackReducer, initialCliPlayback);
  const [returnHref] = useState(readReturnHref);
  const [keyboardActive, setKeyboardActive] = useState(true);
  const transcript = useRef<HTMLDivElement>(null);
  const assistant = state.assistant === 'codex' ? 'Codex' : 'Claude';
  const waitingForChoice = state.step === MEMORY_CHOICE_STEP;
  const attached = state.memory === 'attach';
  const config = cliConfiguration(state);

  useEffect(() => {
    if (document.activeElement === document.body) transcript.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [state.step, state.memory]);

  function act(action: CliPlaybackAction) {
    dispatch(action);
    setKeyboardActive(true);
    transcript.current?.focus({ preventScroll: true });
  }

  function choose(choice: MemoryChoice) {
    act({ type: 'choose-memory', choice });
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const action = cliShortcut(state, {
      key: event.key,
      repeat: event.repeat,
      isComposing: event.nativeEvent.isComposing,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      interactiveTarget: Boolean(target.closest(interactiveSelector)) || target.isContentEditable,
      selectedText: Boolean(window.getSelection()?.toString()),
      dialogOpen: Boolean(document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')),
    });
    if (!action) {
      // The choice cannot be skipped, including by a key that normally advances.
      if (waitingForChoice && keyboardActive && target === transcript.current
        && ['Enter', ' ', 'ArrowDown'].includes(event.key) && !event.repeat
        && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && !event.nativeEvent.isComposing && !window.getSelection()?.toString()
        && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (action === 'release') {
      setKeyboardActive(false);
      transcript.current?.blur();
    } else act(action);
  }

  return (
    <main className="lb-app lb-cli" onKeyDown={handleKey}>
      <div className="lb-cli-frame">
        <header className="lb-cli-header">
          <a className="lb-cli-back" href={returnHref}><ArrowLeft size={17} aria-hidden="true" />Trading</a>
          <span className="lb-cli-session">New agent session<span className="lb-cli-session-path"> / JevMemory</span></span>
          <div className="lb-cli-assistants" role="group" aria-label="Development assistant">
            <Button type="button" variant="ghost" size="sm" className="lb-cli-agent" aria-pressed={state.assistant === 'codex'}
              onClick={() => dispatch({ type: 'set-assistant', assistant: 'codex' })}>Codex</Button>
            <Button type="button" variant="ghost" size="sm" className="lb-cli-agent" aria-pressed={state.assistant === 'claude'}
              onClick={() => dispatch({ type: 'set-assistant', assistant: 'claude' })}>Claude</Button>
          </div>
        </header>

        <div ref={transcript} className="lb-cli-transcript" tabIndex={0} role="region"
          aria-label="Agent setup walkthrough" aria-describedby="lb-cli-key-help"
          onFocus={event => { if (event.target === event.currentTarget) setKeyboardActive(true); }}
          onClick={event => {
            if (!(event.target as HTMLElement).closest(interactiveSelector) && !window.getSelection()?.toString()) {
              transcript.current?.focus({ preventScroll: true });
            }
          }}>
          <div className="lb-cli-log" role="log" aria-label="Setup conversation" aria-live="polite" aria-relevant="additions">
            <Turn speaker="You" tone="user" step={1}>
              <p>Build me a BNB memecoin research and paper-trading agent with Agent Studio.<br className="lb-cli-desktop-break" /> Call it JevMemory and use JEV for assessments.</p>
            </Turn>

            {state.step >= 2 && <Turn speaker={assistant} tone="assistant" step={2}>
              <p>I’ll scaffold the project, then add an assessment handler and a journal for project and community sources, token identity checks and revised assumptions.</p>
            </Turn>}

            {state.step >= 3 && <Turn step={3}>
              <details className="lb-cli-command">
                <summary><ChevronRight size={17} aria-hidden="true" /><span>Ran <code>bag init JevMemory</code></span><span className="lb-cli-expand-label">show arguments</span></summary>
                <pre><code>{scaffoldCommand}</code></pre>
                <p className="lb-cli-detail-note">Testnet scaffold · custom JEV adapter · no onboarding or automatic top-up.</p>
              </details>
              <p className="lb-cli-output lb-cli-command-result">Created JevMemory/app/agent/</p>
            </Turn>}

            {state.step >= 4 && <Turn step={4}>
              <p>Edited agent workspace</p>
              <ul className="lb-cli-additions"><Added>JEV assessment adapter</Added><Added>Paper policy and decision journal</Added></ul>
            </Turn>}

            {state.step >= 5 && <Turn step={5}>
              <p>Checks passed</p>
              <p className="lb-cli-output lb-cli-indented">Decision format · missing evidence · execution limits</p>
            </Turn>}

            {state.step >= 6 && <Turn speaker={assistant} tone="assistant" step={6}>
              <p>This version keeps a decision journal. It doesn’t yet bring earlier research into the next assessment.</p>
            </Turn>}

            {state.step >= 7 && <Turn speaker={assistant} tone="assistant" step={7}>
              <p>Want me to attach Living Brain? It can keep the project and community narratives, their sources, identity links and reasons an assessment stayed at WATCH. I’ll connect relevant knowledge changes to the review queue, so a new public event can be read in that earlier context, even in a new session.</p>
              <div className="lb-cli-choices" role="group" aria-label="Choose whether to attach Living Brain">
                <Button type="button" variant="outline" className="lb-cli-choice lb-cli-choice--attach" disabled={!waitingForChoice}
                  aria-pressed={state.memory === 'attach'} onClick={() => choose('attach')}>
                  <span aria-hidden="true">[1]</span> Attach Living Brain{state.memory === 'attach' && <Check size={16} aria-hidden="true" />}
                </Button>
                <Button type="button" variant="ghost" className="lb-cli-choice" disabled={!waitingForChoice}
                  aria-pressed={state.memory === 'skip'} onClick={() => choose('skip')}>
                  <span aria-hidden="true">[2]</span> Keep this version{state.memory === 'skip' && <Check size={16} aria-hidden="true" />}
                </Button>
              </div>
            </Turn>}

            {state.step >= 8 && <Turn speaker="You" tone="user" step={8}>
              <p>{attached ? 'Yes, one brain for this strategy.' : 'Keep this version for now.'}</p>
            </Turn>}

            {state.step >= 9 && <Turn speaker={assistant} tone="assistant" step={9}>
              {attached ? <>
                <p>I’ll add capture, recall and change handling to the runtime. The key, subject and brain ID will come from the server environment.</p>
                <div className="lb-cli-work-block"><p>Updated agent workspace</p><ul className="lb-cli-additions">
                  <Added>Research and decision capture</Added><Added>Context recall before assessment</Added><Added>Review queue for affected decisions</Added>
                </ul></div>
                <details className="lb-cli-details"><summary>Runtime configuration</summary>
                  <pre><code>{'LIVING_BRAIN_API_KEY=<server secret>\nLIVING_BRAIN_SUBJECT_ID=<account ID>\nLIVING_BRAIN_ID=<strategy brain ID>'}</code></pre>
                  <p className="lb-cli-detail-note">The agent runtime uses these values. Connecting the coding assistant’s MCP server is a separate setup.</p>
                </details>
              </> : <>
                <p>I’ll keep the decision journal and assess each checkpoint from the evidence supplied with it. You can add Living Brain later.</p>
                <div className="lb-cli-work-block"><p>Kept agent configuration</p><ul className="lb-cli-additions">
                  <Added>Local research and decision records</Added><Added>Current-evidence assessment</Added><Added>Paper policy and execution limits</Added>
                </ul></div>
              </>}
            </Turn>}

            {state.step >= 10 && <Turn speaker={assistant} tone="assistant" step={10}>
              <p>Let’s use BNB-COIN1, an educational placeholder. We’ll compare how JEV reads a public tutorial discussion with and without an earlier project claim linking the example token to that tutorial.</p>
              <div className="lb-cli-work-block">
                <p className="lb-cli-output">BNB-COIN1 · Selected assessment checkpoint</p>
                <dl className="lb-cli-checkpoint"><dt>Builder context</dt><dd>A public tutorial discussion revisits AI-assisted token creation</dd><dt>Current evidence</dt><dd>WATCH in the example assessment: the tutorial’s relationship to BNB-COIN1 is unresolved</dd><dt>Journal</dt><dd>The source, completed candles and assessment cutoff are retained</dd></dl>
              </div>
              {attached && <details className="lb-cli-details"><summary>Planned memory handoff</summary>
                <ol className="lb-cli-trace"><li>Capture the earlier project post with its date and source</li><li>Preserve the project’s claimed video-to-token link and outstanding identity checks</li><li>Recall the claim and its limits before assessment</li><li>Supply the context to JEV at the same event cutoff</li></ol>
              </details>}
            </Turn>}

            {state.step >= 11 && <Turn step={11}>
              <p className="lb-cli-session-divider">Same event and price checkpoint <span>· Both assessments use the same cutoff</span></p>
              <p className="lb-cli-output">An earlier project post claims a link between BNB-COIN1 and the same tutorial</p>
              <dl className="lb-cli-checkpoint">
                <dt>Context</dt><dd>{attached ? 'The project’s earlier claim and source link are supplied to JEV' : 'The current post and completed candles are supplied; earlier context is excluded'}</dd>
                <dt>Decision</dt><dd>{attached ? 'ENTRY in the example assessment' : 'WATCH in the example assessment'}</dd>
                <dt>Still separate</dt><dd className="lb-cli-unresolved">Exact contract identity, contract risk, liquidity, sizing and execution checks</dd>
                <dt>Meaning</dt><dd>JEV’s assessment of the project narrative around a public event</dd>
              </dl>
            </Turn>}

            {state.step >= 12 && <Turn speaker={assistant} tone="assistant" step={12}>
              <p>{attached
                ? 'The earlier project claim gives this public tutorial discussion context for BNB-COIN1. The journal keeps the source, the claim and the unresolved checks, so the next session can revisit the interpretation. This educational replay places no order.'
                : 'The example current-evidence assessment stays at WATCH. Its journal keeps the source and price checkpoint. Return to the memory choice to compare what the earlier project claim adds.'}</p>
              <div className="lb-cli-work-block"><dl className="lb-cli-checkpoint">
                <dt>Agent</dt><dd>JevMemory · JEV · {config.mode} decisions</dd><dt>Journal</dt><dd>{config.decisionJournal ? 'Retained' : 'Not yet added'}</dd>
                <dt>Living Brain</dt><dd>{config.livingBrain ? 'One strategy brain · capture, recall and change handling' : 'Not attached'}</dd>
              </dl></div>
              <div className="lb-cli-end-actions">
                <a className="lb-cli-return" href={returnHref}><ArrowLeft size={16} aria-hidden="true" />Return to replay</a>
                <Button type="button" variant="ghost" size="sm" className="lb-cli-revisit" onClick={() => act({ type: 'revisit-choice' })}>Revisit memory choice</Button>
              </div>
            </Turn>}

            {state.step < CLI_STEPS && <div className="lb-cli-cursor-row" aria-hidden="true">
              <span className="lb-cli-speaker">{waitingForChoice ? 'You' : ''}</span><span className="lb-cli-prompt">{waitingForChoice ? '›' : ''}</span>
              <span className="lb-cli-caret" />
            </div>}
          </div>
        </div>

        <footer className="lb-cli-footer">
          <span className="lb-cli-disclosure"><span aria-hidden="true" />Scripted demo · no inference or commands executed</span>
          <div className="lb-cli-playback">
            <span className="lb-cli-step" aria-live="polite" aria-atomic="true">Step {state.step} / {CLI_STEPS}<span className="lb-cli-sr-only"> — {cliStepLabels[state.step - 1]}</span></span>
            <span className="lb-cli-key-help" id="lb-cli-key-help">{waitingForChoice ? '1 / 2 choose' : keyboardActive ? 'Enter / Space / ↓ advance' : 'Focus transcript for keys'}</span>
            <div className="lb-cli-step-controls">
              <Button type="button" variant="ghost" size="icon" className="lb-cli-control" disabled={state.step === 1} onClick={() => act({ type: 'previous' })} aria-label="Previous step" title="Previous step (↑)"><ArrowUp size={17} aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" className="lb-cli-control" disabled={waitingForChoice || state.step === CLI_STEPS} onClick={() => act({ type: 'next' })} aria-label="Next step" title="Next step (Enter, Space or ↓)"><ArrowDown size={17} aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" className="lb-cli-control lb-cli-reset" onClick={() => act({ type: 'reset' })} aria-label="Restart walkthrough" title="Restart walkthrough (Home)"><RotateCcw size={15} aria-hidden="true" /></Button>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
