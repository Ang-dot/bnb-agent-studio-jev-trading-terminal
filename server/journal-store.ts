import type { Decision } from '../src/types.js';
import { memoryAvailable, type JournalView, type MemoryEpisode } from '../src/memory.js';
import type { Store } from './store.js';

export type { JournalView } from '../src/memory.js';

export interface EpisodeJournal {
  latest(token: string, kind: MemoryEpisode['kind']): Promise<MemoryEpisode | undefined>;
  get(id: string): Promise<MemoryEpisode | undefined>;
  byPages(pageIds: string[]): Promise<MemoryEpisode[]>;
  dueCapture(statuses: string[], now: number, limit: number, oldestFirst: boolean): Promise<MemoryEpisode[]>;
  dueFollowUp(now: number): Promise<MemoryEpisode | undefined>;
  unreviewedOutcomes(): Promise<MemoryEpisode[]>;
  insert(episode: MemoryEpisode): Promise<boolean>;
  update(id: string, change: (episode: MemoryEpisode) => void): Promise<MemoryEpisode | undefined>;
  view(token?: string, linkedId?: string, publicOnly?: boolean): Promise<JournalView>;
}

export function localJournal(store: Store): EpisodeJournal {
  const all = async () => (await store.read()).memoryEpisodes ?? [];
  return {
    latest: async (token, kind) => (await all()).find(e => e.token === token && e.kind === kind),
    get: async id => (await all()).find(e => e.id === id),
    byPages: async pageIds => pageIds.length ? (await all()).filter(e => e.capture.pageIds.some(id => pageIds.includes(id))) : [],
    dueCapture: async (statuses, now, limit, oldestFirst) => {
      const found = (await all()).filter(e => statuses.includes(e.capture.status) && e.capture.nextAt <= now);
      return (oldestFirst ? found.reverse() : found).slice(0, limit);
    },
    dueFollowUp: async now => (await all()).filter(e => e.followUps.some(f => f.status === 'waiting' && f.dueAt <= now))
      .sort((a, b) => Math.min(...a.followUps.filter(f => f.status === 'waiting').map(f => f.dueAt)) - Math.min(...b.followUps.filter(f => f.status === 'waiting').map(f => f.dueAt)))[0],
    unreviewedOutcomes: async () => {
      const episodes = await all();
      const reviewed = new Set(episodes.filter(e => e.kind === 'review').flatMap(e => e.content.episodeIds as string[] ?? []));
      return episodes.filter(e => e.kind === 'outcome' && e.content.horizonMinutes === 30 && !reviewed.has(e.id)).slice(-5);
    },
    insert: async episode => {
      let inserted = false;
      await store.mutate(s => { const entries = s.memoryEpisodes ??= []; if (!entries.some(e => e.id === episode.id)) { entries.unshift(episode); inserted = true; } });
      return inserted;
    },
    update: async (id, change) => {
      let updated: MemoryEpisode | undefined;
      await store.mutate(s => { const entry = s.memoryEpisodes?.find(e => e.id === id); if (entry) { change(entry); updated = structuredClone(entry); } });
      return updated;
    },
    view: async (token, linkedId) => {
      const episodes = await all();
      return {
        recent: episodes.slice(0, 6),
        token: token ? episodes.filter(e => e.token === token || e.kind === 'review').slice(0, 6) : episodes.slice(0, 6),
        linked: linkedId ? episodes.find(e => e.id === linkedId) : undefined,
        counts: { saved: episodes.length, available: episodes.filter(e => memoryAvailable(e.capture)).length, recalled: episodes.filter(e => e.recalledBy.length).length },
      };
    },
  };
}

export const pagesIn = (decision: Decision) => [...new Set(decision.memories.map(m => m.pageId))];
