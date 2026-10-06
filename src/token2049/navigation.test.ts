import { describe, expect, it } from 'vitest';
import { createNavigationGuard, destinationScroll, internalDestination, navigationEntry, publicPageForPath, replayDestination, withNavigationEntry } from './navigation.js';

const current = 'http://localhost:4173/token2049?case=coin1&step=3';
describe('public workspace navigation boundary', () => {
  it('keeps legacy, operator, external and unknown routes outside the local transition', () => {
    for (const href of ['/kbw', '/kbw/architecture', '/operator/token2049', '/token2049/other', 'https://other.example/token2049', 'javascript:void(0)']) {
      expect(internalDestination(href, current)).toBeNull();
    }
  });
  it('preserves the selected case, checkpoint and destination fragment', () => {
    expect(internalDestination('/token2049/architecture?case=coin1&step=3#diagram', current)?.href)
      .toBe('http://localhost:4173/token2049/architecture?case=coin1&step=3#diagram');
  });
  it('resolves within-page skip links so each fragment can retain a separate history scroll position', () => {
    expect(internalDestination('#main', current)?.href).toBe(`${current}#main`);
    expect(internalDestination('/token2049?case=unknown&step=1#decision', current)?.search).toBe('?case=unknown&step=1');
  });
  it('recognizes the three public pages including trailing slashes', () => {
    expect(publicPageForPath('/token2049/')).toBe('terminal');
    expect(publicPageForPath('/token2049/build/')).toBe('build');
    expect(publicPageForPath('/token2049/architecture/')).toBe('architecture');
  });
});

describe('history and navigation races', () => {
  it('preserves foreign state and entry identity when recording scroll or replay query updates', () => {
    const original = { external: { position: 7 }, anotherRouter: 'kept' };
    const first = withNavigationEntry(original, { x: 0, y: 410 });
    const updated = withNavigationEntry(first, { x: 15, y: 880 });
    expect(updated.external).toEqual(original.external);
    expect(updated.anotherRouter).toBe('kept');
    expect(navigationEntry(updated)?.key).toBe(navigationEntry(first)?.key);
    expect(navigationEntry(updated)?.scroll).toEqual({ x: 15, y: 880 });
    expect(original).toEqual({ external: { position: 7 }, anotherRouter: 'kept' });
    expect(navigationEntry(withNavigationEntry(null))?.key).not.toBe(navigationEntry(first)?.key);
  });

  it('restores Back/Forward positions and resolves new fragment destinations', () => {
    const saved = { x: 0, y: 620 };
    expect(destinationScroll('pop', saved, '#diagram')).toEqual({ type: 'position', position: saved });
    expect(destinationScroll('push', saved, '#memory%20map')).toEqual({ type: 'fragment', id: 'memory map' });
    expect(destinationScroll('pop', undefined, '#diagram')).toEqual({ type: 'fragment', id: 'diagram' });
    expect(destinationScroll('push', undefined, '')).toEqual({ type: 'position', position: { x: 0, y: 0 } });
    expect(destinationScroll('push', undefined, '#bad%encoding')).toEqual({ type: 'fragment', id: 'bad%encoding' });
  });

  it('blocks outgoing replay writes during traversal, including another query on the same route', () => {
    const oldPage = 'http://localhost:4173/token2049?case=coin1&step=3';
    const destination = 'http://localhost:4173/token2049?case=unknown&step=1';
    expect(replayDestination(oldPage, destination, 'coin1', 4, true)).toBeNull();
    // A failed load releases the guard, but the outgoing page still does not own this destination.
    expect(replayDestination(oldPage, destination, 'coin1', 4, false)).toBeNull();
    expect(replayDestination(oldPage, 'http://localhost:4173/token2049/architecture', 'coin1', 4, false)).toBeNull();
    expect(replayDestination(oldPage, oldPage, 'coin1', 4, true)).toBeNull();
    // The newly mounted page owns and may update the destination.
    expect(replayDestination(destination, destination, 'unknown', 2, false)?.search).toBe('?case=unknown&step=2');
  });

  it('keeps unrelated query fields and native fragments during an owned replay update', () => {
    const owner = `${current}&campaign=demo`;
    const url = replayDestination(owner, `${owner}#decision`, 'coin3', 1, false);
    expect(url?.searchParams.get('campaign')).toBe('demo');
    expect(url?.searchParams.get('case')).toBe('coin3');
    expect(url?.searchParams.get('step')).toBe('1');
    expect(url?.hash).toBe('#decision');
  });

  it('does not let a stale completion release a newer navigation, and unblocks after failure', () => {
    const guard = createNavigationGuard();
    const first = guard.begin();
    const second = guard.begin();
    guard.finish(first);
    expect(guard.isPending()).toBe(true);
    guard.finish(second);
    expect(guard.isPending()).toBe(false);
    const retry = guard.begin();
    expect(guard.isPending()).toBe(true);
    guard.finish(retry);
    expect(guard.isPending()).toBe(false);
  });
});
