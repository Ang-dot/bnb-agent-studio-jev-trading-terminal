import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { frontendRoute } from './frontend-route.js';
import { FrontendEditionProvider } from './FrontendEdition.js';
import { ArchitecturePage } from './ArchitecturePage.js';
import { architectureForEdition } from './architecture-model.js';
import { TradingTerminal } from './TradingTerminal.js';
import { ReplayDesk } from './ReplayDesk.js';
import { apiPath } from './api-path.js';

describe('event frontend navigation', () => {
  it.each(['kbw', 'token2049'] as const)('keeps %s terminal and architecture links in the same edition', edition => {
    for (const suffix of ['', '/']) {
      const terminal = frontendRoute(`/${edition}${suffix}`);
      const architecture = frontendRoute(`/${edition}/architecture${suffix}`);
      expect(terminal).toMatchObject({ edition, page: 'terminal', terminalPath: `/${edition}`, architecturePath: `/${edition}/architecture` });
      expect(architecture).toMatchObject({ ...terminal, page: 'architecture' });
      expect(architecture.redirectTo).toBeUndefined();
      expect(apiPath('/api/state', `/${edition}`)).toBe(`/api/${edition}/state`);
    }
  });

  it('redirects the old public entry points to KBW without redirecting an event route', () => {
    expect(frontendRoute('/').redirectTo).toBe('/kbw');
    expect(frontendRoute('/architecture/').redirectTo).toBe('/kbw/architecture');
    expect(frontendRoute('/token2049').redirectTo).toBeUndefined();
  });

  it.each(['/operator', '/operator/kbw', '/operator/token2049'])('keeps %s navigation and API calls inside the protected prefix', path => {
    const route = frontendRoute(path);
    expect(route.terminalPath).toBe(path);
    expect(route.architecturePath).toBe(`${path}/architecture`);
    expect(frontendRoute(route.architecturePath).page).toBe('architecture');
    expect(route.redirectTo).toBeUndefined();
    expect(apiPath('/api/state', route.architecturePath)).toBe(`/operator/api/${route.edition}/state`);
    expect(frontendRoute('/operator').edition).toBe('token2049');
    expect(apiPath('/api/state', '/operators/kbw')).toBe('/api/state');
  });
});

describe('event frontend branding', () => {
  it.each([
    ['kbw', 'MEM9', 'TiDB'],
    ['token2049', 'Living Brain', 'Living Brain'],
  ] as const)('renders the %s terminal, memory journal, replay and architecture with its own brand', (edition, name, logoAlt) => {
    const route = frontendRoute(`/${edition}`);
    const terminal = renderToStaticMarkup(<FrontendEditionProvider route={route}><TradingTerminal onReplay={() => {}} /></FrontendEditionProvider>);
    const architecture = renderToStaticMarkup(<FrontendEditionProvider route={route}><ArchitecturePage /></FrontendEditionProvider>);
    const replay = renderToStaticMarkup(<FrontendEditionProvider route={route}><ReplayDesk onLive={() => {}} /></FrontendEditionProvider>);
    expect(terminal).toContain(`href="/${edition}/architecture"`);
    expect(terminal).toContain(`alt="${logoAlt}"`);
    expect(terminal).toContain('Memory experience ledger');
    expect(terminal).toContain(name);
    expect(architecture).toContain(`href="/${edition}"`);
    expect(architecture).toContain(`href="/${edition}/architecture"`);
    expect(architecture).toContain(`aria-label="Inspect ${name}"`);
    expect(architecture).toContain(`alt="${logoAlt}"`);
    expect(replay).toContain(name.toUpperCase());
    expect(architectureForEdition(edition).memory.name).toBe(name);
    if (edition === 'kbw') {
      expect(terminal + architecture + replay).not.toContain('Living Brain');
      expect(architectureForEdition(edition).memory.note).toContain('Mem9');
    } else {
      expect(terminal + architecture + replay).not.toContain('MEM9');
    }
  });
});
