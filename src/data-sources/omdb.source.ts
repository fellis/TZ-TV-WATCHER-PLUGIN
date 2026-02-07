/**
 * OMDb data source - search only, requires API key.
 * No episodes, no recommendations.
 */

import type { IDataSource, SearchResult } from '../interfaces/data-source';

const BASE = 'https://www.omdbapi.com';

export class OMDbSource implements IDataSource {
  id = 'omdb';
  requiresKey = true;

  constructor(private apiKey: string) {}

  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch(`${BASE}/?apikey=${this.apiKey}&s=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`OMDb search failed: ${res.status}`);
    const data = (await res.json()) as { Search?: Array<{ imdbID: string; Title: string; Year: string; Type: string }>; Error?: string };
    if (data.Error) throw new Error(data.Error);
    const items = data.Search ?? [];
    return items.slice(0, 10).map((item) => ({
      source: 'omdb',
      externalId: item.imdbID,
      contentType: item.Type === 'series' ? 'series' : 'movie',
      title: item.Title,
      year: item.Year ? parseInt(item.Year, 10) : undefined,
      externalIds: { imdb: item.imdbID },
    }));
  }

  async getEpisodes(_externalId: string): Promise<import('../interfaces/data-source').EpisodeData[]> {
    return [];
  }
}
