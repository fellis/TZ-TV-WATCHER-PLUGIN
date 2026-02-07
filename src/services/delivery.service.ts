/**
 * DeliveryService - format pending events into report text for agent/cron delivery.
 * No direct sending - delivery is handled by OpenClaw cron (announce) or agent response.
 */

import type { IEventRepo, IWatchlistRepo, IEpisodeRepo } from '../interfaces/repositories';
import type { EventRecord } from '../interfaces/repositories';

const MAX_RETRIES = 3;

export interface DeliveryDeps {
  event: IEventRepo;
  watchlist: IWatchlistRepo;
  episode: IEpisodeRepo;
  logEvent?: (type: string, payload: unknown) => void;
}

function formatEventMessage(ev: EventRecord, watchlistTitle: string, payload: Record<string, unknown>): string {
  switch (ev.eventType) {
    case 'new_episode':
      return `${watchlistTitle} S${String(payload.season).padStart(2, '0')}E${String(payload.episode).padStart(2, '0')} - ${payload.episodeTitle}\nReleased: ${payload.airstamp}\nSource: ${payload.source}`;
    case 'date_changed':
      return `Date changed: ${watchlistTitle} S${payload.season}E${payload.episode}\nwas: ${payload.oldAirstamp}\nnow: ${payload.newAirstamp}`;
    case 'movie_released':
      return `${watchlistTitle} released\nDate: ${payload.releaseDate}`;
    case 'available_on_platform':
      return `${watchlistTitle} now on platform\nAvailable from: ${payload.releaseDate}`;
    default:
      return JSON.stringify(payload);
  }
}

export function createDeliveryService(deps: DeliveryDeps) {
  const { event, watchlist, episode, logEvent } = deps;

  /**
   * Collect pending/failed events, format report, mark delivered, return text.
   * Agent returns this text verbatim; cron delivers to the configured channel.
   */
  function prepareReport(): string {
    const pending = event.getPendingOrQueued();
    const failedRetry = event.getFailedForRetry(MAX_RETRIES);
    const toProcess = [...pending];
    for (const ev of failedRetry) {
      if (!toProcess.some((e) => e.id === ev.id)) toProcess.push(ev);
    }
    if (toProcess.length === 0) return 'No new updates.';

    const parts: string[] = [];
    const now = new Date().toISOString();

    for (const ev of toProcess) {
      const item = watchlist.getById(ev.watchlistId);
      if (!item) continue;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(ev.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      if (ev.eventType === 'new_episode' && !payload.episodeTitle && ev.refType === 'episode') {
        const epRec = episode.getById(ev.refId);
        if (epRec) payload.episodeTitle = epRec.title;
      }
      parts.push(formatEventMessage(ev, item.title, payload));
      event.updateStatus(ev.id, 'delivered', now);
    }

    if (parts.length === 0) return 'No new updates.';
    return 'TV Watcher updates:\n\n' + parts.join('\n\n');
  }

  return { prepareReport };
}
