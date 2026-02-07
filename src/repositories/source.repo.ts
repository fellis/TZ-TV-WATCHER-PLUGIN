/**
 * Sources repository - data source config (enabled, api keys).
 */

import type Database from 'better-sqlite3';
import type { ISourceRepo, SourceRecord } from '../interfaces/repositories';

function rowToRecord(row: Record<string, unknown>): SourceRecord {
  return {
    id: row.id as number,
    sourceId: row.source_id as string,
    enabled: row.enabled as number,
    apiKey: row.api_key as string,
  };
}

export function createSourceRepo(db: Database.Database): ISourceRepo & { ensureExists(sourceId: string): void } {
  return {
    ensureExists(sourceId: string): void {
      db.prepare('INSERT OR IGNORE INTO sources (source_id, enabled, updated_at) VALUES (?, 0, ?)').run(
        sourceId,
        new Date().toISOString()
      );
    },
    getAll(): SourceRecord[] {
      const rows = db.prepare('SELECT * FROM sources').all() as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    getBySourceId(sourceId: string): SourceRecord | null {
      const row = db.prepare('SELECT * FROM sources WHERE source_id = ?').get(sourceId) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToRecord(row) : null;
    },
    setEnabled(sourceId: string, enabled: boolean): void {
      const now = new Date().toISOString();
      db.prepare('UPDATE sources SET enabled = ?, updated_at = ? WHERE source_id = ?').run(
        enabled ? 1 : 0,
        now,
        sourceId
      );
    },
    setApiKey(sourceId: string, apiKey: string): void {
      const now = new Date().toISOString();
      db.prepare('UPDATE sources SET api_key = ?, updated_at = ? WHERE source_id = ?').run(
        apiKey,
        now,
        sourceId
      );
    },
  };
}
