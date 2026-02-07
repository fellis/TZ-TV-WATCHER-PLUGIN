/**
 * Platforms repository - streaming services.
 */

import type Database from 'better-sqlite3';
import type { IPlatformRepo, PlatformRecord } from '../interfaces/repositories';

function rowToRecord(row: Record<string, unknown>): PlatformRecord {
  return {
    id: row.id as number,
    externalId: row.external_id as string,
    name: row.name as string,
  };
}

export function createPlatformRepo(db: Database.Database): IPlatformRepo {
  return {
    getAll(): PlatformRecord[] {
      const rows = db.prepare('SELECT * FROM platforms').all() as Record<string, unknown>[];
      return rows.map(rowToRecord);
    },
    getByExternalId(externalId: string): PlatformRecord | null {
      const row = db.prepare('SELECT * FROM platforms WHERE external_id = ?').get(externalId) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToRecord(row) : null;
    },
    add(externalId: string, name: string): number {
      const now = new Date().toISOString();
      const r = db.prepare('INSERT INTO platforms (external_id, name, added_at) VALUES (?, ?, ?)').run(
        externalId,
        name || externalId,
        now
      );
      return r.lastInsertRowid as number;
    },
    remove(externalId: string): void {
      db.prepare('DELETE FROM platforms WHERE external_id = ?').run(externalId);
    },
  };
}
