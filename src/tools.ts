/**
 * Agent tools - thin wrappers over services.
 */

import type { IWatchService, ISourceService, IPlatformService } from './interfaces/services';
import type { ISettingsRepo } from './interfaces/repositories';

export interface Services {
  watch: IWatchService;
  source: ISourceService;
  platform: IPlatformService;
  settings: ISettingsRepo;
  runCheckReport?: () => Promise<{ eventsCreated: number; reportText: string; errors: string[] }>;
}

export function createTools(services: Services) {
  const { watch, source, platform, settings, runCheckReport } = services;

  return [
    {
      name: 'watch_search',
      description:
        'Search for TV shows or movies by name. Triggers: find Fallout, search Shogun, look up series.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
      async execute(_id: string, params: { query: string }) {
        const results = await watch.search(params.query);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
        };
      },
    },
    {
      name: 'watch_add',
      description:
        'Add show or movie to watchlist. Triggers: add Fallout, track Shogun, add to watchlist.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Title or ID' },
          source: { type: 'string', description: 'Data source (tvmaze, tmdb)', default: 'tvmaze' },
        },
        required: ['query'],
      },
      async execute(_id: string, params: { query: string; source?: string }) {
        const item = await watch.add(params.query, params.source);
        return {
          content: [{ type: 'text' as const, text: `Added: ${item.title} (${item.contentType})` }],
        };
      },
    },
    {
      name: 'watch_remove',
      description:
        'Remove from watchlist. Triggers: remove Fallout, delete from list, stop tracking.',
      parameters: {
        type: 'object',
        properties: { idOrTitle: { type: 'string', description: 'ID or title' } },
        required: ['idOrTitle'],
      },
      async execute(_id: string, params: { idOrTitle: string }) {
        await watch.remove(params.idOrTitle);
        return {
          content: [{ type: 'text' as const, text: 'Removed from watchlist.' }],
        };
      },
    },
    {
      name: 'watch_list',
      description:
        'List tracked shows and movies. Triggers: what in watchlist, my list, what am I watching.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        const items = watch.list();
        const text = items.length
          ? items.map((i) => `- ${i.title} (${i.contentType}, ${i.source})`).join('\n')
          : 'Watchlist is empty.';
        return {
          content: [{ type: 'text' as const, text }],
        };
      },
    },
    {
      name: 'watch_status',
      description:
        'Get status and episodes for a show. Triggers: status Fallout, what episodes, what is new.',
      parameters: {
        type: 'object',
        properties: { idOrTitle: { type: 'string', description: 'ID or title' } },
        required: ['idOrTitle'],
      },
      async execute(_id: string, params: { idOrTitle: string }) {
        const result = await watch.status(params.idOrTitle);
        let text = `${result.item.title} (${result.item.contentType})\n`;
        if (result.episodes?.length) {
          text += result.episodes.slice(-5).map((e) => `  S${e.season}E${e.episode} ${e.title} - ${e.airstamp}`).join('\n');
        }
        return {
          content: [{ type: 'text' as const, text }],
        };
      },
    },
    {
      name: 'watch_recommend',
      description:
        'Get recommendations. Triggers: recommend something, what to watch, suggest series.',
      parameters: {
        type: 'object',
        properties: {
          genre: { type: 'string' },
          limit: { type: 'number', default: 5 },
        },
      },
      async execute(_id: string, params?: { genre?: string; limit?: number }) {
        try {
          const results = await watch.recommend(params);
          const text = results.length
            ? results.map((r) => `- ${r.title} (${r.contentType})`).join('\n')
            : 'No recommendations. Enable TMDB: source enable tmdb';
          return {
            content: [{ type: 'text' as const, text }],
          };
        } catch (e) {
          return {
            content: [{ type: 'text' as const, text: (e as Error).message }],
          };
        }
      },
    },
    {
      name: 'source_list',
      description: 'List data sources and their status. Triggers: source list, show sources.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        const list = source.list();
        const text = list.map((s) => {
          const status = s.enabled ? 'enabled' : 'disabled';
          const keyHint = (s as { hasKey?: boolean }).hasKey ? ' (key set)' : '';
          return `- ${s.sourceId}: ${status}${keyHint}`;
        }).join('\n');
        return {
          content: [{ type: 'text' as const, text }],
        };
      },
    },
    {
      name: 'source_enable',
      description: 'Enable a data source. Triggers: enable TMDB, turn on source.',
      parameters: {
        type: 'object',
        properties: { source_id: { type: 'string' } },
        required: ['source_id'],
      },
      async execute(_id: string, params: { source_id: string }) {
        source.enable(params.source_id);
        return {
          content: [{ type: 'text' as const, text: `Enabled ${params.source_id}` }],
        };
      },
    },
    {
      name: 'source_disable',
      description: 'Disable a data source.',
      parameters: {
        type: 'object',
        properties: { source_id: { type: 'string' } },
        required: ['source_id'],
      },
      async execute(_id: string, params: { source_id: string }) {
        source.disable(params.source_id);
        return {
          content: [{ type: 'text' as const, text: `Disabled ${params.source_id}` }],
        };
      },
    },
    {
      name: 'source_set_key',
      description: 'Set API key for a source. Use in DM only. Triggers: source key tmdb xxx.',
      parameters: {
        type: 'object',
        properties: {
          source_id: { type: 'string' },
          key: { type: 'string' },
        },
        required: ['source_id', 'key'],
      },
      async execute(_id: string, params: { source_id: string; key: string }) {
        source.setKey(params.source_id, params.key);
        return {
          content: [{ type: 'text' as const, text: `API key set for ${params.source_id}` }],
        };
      },
    },
    {
      name: 'platform_list',
      description: 'List streaming platforms. Triggers: platform list, my subscriptions.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        const list = platform.list();
        const text = list.length
          ? list.map((p) => `- ${p.externalId}: ${p.name}`).join('\n')
          : 'No platforms added.';
        return {
          content: [{ type: 'text' as const, text }],
        };
      },
    },
    {
      name: 'platform_add',
      description: 'Add streaming platform. Triggers: add Netflix, platform add disney-plus.',
      parameters: {
        type: 'object',
        properties: { platform_id: { type: 'string' } },
        required: ['platform_id'],
      },
      async execute(_id: string, params: { platform_id: string }) {
        platform.add(params.platform_id);
        return {
          content: [{ type: 'text' as const, text: `Added ${params.platform_id}` }],
        };
      },
    },
    {
      name: 'platform_remove',
      description: 'Remove streaming platform.',
      parameters: {
        type: 'object',
        properties: { platform_id: { type: 'string' } },
        required: ['platform_id'],
      },
      async execute(_id: string, params: { platform_id: string }) {
        platform.remove(params.platform_id);
        return {
          content: [{ type: 'text' as const, text: `Removed ${params.platform_id}` }],
        };
      },
    },
    {
      name: 'watch_check',
      description:
        'Check watchlist for new episodes, date changes, releases. Returns formatted report for delivery. Use in cron: agent calls this, returns result verbatim; cron delivers to channel.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        if (!runCheckReport) {
          return { content: [{ type: 'text' as const, text: 'watch_check not available.' }] };
        }
        try {
          const { eventsCreated, reportText, errors } = await runCheckReport();
          const errSuffix = errors.length ? `\nErrors: ${errors.join('; ')}` : '';
          const header = eventsCreated > 0 ? `Found ${eventsCreated} new event(s).\n\n` : '';
          return {
            content: [{ type: 'text' as const, text: header + reportText + errSuffix }],
          };
        } catch (e) {
          return {
            content: [{ type: 'text' as const, text: `Check failed: ${(e as Error).message}` }],
          };
        }
      },
    },
    {
      name: 'watch_set_locale',
      description: 'Set interface language. Triggers: language uk, watch lang ru, set locale.',
      parameters: {
        type: 'object',
        properties: { locale: { type: 'string', description: 'en, uk, ru, auto' } },
        required: ['locale'],
      },
      async execute(_id: string, params: { locale: string }) {
        settings.set('locale', params.locale);
        return {
          content: [{ type: 'text' as const, text: `Locale set to ${params.locale}` }],
        };
      },
    },
  ];
}
