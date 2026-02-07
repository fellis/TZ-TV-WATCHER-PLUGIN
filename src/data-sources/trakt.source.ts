/**
 * Trakt data source - trending, requires client_id as api_key.
 */

import type { IDataSource, SearchResult } from '../interfaces/data-source';

const BASE = 'https://api.trakt.tv';

export class TraktSource implements IDataSource {
  id = 'trakt';
  requiresKey = true;

  constructor(private clientId: string) {}

  private async fetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': this.clientId,
      },
    });
    if (!res.ok) throw new Error(`Trakt failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async search(query: string): Promise<SearchResult[]> {
    const res = await this.fetch<Array<{ type: string; show?: { title: string; year?: number; ids: { trakt: number } }; movie?: { title: string; year?: number; ids: { trakt: number } } }>>(
      `/search/movie,show?query=${encodeURIComponent(query)}`
    );
    return (res ?? []).slice(0, 10).map((item) => {
      const target = item.show ?? item.movie;
      const type = item.show ? 'series' : 'movie';
      return {
        source: 'trakt',
        externalId: String(target!.ids.trakt),
        contentType: type as 'series' | 'movie',
        title: target!.title,
        year: target!.year,
      };
    });
  }

  async getEpisodes(_externalId: string): Promise<import('../interfaces/data-source').EpisodeData[]> {
    return [];
  }

  async getTrending(limit = 10): Promise<SearchResult[]> {
    const [movies, shows] = await Promise.all([
      this.fetch<Array<{ movie: { title: string; year?: number; ids: { trakt: number } } }>>('/movies/trending'),
      this.fetch<Array<{ show: { title: string; year?: number; ids: { trakt: number } } }>>('/shows/trending'),
    ]);
    const results: SearchResult[] = [];
    for (const m of (movies ?? []).slice(0, limit)) {
      results.push({
        source: 'trakt',
        externalId: String(m.movie.ids.trakt),
        contentType: 'movie',
        title: m.movie.title,
        year: m.movie.year,
      });
    }
    for (const s of (shows ?? []).slice(0, limit)) {
      results.push({
        source: 'trakt',
        externalId: String(s.show.ids.trakt),
        contentType: 'series',
        title: s.show.title,
        year: s.show.year,
      });
    }
    return results;
  }
}
