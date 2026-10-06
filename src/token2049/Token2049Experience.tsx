import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { WorkspaceLoading } from './WorkspaceLoading.js';
import { destinationScroll, internalDestination, navigationEntry, NAVIGATION_START_EVENT, publicPageForPath, withNavigationEntry, workspaceNavigation, type NavigationMode, type PublicPage, type ScrollPosition } from './navigation.js';
import './theme.css';
import './trading.css';
import './transitions.css';

const loaders = {
  terminal: () => import('./TradingPage.js').then(m => m.TradingPage),
  architecture: () => import('./TradingArchitecture.js').then(m => m.TradingArchitecture),
  build: () => import('./BuildAgentPage.js').then(m => m.BuildAgentPage),
};
const loaded = new Map<PublicPage, Promise<ComponentType>>();
function loadPage(page: PublicPage) {
  if (!loaded.has(page)) loaded.set(page, loaders[page]().catch(error => { loaded.delete(page); throw error; }));
  return loaded.get(page)!;
}
type View = { page: PublicPage; Component: ComponentType; revision: number };
type Transition = { finished: Promise<void>; updateCallbackDone: Promise<void>; skipTransition(): void };
type Destination = { url: URL; mode: NavigationMode };
const currentScroll = (): ScrollPosition => ({ x: window.scrollX, y: window.scrollY });

