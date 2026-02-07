/**
 * Settings repository - key/value store.
 */

import type Database from 'better-sqlite3';
import type { ISettingsRepo } from '../interfaces/repositories';

export function createSettingsRepo(db: Database.Database): ISettingsRepo {
  return {
    get(key: string): string | null {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    },
    set(key: string, value: string): void {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run(key, value, now);
    },
  };
}
