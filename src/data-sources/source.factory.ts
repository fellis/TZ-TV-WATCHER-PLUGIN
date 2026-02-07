/**
 * DataSourceFactory - creates source by source_id.
 */

import type { IDataSource } from '../interfaces/data-source';
import { TVMazeSource } from './tvmaze.source';
import { TMDBSource } from './tmdb.source';
import { OMDbSource } from './omdb.source';
import { TraktSource } from './trakt.source';

export class DataSourceFactory {
  static get(sourceId: string, apiKey?: string): IDataSource {
    const id = sourceId.toLowerCase();
    switch (id) {
      case 'tvmaze':
        return new TVMazeSource();
      case 'tmdb':
        return new TMDBSource(apiKey ?? '');
      case 'omdb':
        return new OMDbSource(apiKey ?? '');
      case 'trakt':
        return new TraktSource(apiKey ?? '');
      default:
        throw new Error(`Unknown source: ${sourceId}`);
    }
  }

  static getAllIds(): string[] {
    return ['tvmaze', 'tmdb', 'omdb', 'trakt'];
  }
}
