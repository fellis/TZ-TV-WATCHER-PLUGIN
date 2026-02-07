/**
 * Pending links - await user confirmation.
 */

import type Database from 'better-sqlite3';

export interface PendingLink {
  id: number;
  sourceA: string;
  idA: string;
  sourceB: string;
  idB: string;
  createdAt: string;
}

export interface IPendingLinkRepo {
  add(sourceA: string, idA: string, sourceB: string, idB: string): number;
  getById(id: number): PendingLink | null;
  remove(id: number): void;
}

export function createPendingLinkRepo(db: Database.Database): IPendingLinkRepo {
  return {
    add(sourceA: string, idA: string, sourceB: string, idB: string): number {
      const now = new Date().toISOString();
      const r = db.prepare(
        'INSERT INTO pending_links (source_a, id_a, source_b, id_b, created_at) VALUES (?,?,?,?,?)'
      ).run(sourceA, idA, sourceB, idB, now);
      return r.lastInsertRowid as number;
    },
    getById(id: number): PendingLink | null {
      const row = db.prepare('SELECT * FROM pending_links WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: row.id as number,
        sourceA: row.source_a as string,
        idA: row.id_a as string,
        sourceB: row.source_b as string,
        idB: row.id_b as string,
        createdAt: row.created_at as string,
      };
    },
    remove(id: number): void {
      db.prepare('DELETE FROM pending_links WHERE id = ?').run(id);
    },
  };
}
