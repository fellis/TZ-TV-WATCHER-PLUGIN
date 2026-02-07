/**
 * Repository interfaces - DB access layer.
 */

export interface WatchlistItem {
  id: number;
  contentType: 'series' | 'movie';
  source: string;
  externalId: string;
  title: string;
  year?: number;
  addedAt: string;
  meta?: string;
  externalIds?: string;
}

export interface IWatchlistRepo {
  add(item: Omit<WatchlistItem, 'id'>): number;
  remove(id: number): void;
  getById(id: number): WatchlistItem | null;
  getAll(contentType?: 'series' | 'movie'): WatchlistItem[];
  getByTitle(title: string): WatchlistItem | null;
  findDuplicate(source: string, externalId: string): WatchlistItem | null;
}

export interface EpisodeRecord {
  id: number;
  watchlistId: number;
  externalId: string;
  canonicalKey: string;
  season: number;
  episode: number;
  title: string;
  airstamp: string;
  status: string;
  fetchedAt: string;
}

export interface IEpisodeRepo {
  upsert(record: Omit<EpisodeRecord, 'id' | 'fetchedAt'>): number;
  getById(id: number): EpisodeRecord | null;
  getByWatchlist(watchlistId: number): EpisodeRecord[];
  getByCanonicalKey(watchlistId: number, canonicalKey: string): EpisodeRecord | null;
}

export interface EventRecord {
  id: number;
  watchlistId: number;
  refId: number;
  refType: 'episode' | 'movie_release';
  eventType: string;
  payload: string;
  createdAt: string;
  status: 'pending' | 'queued' | 'delivered' | 'failed';
  deliveredAt?: string;
  retryCount?: number;
}

export interface IEventRepo {
  add(record: Omit<EventRecord, 'id'>): number;
  getById(id: number): EventRecord | null;
  getPendingOrQueued(): EventRecord[];
  getFailedForRetry(maxRetries: number): EventRecord[];
  updateStatus(id: number, status: EventRecord['status'], deliveredAt?: string): void;
  incrementRetry(id: number): void;
}

export interface MovieReleaseRecord {
  id: number;
  watchlistId: number;
  canonicalKey: string;
  releaseDate: string;
  platformId: number | null;
  status: string;
  fetchedAt: string;
}

export interface IMovieReleaseRepo {
  upsert(record: Omit<MovieReleaseRecord, 'id' | 'fetchedAt'>): number;
  getByWatchlist(watchlistId: number): MovieReleaseRecord[];
  getByCanonicalKey(watchlistId: number, canonicalKey: string): MovieReleaseRecord | null;
}

export interface ISettingsRepo {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface SourceRecord {
  id: number;
  sourceId: string;
  enabled: number;
  apiKey: string;
}

export interface ISourceRepo {
  getAll(): SourceRecord[];
  getBySourceId(sourceId: string): SourceRecord | null;
  setEnabled(sourceId: string, enabled: boolean): void;
  setApiKey(sourceId: string, apiKey: string): void;
}

export interface PlatformRecord {
  id: number;
  externalId: string;
  name: string;
}

export interface IPlatformRepo {
  getAll(): PlatformRecord[];
  getByExternalId(externalId: string): PlatformRecord | null;
  add(externalId: string, name: string): number;
  remove(externalId: string): void;
}
