/**
 * WatchService - add, remove, list, status, search, recommend.
 */

import type { IWatchService, StatusResult } from '../interfaces/services';
import type { IWatchlistRepo, ISourceRepo } from '../interfaces/repositories';
import { DataSourceFactory } from '../data-sources/source.factory';
import type { SearchResult } from '../interfaces/data-source';

export function createWatchService(
  watchlistRepo: IWatchlistRepo,
  sourceRepo: ISourceRepo
): IWatchService {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const sources = sourceRepo.getAll().filter((s) => s.enabled);
      if (sources.length === 0) {
        const tvmaze = DataSourceFactory.get('tvmaze');
        return tvmaze.search(query);
      }
      const results: SearchResult[] = [];
      for (const s of sources) {
        try {
          const ds = DataSourceFactory.get(s.sourceId, s.apiKey || undefined);
          const items = await ds.search(query);
          results.push(...items);
        } catch (_e) {
          // skip failed source
        }
      }
      return results;
    },

    async add(queryOrId: string, source = 'tvmaze'): Promise<import('../interfaces/repositories').WatchlistItem> {
      const dup = watchlistRepo.findDuplicate(source, queryOrId);
      if (dup) throw new Error('Already in watchlist');

      const src = sourceRepo.getBySourceId(source);
      const apiKey = src?.apiKey;
      const ds = DataSourceFactory.get(source, apiKey);
      const results = await ds.search(queryOrId);
      if (results.length === 0) throw new Error(`Not found: ${queryOrId}`);
      const match = results.find((r) => r.source === source && (r.externalId === queryOrId || r.title.toLowerCase().includes(queryOrId.toLowerCase())))
        || results[0];
      const id = watchlistRepo.add({
        contentType: match.contentType,
        source: match.source,
        externalId: match.externalId,
        title: match.title,
        year: match.year,
        addedAt: new Date().toISOString(),
        meta: match.meta ? JSON.stringify(match.meta) : undefined,
        externalIds: match.externalIds ? JSON.stringify(match.externalIds) : undefined,
      });
      const item = watchlistRepo.getById(id);
      if (!item) throw new Error('Failed to add');
      return item;
    },

    remove(idOrTitle: string): Promise<void> {
      const byId = /^\d+$/.test(idOrTitle) ? watchlistRepo.getById(parseInt(idOrTitle, 10)) : null;
      const item = byId ?? watchlistRepo.getByTitle(idOrTitle);
      if (!item) throw new Error(`Not found: ${idOrTitle}`);
      watchlistRepo.remove(item.id);
      return Promise.resolve();
    },

    list() {
      return watchlistRepo.getAll();
    },

    async status(idOrTitle: string): Promise<StatusResult> {
      const byId = /^\d+$/.test(idOrTitle) ? watchlistRepo.getById(parseInt(idOrTitle, 10)) : null;
      const item = byId ?? watchlistRepo.getByTitle(idOrTitle);
      if (!item) throw new Error(`Not found: ${idOrTitle}`);
      if (item.contentType !== 'series') {
        return { item };
      }
      const s = sourceRepo.getBySourceId(item.source);
      if (!s?.enabled) return { item };
      const ds = DataSourceFactory.get(item.source, s.apiKey || undefined);
      const episodes = await ds.getEpisodes(item.externalId);
      const externalIds = item.externalIds ? JSON.parse(item.externalIds || '{}') : {};
      return {
        item,
        episodes: episodes.map((ep) => ({
          season: ep.season,
          episode: ep.episode,
          title: ep.title,
          airstamp: ep.airstamp,
          status: ep.status,
        })),
      };
    },

    async recommend(opts?: { genre?: string; limit?: number }): Promise<SearchResult[]> {
      const limit = opts?.limit ?? 5;
      const sources = sourceRepo.getAll().filter((s) => s.enabled);
      const tmdb = sources.find((s) => s.sourceId === 'tmdb');
      const trakt = sources.find((s) => s.sourceId === 'trakt');
      if (!tmdb && !trakt) {
        throw new Error('For recommendations enable TMDB or Trakt: source enable tmdb');
      }
      try {
        if (tmdb?.enabled && tmdb.apiKey) {
          const ds = DataSourceFactory.get('tmdb', tmdb.apiKey) as { getTrending?: (n: number) => Promise<SearchResult[]> };
          if (ds.getTrending) return await ds.getTrending(limit);
        }
      } catch (_e) {
        // fallback to trakt
      }
      if (trakt?.enabled && trakt.apiKey) {
        const ds = DataSourceFactory.get('trakt', trakt.apiKey) as { getTrending?: (n: number) => Promise<SearchResult[]> };
        if (ds.getTrending) return await ds.getTrending(limit);
      }
      throw new Error('TMDB and Trakt unavailable. Check API keys.');
    },
  };
}
