/**
 * SQLite connection and migrations.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export type DbConnection = ReturnType<typeof createDb>;

export interface DbOptions {
  dbPath: string;
  workspacePath?: string;
}

export function createDb(options: DbOptions): Database.Database {
  const path = options.dbPath || resolveDefaultPath(options.workspacePath);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  runMigrations(db);
  return db;
}

function resolveDefaultPath(workspacePath?: string): string {
  const base = workspacePath || process.cwd();
  return `${base}/.openclaw/watchers/watchers.db`;
}

const MIGRATIONS: Array<{ version: number; sql?: string; run?: (db: Database.Database) => void }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_type TEXT NOT NULL,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        year INTEGER,
        added_at TEXT NOT NULL,
        meta TEXT,
        external_ids TEXT,
        UNIQUE(source, external_id)
      );
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watchlist_id INTEGER NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
        external_id TEXT NOT NULL,
        canonical_key TEXT NOT NULL,
        season INTEGER NOT NULL,
        episode INTEGER NOT NULL,
        title TEXT,
        airstamp TEXT,
        status TEXT,
        fetched_at TEXT
      );
      CREATE TABLE IF NOT EXISTS movie_releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watchlist_id INTEGER NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
        canonical_key TEXT NOT NULL,
        release_date TEXT,
        platform_id INTEGER,
        status TEXT,
        fetched_at TEXT
      );
      CREATE TABLE IF NOT EXISTS platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT UNIQUE NOT NULL,
        name TEXT,
        added_at TEXT
      );
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT UNIQUE NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        api_key TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS entity_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_a TEXT NOT NULL,
        id_a TEXT NOT NULL,
        source_b TEXT NOT NULL,
        id_b TEXT NOT NULL,
        confirmed_at TEXT,
        UNIQUE(source_a, id_a, source_b, id_b)
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watchlist_id INTEGER NOT NULL,
        ref_id INTEGER NOT NULL,
        ref_type TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        delivered_at TEXT
      );
      CREATE TABLE IF NOT EXISTS delivery_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        target_key TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        success INTEGER NOT NULL,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS events_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        event TEXT
      );
      CREATE TABLE IF NOT EXISTS translation_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_text TEXT NOT NULL,
        target_locale TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        created_at TEXT,
        UNIQUE(source_text, target_locale)
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_watchlist ON episodes(watchlist_id);
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    `,
  },
  {
    version: 2,
    sql: `
      INSERT OR IGNORE INTO sources (source_id, enabled, updated_at) VALUES ('tvmaze', 1, datetime('now'));
      INSERT OR IGNORE INTO sources (source_id, enabled, updated_at) VALUES ('tmdb', 0, datetime('now'));
      INSERT OR IGNORE INTO sources (source_id, enabled, updated_at) VALUES ('omdb', 0, datetime('now'));
      INSERT OR IGNORE INTO sources (source_id, enabled, updated_at) VALUES ('trakt', 0, datetime('now'));
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE events ADD COLUMN retry_count INTEGER DEFAULT 0;
    `,
    run: (db: Database.Database) => {
      const cols = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'retry_count')) {
        db.exec('ALTER TABLE events ADD COLUMN retry_count INTEGER DEFAULT 0');
      }
    },
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS pending_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_a TEXT NOT NULL,
        id_a TEXT NOT NULL,
        source_b TEXT NOT NULL,
        id_b TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
];

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);
  `);
  const applied = db.prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1').get() as
    | { version: number }
    | undefined;
  const currentVersion = applied?.version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version > currentVersion) {
      if (m.run) {
        m.run(db);
      } else if (m.sql) {
        db.exec(m.sql);
      }
      db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(m.version);
    }
  }
}
