import { describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { hostedSettings, authorizeOperator, publicState, publicJournalView, SharedReadCache } from './hosting.js';
import { initialState } from './store.js';
import type { TerminalState } from '../src/types.js';
import type { MemoryEpisode } from '../src/memory.js';

describe('hosted terminal safety', () => {
  it('refuses cloud mode without durable storage and an origin secret', () => {
    expect(() => hostedSettings({ HOSTING_MODE: 'cloud' })).toThrow();
    expect(hostedSettings({})).toBeNull();
    expect(hostedSettings({ HOSTING_MODE: 'cloud', SUPABASE_DATABASE_URL: 'postgresql://example', ORIGIN_SECRET: 'x'.repeat(40), PUBLIC_ORIGIN: 'https://jev.pages.dev' })?.bind).toBe('0.0.0.0');
    expect(() => hostedSettings({ HOSTING_MODE: 'cloud', SUPABASE_DATABASE_URL: 'postgresql://example', ORIGIN_SECRET: 'short', PUBLIC_ORIGIN: 'https://jev.pages.dev' })).toThrow();
  });
  it('requires a signed unexpired Access token for the exact audience and operator', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const key = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256' };
    const keys = createLocalJWKSet({ keys: [key] });
    const policy = { issuer: 'https://jev.cloudflareaccess.com', audience: 'jev-admin', email: 'operator@example.test' };
    const token = (email: string, audience = policy.audience, exp = '5m') => new SignJWT({ email }).setSubject('operator-subject').setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(policy.issuer).setAudience(audience).setIssuedAt().setExpirationTime(exp).sign(privateKey);
    expect(await authorizeOperator(await token(policy.email), policy, keys)).toBe(true);
    expect(await authorizeOperator(await token('visitor@example.test'), policy, keys)).toBe(false);
    expect(await authorizeOperator(await token(policy.email, 'other-app'), policy, keys)).toBe(false);
    expect(await authorizeOperator(await token(policy.email, policy.audience, '-1m'), policy, keys)).toBe(false);
    expect(await authorizeOperator('forged', policy, keys)).toBe(false);
    expect(await authorizeOperator(undefined, policy, keys)).toBe(false);
  });
  it('does not publish operational sessions, swap intents or private brain contents', () => {
    const s = { ...initialState(), paperSession: 'private-session', pools: [], providers: [], busy: false, discoveryError: null, database: 'private-host', sdk: {version:'0.6.0',chainId:56,walletAddress:'secret-wallet',registration:{private:'private-registration'}}, liveBlockers: [] } as TerminalState;
    s.decisions = [{id:'d',time:1,pool:'p',name:'token',action:'hold',status:'held',reasons:[],checks:[],memoryStatus:'Retrieved',intent:{private:'swap-intent'},memories:[{pageId:'page',title:'private-title',summary:'private-summary',slug:'private-slug',similarity:1,status:'active'}]}];
    const result = publicState(s);
    const json = JSON.stringify(result);
    for (const value of ['private-session','private-host','secret-wallet','private-registration','swap-intent','private-title','private-summary','private-slug']) expect(json).not.toContain(value);
    expect(result.access?.operator).toBe(false);
    expect(s.decisions[0].memories[0].title).toBe('private-title');
  });
  it('publishes journal status without raw episode evidence or provider source ids',()=>{
    const episode:MemoryEpisode={id:'episode',kind:'decision',token:'token',pool:'pool',name:'Token',createdAt:1,signature:'s',summary:'Public summary',content:{private:'raw research'},followUps:[],capture:{status:'stored',sourceId:'private-source',pageIds:['page'],attempts:1,nextAt:0},recalledBy:[]};
    const view=publicJournalView({recent:[episode],token:[episode],linked:episode,counts:{saved:1,available:1,recalled:0}});
    expect(JSON.stringify(view)).not.toContain('raw research');
    expect(JSON.stringify(view)).not.toContain('private-source');
    expect(view.recent[0].summary).toBe('Public summary');
  });
  it('deduplicates paid reads and enforces a global cache-miss budget, including failures', async () => {
    let calls = 0, now = 1000;
    const cache = new SharedReadCache(2, 60000, () => now);
    const read = async () => ++calls;
    expect(await Promise.all([cache.read('a', read), cache.read('a', read)])).toEqual([1,1]);
    expect(await cache.read('a', read)).toBe(1);
    await expect(cache.read('b', async () => { calls++; throw new Error('private provider detail'); })).rejects.toThrow();
    await expect(cache.read('b', read)).rejects.toThrow('Temporarily unavailable');
    await expect(cache.read('c', read)).rejects.toThrow('Read budget');
    expect(calls).toBe(2);
    now += 60001;
    expect(await cache.read('a', read)).toBe(3);
  });
});
