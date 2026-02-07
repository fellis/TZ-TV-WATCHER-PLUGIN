/**
 * Events repository.
 */

import type Database from 'better-sqlite3';
import type { IEventRepo, EventRecord } from '../interfaces/repositories';

function rowToRecord(row: Record<string, unknown>): EventRecord {
  return {
    id: row.id as number,
    watchlistId: row.watchlist_id as number,
    refId: row.ref_id as number,
    refType: row.ref_type as 'episode' | 'movie_release',
    eventType: row.event_type as string,
    payload: row.payload as string,
    createdAt: row.created_at as string,
    status: row.status as EventRecord['status'],
    deliveredAt: row.delivered_at as string | undefined,
    retryCount: (row.retry_count as number) ?? 0,
  };
}

export function createEventRepo(db: Database.Database): IEventRepo {
  return {
    getById(id: number): EventRecord | null {
      const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      return row ? rowToRecord(row) : null;
    },
    add(record: Omit<EventRecord, 'id'>): number {
      const result = db
        .prepare(
          `INSERT INTO events (watchlist_id, ref_id, ref_type, event_type, payload, created_at, status, delivered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.watchlistId,
          record.refId,
          record.refType,
          record.eventType,
          record.payload,
          record.createdAt,
          record.status,
          record.deliveredAt ?? null
        );
      return result.lastInsertRowid as number;
    },
    getPendingOrQueued(): EventRecord[] {
      const rows = db.prepare('SELECT * FROM events WHERE status IN (?, ?) ORDER BY created_at').all(
        'pending',
        'queued'
      ) as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    getFailedForRetry(maxRetries: number): EventRecord[] {
      const rows = db
        .prepare('SELECT * FROM events WHERE status = ? AND COALESCE(retry_count, 0) < ? ORDER BY created_at')
        .all('failed', maxRetries) as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    updateStatus(id: number, status: EventRecord['status'], deliveredAt?: string): void {
      db.prepare('UPDATE events SET status = ?, delivered_at = ? WHERE id = ?').run(
        status,
        deliveredAt ?? null,
        id
      );
    },
    incrementRetry(id: number): void {
      db.prepare('UPDATE events SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?').run(id);
    },
  };
}
