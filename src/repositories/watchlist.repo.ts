/**
 * Watchlist repository.
 */

import type Database from 'better-sqlite3';
import type { IWatchlistRepo, WatchlistItem } from '../interfaces/repositories';

function rowToItem(row: Record<string, unknown>): WatchlistItem {
  return {
    id: row.id as number,
    contentType: row.content_type as 'series' | 'movie',
    source: row.source as string,
    externalId: row.external_id as string,
    title: row.title as string,
    year: row.year != null ? (row.year as number) : undefined,
    addedAt: row.added_at as string,
    meta: row.meta as string | undefined,
    externalIds: row.external_ids as string | undefined,
  };
}

export function createWatchlistRepo(db: Database.Database): IWatchlistRepo {
  return {
    add(item: Omit<WatchlistItem, 'id'>): number {
      const stmt = db.prepare(
        `INSERT INTO watchlist (content_type, source, external_id, title, year, added_at, meta, external_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        item.contentType,
        item.source,
        item.externalId,
        item.title,
        item.year ?? null,
        item.addedAt,
        item.meta ?? null,
        item.externalIds ?? null
      );
      return result.lastInsertRowid as number;
    },
    remove(id: number): void {
      db.prepare('DELETE FROM watchlist WHERE id = ?').run(id);
    },
    getById(id: number): WatchlistItem | null {
      const row = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      return row ? rowToItem(row) : null;
    },
    getAll(contentType?: 'series' | 'movie'): WatchlistItem[] {
      const sql = contentType
        ? 'SELECT * FROM watchlist WHERE content_type = ? ORDER BY added_at DESC'
        : 'SELECT * FROM watchlist ORDER BY added_at DESC';
      const rows = (contentType
        ? db.prepare(sql).all(contentType)
        : db.prepare(sql).all()) as Record<string, unknown>[];
      return rows.map(rowToItem);
    },
    getByTitle(title: string): WatchlistItem | null {
      const row = db.prepare('SELECT * FROM watchlist WHERE LOWER(title) = LOWER(?)').get(title) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToItem(row) : null;
    },
    findDuplicate(source: string, externalId: string): WatchlistItem | null {
      const row = db.prepare('SELECT * FROM watchlist WHERE source = ? AND external_id = ?').get(
        source,
        externalId
      ) as Record<string, unknown> | undefined;
      return row ? rowToItem(row) : null;
    },
  };
}
