/**
 * Episodes repository - cache from API.
 */

import type Database from 'better-sqlite3';
import type { IEpisodeRepo, EpisodeRecord } from '../interfaces/repositories';

function rowToRecord(row: Record<string, unknown>): EpisodeRecord {
  return {
    id: row.id as number,
    watchlistId: row.watchlist_id as number,
    externalId: row.external_id as string,
    canonicalKey: row.canonical_key as string,
    season: row.season as number,
    episode: row.episode as number,
    title: row.title as string,
    airstamp: row.airstamp as string,
    status: row.status as string,
    fetchedAt: row.fetched_at as string,
  };
}

export function createEpisodeRepo(db: Database.Database): IEpisodeRepo {
  return {
    upsert(record: Omit<EpisodeRecord, 'id' | 'fetchedAt'>): number {
      const now = new Date().toISOString();
      const existing = db
        .prepare('SELECT id FROM episodes WHERE watchlist_id = ? AND canonical_key = ?')
        .get(record.watchlistId, record.canonicalKey) as { id: number } | undefined;
      if (existing) {
        db.prepare(
          'UPDATE episodes SET external_id = ?, season = ?, episode = ?, title = ?, airstamp = ?, status = ?, fetched_at = ? WHERE id = ?'
        ).run(
          record.externalId,
          record.season,
          record.episode,
          record.title,
          record.airstamp,
          record.status,
          now,
          existing.id
        );
        return existing.id;
      }
      const result = db
        .prepare(
          'INSERT INTO episodes (watchlist_id, external_id, canonical_key, season, episode, title, airstamp, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          record.watchlistId,
          record.externalId,
          record.canonicalKey,
          record.season,
          record.episode,
          record.title,
          record.airstamp,
          record.status,
          now
        );
      return result.lastInsertRowid as number;
    },
    getById(id: number): EpisodeRecord | null {
      const row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      return row ? rowToRecord(row) : null;
    },
    getByWatchlist(watchlistId: number): EpisodeRecord[] {
      const rows = db.prepare('SELECT * FROM episodes WHERE watchlist_id = ? ORDER BY season, episode').all(
        watchlistId
      ) as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    getByCanonicalKey(watchlistId: number, canonicalKey: string): EpisodeRecord | null {
      const row = db.prepare('SELECT * FROM episodes WHERE watchlist_id = ? AND canonical_key = ?').get(
        watchlistId,
        canonicalKey
      ) as Record<string, unknown> | undefined;
      return row ? rowToRecord(row) : null;
    },
  };
}
