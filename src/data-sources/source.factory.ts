/**
 * DataSourceFactory - creates source by source_id.
 */

import type { IDataSource } from '../interfaces/data-source';
import { TVMazeSource } from './tvmaze.source';

const SOURCES: Record<string, () => IDataSource> = {
  tvmaze: () => new TVMazeSource(),
};

export class DataSourceFactory {
  static get(sourceId: string, _apiKey?: string): IDataSource {
    const factory = SOURCES[sourceId.toLowerCase()];
    if (!factory) throw new Error(`Unknown source: ${sourceId}`);
    return factory();
  }

  static getAllIds(): string[] {
    return Object.keys(SOURCES);
  }
}
