import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchitecturePage } from './ArchitecturePage.js';
import { architectureReducer, initialArchitecture, architectureComponents, loadLatestReceipt, pageForPath } from './architecture-model.js';

describe('architecture presentation', () => {
  it('starts at the approved Studio spotlight, with honest SDK boundaries and a repository link', () => {
    const html = renderToStaticMarkup(<ArchitecturePage />);
    expect(html).toContain('From new launch to informed action.');
    expect(html).toContain('href="https://github.com/Ang-dot/bnb-agent-studio-jev-trading-terminal"');
    expect(html).toContain('Live signer locked');
    expect(html).toContain('No payment or public inference endpoint.');
    expect(html).toContain('aria-label="Inspect BNB Agent Studio"');
    expect(html).toContain('aria-label="Inspect BNB Agent SDK"');
    expect(html).not.toMatch(/alt="BNB Agent (Studio|SDK)"/);
    expect(html).not.toContain('OpenRouter');
    expect(html).not.toContain('Cloudflare');
    expect(html).toContain('Inspect GeckoTerminal API');
    expect(html).toContain('alt="GeckoTerminal"');
    expect(html).not.toContain('Bitquery');
    expect(html).not.toContain('CoinGecko');
  });
  it('moves a presenter through the journey without wrapping or affecting trading', () => {
    let state = architectureReducer(initialArchitecture, {type:'present'});
    expect(state).toEqual({component:'gmgn', step:0, presenting:true});
    state = architectureReducer(state, {type:'next'});
    expect(state.component).toBe('studio');
    state = architectureReducer(state, {type:'next'});
    expect(state.component).toBe('paper');
    state = architectureReducer(state, {type:'next'});
    expect(state.component).toBe('memory');
    expect(architectureReducer(state, {type:'next'})).toEqual(state);
    expect(architectureReducer(state, {type:'exit'}).presenting).toBe(false);
    expect(architectureReducer(initialArchitecture, {type:'select',component:'sdk'}).component).toBe('sdk');
  });
  it('gives every visible component a role, advantage and actual integration boundary', () => {
    expect(Object.keys(architectureComponents)).toHaveLength(11);
    for (const c of Object.values(architectureComponents)) {
      expect(c.role.length).toBeGreaterThan(30);
      expect(c.advantage.length).toBeGreaterThan(30);
      expect(c.demo.length).toBeGreaterThan(30);
    }
    expect(pageForPath('/architecture/')).toBe('architecture');
    expect(pageForPath('/operator')).toBe('terminal');
    expect(pageForPath('/')).toBe('terminal');
  });
  it('only reads a recorded receipt on demand and never starts an assessment', async () => {
    const decision = {id:'real',time:2,assessmentReceipt:{service:'BNB Agent Studio'}};
    const read = vi.fn().mockResolvedValue(new Response(JSON.stringify({decisions:[{id:'old',time:1},decision]})));
    expect(await loadLatestReceipt(read)).toEqual(decision);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe('/api/state');
    expect(read.mock.calls[0][1].method).toBe('GET');
    await expect(loadLatestReceipt(vi.fn().mockResolvedValue(new Response('',{status:503})))).rejects.toThrow('unavailable');
    expect(await loadLatestReceipt(vi.fn().mockResolvedValue(new Response('{"decisions":[]}')))).toBeNull();
  });
});
