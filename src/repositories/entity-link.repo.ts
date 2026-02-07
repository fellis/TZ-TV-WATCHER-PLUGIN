/**
 * Entity links - confirmed mappings between sources.
 */

import type Database from 'better-sqlite3';

export interface EntityLink {
  id: number;
  sourceA: string;
  idA: string;
  sourceB: string;
  idB: string;
  confirmedAt: string;
}

export interface IEntityLinkRepo {
  find(sourceA: string, idA: string, sourceB: string, idB: string): EntityLink | null;
  add(sourceA: string, idA: string, sourceB: string, idB: string): void;
}

export function createEntityLinkRepo(db: Database.Database): IEntityLinkRepo {
  return {
    find(sourceA: string, idA: string, sourceB: string, idB: string): EntityLink | null {
      const row = db
        .prepare('SELECT * FROM entity_links WHERE source_a=? AND id_a=? AND source_b=? AND id_b=?')
        .get(sourceA, idA, sourceB, idB) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: row.id as number,
        sourceA: row.source_a as string,
        idA: row.id_a as string,
        sourceB: row.source_b as string,
        idB: row.id_b as string,
        confirmedAt: row.confirmed_at as string,
      };
    },
    add(sourceA: string, idA: string, sourceB: string, idB: string): void {
      const now = new Date().toISOString();
      db.prepare(
        'INSERT OR IGNORE INTO entity_links (source_a, id_a, source_b, id_b, confirmed_at) VALUES (?,?,?,?,?)'
      ).run(sourceA, idA, sourceB, idB, now);
    },
  };
}
