/**
 * Movie releases repository - cache from API.
 */

import type Database from 'better-sqlite3';
import type { IMovieReleaseRepo, MovieReleaseRecord } from '../interfaces/repositories';

function rowToRecord(row: Record<string, unknown>): MovieReleaseRecord {
  return {
    id: row.id as number,
    watchlistId: row.watchlist_id as number,
    canonicalKey: row.canonical_key as string,
    releaseDate: row.release_date as string,
    platformId: row.platform_id as number | null,
    status: row.status as string,
    fetchedAt: row.fetched_at as string,
  };
}

export function createMovieReleaseRepo(db: Database.Database): IMovieReleaseRepo {
  return {
    upsert(record: Omit<MovieReleaseRecord, 'id' | 'fetchedAt'>): number {
      const now = new Date().toISOString();
      const existing = db
        .prepare('SELECT id FROM movie_releases WHERE watchlist_id = ? AND canonical_key = ?')
        .get(record.watchlistId, record.canonicalKey) as { id: number } | undefined;
      if (existing) {
        db.prepare(
          'UPDATE movie_releases SET release_date = ?, platform_id = ?, status = ?, fetched_at = ? WHERE id = ?'
        ).run(
          record.releaseDate,
          record.platformId,
          record.status,
          now,
          existing.id
        );
        return existing.id;
      }
      const result = db
        .prepare(
          'INSERT INTO movie_releases (watchlist_id, canonical_key, release_date, platform_id, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          record.watchlistId,
          record.canonicalKey,
          record.releaseDate,
          record.platformId,
          record.status,
          now
        );
      return result.lastInsertRowid as number;
    },
    getByWatchlist(watchlistId: number): MovieReleaseRecord[] {
      const rows = db.prepare('SELECT * FROM movie_releases WHERE watchlist_id = ?').all(
        watchlistId
      ) as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    getByCanonicalKey(watchlistId: number, canonicalKey: string): MovieReleaseRecord | null {
      const row = db.prepare('SELECT * FROM movie_releases WHERE watchlist_id = ? AND canonical_key = ?').get(
        watchlistId,
        canonicalKey
      ) as Record<string, unknown> | undefined;
      return row ? rowToRecord(row) : null;
    },
  };
}
