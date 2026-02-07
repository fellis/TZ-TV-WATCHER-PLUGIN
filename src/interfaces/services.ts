/**
 * Service interfaces - business logic layer.
 */

import type { SearchResult } from './data-source';
import type { WatchlistItem } from './repositories';

export interface StatusResult {
  item: WatchlistItem;
  episodes?: Array<{ season: number; episode: number; title: string; airstamp: string; status: string }>;
}

export interface IWatchService {
  search(query: string): Promise<SearchResult[]>;
  add(queryOrId: string, source?: string): Promise<WatchlistItem>;
  remove(idOrTitle: string): Promise<void>;
  list(): WatchlistItem[];
  status(idOrTitle: string): Promise<StatusResult>;
  recommend(opts?: { genre?: string; limit?: number }): Promise<SearchResult[]>;
}

export interface ISourceService {
  list(): Array<{ sourceId: string; enabled: boolean }>;
  enable(sourceId: string): void;
  disable(sourceId: string): void;
  setKey(sourceId: string, key: string): void;
}

export interface IPlatformService {
  list(): Array<{ id: number; externalId: string; name: string }>;
  add(platformId: string, name?: string): void;
  remove(platformId: string): void;
}
