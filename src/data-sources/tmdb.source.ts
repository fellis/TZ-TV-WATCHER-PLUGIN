/**
 * TMDB data source - movies and TV, requires API key.
 */

import type { IDataSource, SearchResult, EpisodeData, ReleaseData, ProviderData } from '../interfaces/data-source';

const BASE = 'https://api.themoviedb.org/3';

export class TMDBSource implements IDataSource {
  id = 'tmdb';
  requiresKey = true;

  constructor(private apiKey: string) {}

  private async fetch<T>(path: string): Promise<T> {
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async search(query: string): Promise<SearchResult[]> {
    const [movieRes, tvRes] = await Promise.all([
      this.fetch<TMDBMovieSearch>(`/search/movie?query=${encodeURIComponent(query)}`),
      this.fetch<TMDBSeriesSearch>(`/search/tv?query=${encodeURIComponent(query)}`),
    ]);
    const results: SearchResult[] = [];
    for (const m of movieRes.results?.slice(0, 5) ?? []) {
      results.push({
        source: 'tmdb',
        externalId: `movie:${m.id}`,
        contentType: 'movie',
        title: m.title,
        year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : undefined,
        meta: { poster: m.poster_path },
        externalIds: m.imdb_id ? { imdb: m.imdb_id } : undefined,
      });
    }
    for (const t of tvRes.results?.slice(0, 5) ?? []) {
      results.push({
        source: 'tmdb',
        externalId: `tv:${t.id}`,
        contentType: 'series',
        title: t.name,
        year: t.first_air_date ? parseInt(t.first_air_date.slice(0, 4), 10) : undefined,
        meta: { poster: t.poster_path },
      });
    }
    return results;
  }

  async getEpisodes(externalId: string): Promise<EpisodeData[]> {
    const tvId = externalId.startsWith('tv:') ? externalId.slice(3) : externalId;
    const detail = await this.fetch<TMDBTVDetail>(`/tv/${tvId}`);
    const episodes: EpisodeData[] = [];
    const seasons = detail.number_of_seasons ?? 1;
    for (let s = 1; s <= seasons; s++) {
      try {
        const seasonData = await this.fetch<TMDBSeason>(`/tv/${tvId}/season/${s}`);
        for (const ep of seasonData.episodes ?? []) {
          episodes.push({
            externalId: String(ep.id),
            season: ep.season_number ?? s,
            episode: ep.episode_number ?? 0,
            title: ep.name ?? '',
            airstamp: ep.air_date ? `${ep.air_date}T00:00:00Z` : '',
            status: ep.air_date ? 'aired' : 'scheduled',
          });
        }
      } catch {
        break;
      }
    }
    return episodes;
  }

  async getMovieReleases(externalId: string): Promise<ReleaseData[]> {
    const movieId = externalId.startsWith('movie:') ? externalId.slice(6) : externalId;
    const detail = await this.fetch<TMDBMovieDetail>(`/movie/${movieId}`);
    const releases: ReleaseData[] = [];
    if (detail.release_date) {
      releases.push({
        canonicalKey: `tmdb:movie:${movieId}`,
        releaseDate: detail.release_date,
        status: 'released',
      });
    }
    return releases;
  }

  async getWatchProviders(externalId: string, country: string): Promise<ProviderData[]> {
    const isMovie = externalId.startsWith('movie:');
    const id = externalId.replace(/^(movie|tv):/, '');
    const path = isMovie ? `/movie/${id}/watch/providers` : `/tv/${id}/watch/providers`;
    const data = await this.fetch<{ results?: Record<string, { flatrate?: Array<{ provider_id: number; provider_name: string }> }> }>(path);
    const countryData = data.results?.[country.toUpperCase()];
    if (!countryData?.flatrate) return [];
    return countryData.flatrate.map((p) => ({
      platformId: String(p.provider_id),
      name: p.provider_name,
    }));
  }

  async getTrending(limit = 10): Promise<SearchResult[]> {
    const [movieRes, tvRes] = await Promise.all([
      this.fetch<TMDBTrending>(`/trending/movie/day`),
      this.fetch<TMDBTrending>(`/trending/tv/day`),
    ]);
    const results: SearchResult[] = [];
    for (const m of movieRes.results?.slice(0, limit) ?? []) {
      const item = m as { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string };
      results.push({
        source: 'tmdb',
        externalId: `movie:${item.id}`,
        contentType: 'movie',
        title: item.title ?? item.name ?? '',
        year: (item.release_date ?? item.first_air_date) ? parseInt((item.release_date ?? item.first_air_date ?? '').slice(0, 4), 10) : undefined,
      });
    }
    for (const t of tvRes.results?.slice(0, limit) ?? []) {
      const item = t as { id: number; name?: string; first_air_date?: string };
      results.push({
        source: 'tmdb',
        externalId: `tv:${item.id}`,
        contentType: 'series',
        title: item.name ?? '',
        year: item.first_air_date ? parseInt(item.first_air_date.slice(0, 4), 10) : undefined,
      });
    }
    return results;
  }
}

interface TMDBMovieSearch {
  results?: Array<{ id: number; title: string; release_date?: string; poster_path?: string; imdb_id?: string }>;
}
interface TMDBSeriesSearch {
  results?: Array<{ id: number; name: string; first_air_date?: string; poster_path?: string }>;
}
interface TMDBTVDetail {
  number_of_seasons?: number;
}
interface TMDBSeason {
  episodes?: Array<{ id: number; season_number: number; episode_number: number; name: string; air_date?: string }>;
}
interface TMDBMovieDetail {
  release_date?: string;
}
interface TMDBTrending {
  results?: Array<{ id: number; title?: string; name?: string; release_date?: string; first_air_date?: string }>;
}
