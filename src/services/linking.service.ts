/**
 * Linking service - canonical_key, normalization, confirm/deny.
 */

import type { IEntityLinkRepo } from '../repositories/entity-link.repo';
import type { IPendingLinkRepo } from '../repositories/pending-link.repo';

export function buildCanonicalKey(
  externalIds: { imdb?: string; thetvdb?: string } | undefined,
  source: string,
  externalId: string,
  season?: number,
  episode?: number
): string {
  if (externalIds?.imdb) {
    const base = `imdb:${externalIds.imdb}`;
    return season != null && episode != null ? `${base}:S${String(season).padStart(2, '0')}:E${String(episode).padStart(2, '0')}` : base;
  }
  if (externalIds?.thetvdb) {
    const base = `thetvdb:${externalIds.thetvdb}`;
    return season != null && episode != null ? `${base}:S${String(season).padStart(2, '0')}:E${String(episode).padStart(2, '0')}` : base;
  }
  const base = `${source}:${externalId}`;
  return season != null && episode != null ? `${base}:S${String(season).padStart(2, '0')}:E${String(episode).padStart(2, '0')}` : base;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNormalizedMatch(
  titleA: string,
  yearA: number | undefined,
  titleB: string,
  yearB: number | undefined,
  season?: number,
  episode?: number
): boolean {
  if (normalizeTitle(titleA) !== normalizeTitle(titleB)) return false;
  if (yearA != null && yearB != null && yearA !== yearB) return false;
  return true;
}

export function createLinkingService(
  entityLink: IEntityLinkRepo,
  pendingLink: IPendingLinkRepo
) {
  return {
    confirmLink(pendingId: number): string {
      const p = pendingLink.getById(pendingId);
      if (!p) return 'Pending link not found.';
      entityLink.add(p.sourceA, p.idA, p.sourceB, p.idB);
      pendingLink.remove(pendingId);
      return 'Link confirmed.';
    },
    denyLink(pendingId: number): string {
      const p = pendingLink.getById(pendingId);
      if (!p) return 'Pending link not found.';
      pendingLink.remove(pendingId);
      return 'Link denied.';
    },
  };
}
