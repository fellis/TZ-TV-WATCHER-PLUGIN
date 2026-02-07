/**
 * Linking service - canonical_key, normalization.
 */

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