export default function Token2049Experience({page: initialPage}: {page: PublicPage}) {
  const [view, setView] = useState<View | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const sequence = useRef(0), transition = useRef<Transition | null>(null);
  const mounted = useRef(true), failedDestination = useRef<Destination | null>(null);
  const activeTicket = useRef<number | null>(null), displayedEntry = useRef<string | null>(null);
  const positions = useRef(new Map<string, ScrollPosition>());

  const saveScroll = () => {
    const entry = navigationEntry(window.history.state);
    if (!entry || entry.key !== displayedEntry.current || workspaceNavigation.isPending()) return;
    const scroll = currentScroll();
    positions.current.set(entry.key, scroll);
    window.history.replaceState(withNavigationEntry(window.history.state, scroll), '', window.location.href);
  };

  useEffect(() => {
    if (!view) return;
    document.title = view.page === 'build' ? 'Build an agent | Trading Terminal' : view.page === 'architecture' ? 'Trading architecture | Trading Terminal' : 'Trading Terminal | Living Brain';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Explore selected event-driven trading stories, connected memory and the reasons behind each decision.');
    const timer = window.setTimeout(() => {
      for (const page of ['terminal', 'architecture', 'build'] as const) void loadPage(page).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [view?.page]);

  const navigate = async (url: URL, mode: NavigationMode = 'push') => {
    const page = publicPageForPath(url.pathname);
    if (!page) return;
    // Give fragment links their own scroll entry without resetting the current page's local state.
    const fragmentOnly = mode === 'push' && view?.page === page && url.pathname === window.location.pathname
      && url.search === window.location.search && Boolean(url.hash);
    if (mode === 'push') saveScroll();
    const destinationState = mode === 'pop' ? withNavigationEntry(window.history.state) : withNavigationEntry(null);
    const entry = navigationEntry(destinationState)!;
    const savedScroll = positions.current.get(entry.key) ?? entry.scroll;
    const request = ++sequence.current;
    const ticket = workspaceNavigation.begin();
    activeTicket.current = ticket;
    window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
    const delay = window.setTimeout(() => { if (mounted.current && request === sequence.current) setPending(true); }, 120);
    setError(false);
    try {
      const Component = fragmentOnly ? view!.Component : await loadPage(page);
      if (!mounted.current || request !== sequence.current) return;
      const commit = () => {
        if (!mounted.current || request !== sequence.current) return;
        const href = `${url.pathname}${url.search}${url.hash}`;
        if (mode === 'push') window.history.pushState(destinationState, '', href);
        // popstate changes the address before loading. Restore its captured URL before mounting readers.
        else window.history.replaceState(destinationState, '', href);
        displayedEntry.current = entry.key;
        workspaceNavigation.finish(ticket);
        flushSync(() => { if (!fragmentOnly) setView({ page, Component, revision: request }); setPending(false); });
        const scroll = destinationScroll(mode, savedScroll, url.hash);
        const fragment = scroll.type === 'fragment' ? document.getElementById(scroll.id) : null;
        if (fragment) fragment.scrollIntoView({ behavior: 'instant', block: 'start' });
        else window.scrollTo({ left: scroll.type === 'position' ? scroll.position.x : 0, top: scroll.type === 'position' ? scroll.position.y : 0, behavior: 'instant' });
        saveScroll();
        requestAnimationFrame(() => {
          if (!mounted.current || request !== sequence.current) return;
          const heading = fragment || document.querySelector<HTMLElement>('main h1')
            || document.querySelector<HTMLElement>('[role="region"][tabindex]') || document.querySelector<HTMLElement>('main');
          if (heading) {
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus({preventScroll: true});
          }
        });
      };
      transition.current?.skipTransition();
      const doc = document as Document & {startViewTransition?: (update: () => void) => Transition};
      if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        transition.current = doc.startViewTransition(commit);
        void transition.current.finished.catch(() => {});
        await transition.current.updateCallbackDone;
      } else commit();
    } catch { if (mounted.current && request === sequence.current) { failedDestination.current = { url, mode }; setError(true); } }
    finally {
      window.clearTimeout(delay);
      workspaceNavigation.finish(ticket);
      if (activeTicket.current === ticket) activeTicket.current = null;
      if (mounted.current && request === sequence.current) setPending(false);
    }
  };

  const latestNavigate = useRef(navigate); latestNavigate.current = navigate;
  useEffect(() => {
    mounted.current = true;
    const margin = document.body.style.margin, restoration = window.history.scrollRestoration;
    document.body.style.margin = '0';
    window.history.scrollRestoration = 'manual';
    window.history.replaceState(withNavigationEntry(window.history.state), '', window.location.href);
    displayedEntry.current = navigationEntry(window.history.state)!.key;
    let scrollTimer: number | undefined;
    const scroll = () => {
      const entry = navigationEntry(window.history.state);
      if (!entry || entry.key !== displayedEntry.current || workspaceNavigation.isPending()) return;
      positions.current.set(entry.key, currentScroll());
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(saveScroll, 150);
    };
    const pop = () => { void latestNavigate.current(new URL(window.location.href), 'pop'); };
    window.addEventListener('popstate', pop);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pagehide', saveScroll);
    // Initial loading uses the same request guard and retry mode as browser traversal.
    void latestNavigate.current(new URL(window.location.href), 'pop');
    return () => {
      saveScroll();
      mounted.current = false;
      ++sequence.current;
      if (activeTicket.current !== null) workspaceNavigation.finish(activeTicket.current);
      document.body.style.margin = margin;
      window.history.scrollRestoration = restoration;
      transition.current?.skipTransition();
      window.clearTimeout(scrollTimer);
      window.removeEventListener('popstate', pop);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('pagehide', saveScroll);
    };
  }, [initialPage]);

  const handleLink = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = internalDestination(anchor.href, window.location.href);
    if (!url) return;
    event.preventDefault();
    if (url.href === window.location.href) return;
    void navigate(url);
  };
  return <div className="lb-site-shell" onClick={handleLink}>
    {pending && <div className="lb-route-progress" role="status" aria-label="Loading page"/>}
    {error && <div className="lb-route-error" role="alert">This page couldn’t load. <button onClick={() => {
      const destination = failedDestination.current || { url: new URL(window.location.href), mode: 'pop' as const };
      void navigate(destination.url, destination.mode);
    }}>Try again</button></div>}
    {view ? <div className="lb-route-surface" key={view.revision}><view.Component/></div> : <WorkspaceLoading terminal={initialPage === 'build'}/>}
  </div>;
}
