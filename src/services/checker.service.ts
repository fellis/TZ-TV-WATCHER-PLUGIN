/**
 * CheckerFacade - orchestrates watchlist check: poll sources, create events.
 */

import type { IWatchlistRepo, IEpisodeRepo, IEventRepo, IMovieReleaseRepo, ISourceRepo, ISettingsRepo } from '../interfaces/repositories';
import type { WatchlistItem } from '../interfaces/repositories';
import { DataSourceFactory } from '../data-sources/source.factory';
import { buildCanonicalKey } from './linking.service';
import type { EpisodeData } from '../interfaces/data-source';

const MAX_RETRIES = 3;

export interface CheckerDeps {
  watchlist: IWatchlistRepo;
  episode: IEpisodeRepo;
  movieRelease: IMovieReleaseRepo;
  event: IEventRepo;
  source: ISourceRepo;
  settings: ISettingsRepo;
  logEvent?: (type: string, payload: unknown) => void;
}

export function createCheckerService(deps: CheckerDeps) {
  const { watchlist, episode, movieRelease, event, source, settings, logEvent } = deps;

  function isQuietHours(): boolean {
    const start = settings.get('quiet_start') ?? '23:00';
    const end = settings.get('quiet_end') ?? '09:00';
    const now = new Date();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (startMins > endMins) return nowMins >= startMins || nowMins < endMins;
    return nowMins >= startMins && nowMins < endMins;
  }

  function eventStatus(): 'pending' | 'queued' {
    return isQuietHours() ? 'queued' : 'pending';
  }

  async function run(): Promise<{ eventsCreated: number; errors: string[] }> {
    const errors: string[] = [];
    let eventsCreated = 0;

    const seriesItems = watchlist.getAll('series');
    const movieItems = watchlist.getAll('movie');

    for (const item of seriesItems) {
      const src = source.getBySourceId(item.source);
      if (!src || !src.enabled) continue;

      try {
        const ds = DataSourceFactory.get(item.source, src.apiKey || undefined);
        const eps = await ds.getEpisodes(item.externalId);
        const externalIds = item.externalIds ? JSON.parse(item.externalIds) : {};

        for (const ep of eps) {
          const canonicalKey = buildCanonicalKey(
            externalIds,
            item.source,
            ep.externalId,
            ep.season,
            ep.episode
          );
          const cached = episode.getByCanonicalKey(item.id, canonicalKey);

          if (!cached) {
            const epId = episode.upsert({
              watchlistId: item.id,
              externalId: ep.externalId,
              canonicalKey,
              season: ep.season,
              episode: ep.episode,
              title: ep.title,
              airstamp: ep.airstamp,
              status: ep.status,
            });
            event.add({
              watchlistId: item.id,
              refId: epId,
              refType: 'episode',
              eventType: 'new_episode',
              payload: JSON.stringify({
                title: item.title,
                season: ep.season,
                episode: ep.episode,
                episodeTitle: ep.title,
                airstamp: ep.airstamp,
                source: item.source,
              }),
              createdAt: new Date().toISOString(),
              status: eventStatus(),
            });
            eventsCreated++;
          } else if (cached.airstamp !== ep.airstamp) {
            event.add({
              watchlistId: item.id,
              refId: cached.id,
              refType: 'episode',
              eventType: 'date_changed',
              payload: JSON.stringify({
                title: item.title,
                season: ep.season,
                episode: ep.episode,
                oldAirstamp: cached.airstamp,
                newAirstamp: ep.airstamp,
              }),
              createdAt: new Date().toISOString(),
              status: eventStatus(),
            });
            eventsCreated++;
            episode.upsert({
              watchlistId: item.id,
              externalId: ep.externalId,
              canonicalKey,
              season: ep.season,
              episode: ep.episode,
              title: ep.title,
              airstamp: ep.airstamp,
              status: ep.status,
            });
          }
        }
      } catch (e) {
        errors.push(`${item.title} (${item.source}): ${(e as Error).message}`);
        logEvent?.('checker_source_error', { item: item.id, error: (e as Error).message });
      }
    }

    for (const item of movieItems) {
      const src = source.getBySourceId(item.source);
      if (!src || !src.enabled) continue;

      const ds = DataSourceFactory.get(item.source, src.apiKey || undefined);
      if (!ds.getMovieReleases) continue;

      try {
        const releases = await ds.getMovieReleases(item.externalId);
        const externalIds = item.externalIds ? JSON.parse(item.externalIds) : {};
        for (const rel of releases) {
          const key = rel.canonicalKey || buildCanonicalKey(externalIds, item.source, item.externalId);
          const cached = movieRelease.getByCanonicalKey(item.id, key);
          if (!cached && rel.status === 'released') {
            const mrId = movieRelease.upsert({
              watchlistId: item.id,
              canonicalKey: key,
              releaseDate: rel.releaseDate,
              platformId: rel.platformId ?? null,
              status: rel.status,
            });
            event.add({
              watchlistId: item.id,
              refId: mrId,
              refType: 'movie_release',
              eventType: rel.platformId ? 'available_on_platform' : 'movie_released',
              payload: JSON.stringify({
                title: item.title,
                releaseDate: rel.releaseDate,
                platformId: rel.platformId,
              }),
              createdAt: new Date().toISOString(),
              status: eventStatus(),
            });
            eventsCreated++;
          }
        }
      } catch (e) {
        errors.push(`${item.title} (${item.source}): ${(e as Error).message}`);
        logEvent?.('checker_source_error', { item: item.id, error: (e as Error).message });
      }
    }

    return { eventsCreated, errors };
  }

  return { run };
}
