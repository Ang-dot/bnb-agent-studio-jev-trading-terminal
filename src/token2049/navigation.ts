export type PublicPage = 'terminal' | 'architecture' | 'build';
export type NavigationMode = 'push' | 'pop';
export type ScrollPosition = { x: number; y: number };
type NavigationEntry = { key: string; scroll?: ScrollPosition };
const historyKey = '__lbNavigation';
let entrySequence = 0;

export const NAVIGATION_START_EVENT = 'lb:navigation-start';

/** A superseded request must not release a newer request's write guard. */
export function createNavigationGuard() {
  let sequence = 0, active: number | null = null;
  return {
    begin() { active = ++sequence; return active; },
    finish(request: number) { if (active === request) active = null; },
    isPending() { return active !== null; },
  };
}
export const workspaceNavigation = createNavigationGuard();

export function navigationEntry(state: unknown): NavigationEntry | null {
  if (!state || typeof state !== 'object') return null;
  const entry = (state as Record<string, unknown>)[historyKey] as Partial<NavigationEntry> | undefined;
  if (!entry || typeof entry.key !== 'string') return null;
  const scroll = entry.scroll;
  return { key: entry.key, ...(scroll && Number.isFinite(scroll.x) && Number.isFinite(scroll.y) ? { scroll } : {}) };
}

/** Merge our entry metadata; replay persistence must keep this and other history state intact. */
export function withNavigationEntry(state: unknown, scroll?: ScrollPosition): Record<string, unknown> & { __lbNavigation: NavigationEntry } {
  const previous = navigationEntry(state);
  const fields = state && typeof state === 'object' && !Array.isArray(state)
    ? state as Record<string, unknown>
    : state == null ? {} : { __lbPreviousState: state };
  return {
    ...fields,
    [historyKey]: { ...previous, key: previous?.key ?? `lb-${Date.now()}-${++entrySequence}`, ...(scroll ? { scroll } : {}) },
  };
}

export function destinationScroll(mode: NavigationMode, saved: ScrollPosition | undefined, hash: string):
  | { type: 'position'; position: ScrollPosition }
  | { type: 'fragment'; id: string } {
  if (mode === 'pop' && saved) return { type: 'position', position: saved };
  if (hash.length > 1) {
    try { return { type: 'fragment', id: decodeURIComponent(hash.slice(1)) }; }
    catch { return { type: 'fragment', id: hash.slice(1) }; }
  }
  return { type: 'position', position: { x: 0, y: 0 } };
}

/** An outgoing replay may save its session, but cannot edit a different history destination. */
export function replayDestination(owner: string, current: string, caseId: string, step: number, pending: boolean): URL | null {
  const previous = new URL(owner), next = new URL(current);
  if (pending || previous.origin !== next.origin || previous.pathname !== next.pathname || previous.search !== next.search) return null;
  if (publicPageForPath(next.pathname) !== 'terminal') return null;
  next.searchParams.set('case', caseId);
  next.searchParams.set('step', String(step));
  return next;
}

export function publicPageForPath(path: string): PublicPage | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized === '/token2049') return 'terminal';
  if (normalized === '/token2049/architecture') return 'architecture';
  if (normalized === '/token2049/build') return 'build';
  return null;
}
export function internalDestination(href: string, current: string): URL | null {
  const base = new URL(current), next = new URL(href, base);
  if (next.origin !== base.origin || !publicPageForPath(next.pathname)) return null;
  return next;
}
