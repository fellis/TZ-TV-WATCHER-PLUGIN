/**
 * Data source strategy interface.
 * Each source (TVMaze, TMDB, etc.) implements this.
 */

export interface SearchResult {
  source: string;
  externalId: string;
  contentType: 'series' | 'movie';
  title: string;
  year?: number;
  meta?: Record<string, unknown>;
  externalIds?: { imdb?: string; thetvdb?: string };
}

export interface EpisodeData {
  externalId: string;
  season: number;
  episode: number;
  title: string;
  airstamp: string;
  status: 'scheduled' | 'aired' | 'unknown';
}

export interface ReleaseData {
  canonicalKey: string;
  releaseDate: string;
  platformId?: number;
  status: 'announced' | 'released' | 'unknown';
}

export interface ProviderData {
  platformId: string;
  name: string;
  availableFrom?: string;
}

export interface IDataSource {
  id: string;
  requiresKey: boolean;
  search(query: string): Promise<SearchResult[]>;
  getEpisodes(externalId: string): Promise<EpisodeData[]>;
  getMovieReleases?(externalId: string): Promise<ReleaseData[]>;
  getWatchProviders?(externalId: string, country: string): Promise<ProviderData[]>;
}
