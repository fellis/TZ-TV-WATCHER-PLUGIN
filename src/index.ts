/**
 * TV Watcher plugin entry point for OpenClaw.
 */

import { createDb } from './db';
import { createSettingsRepo } from './repositories/settings.repo';
import { createWatchlistRepo } from './repositories/watchlist.repo';
import { createSourceRepo } from './repositories/source.repo';
import { createPlatformRepo } from './repositories/platform.repo';
import { createEpisodeRepo } from './repositories/episode.repo';
import { createMovieReleaseRepo } from './repositories/movie-release.repo';
import { createEventRepo } from './repositories/event.repo';
import { createEntityLinkRepo } from './repositories/entity-link.repo';
import { createPendingLinkRepo } from './repositories/pending-link.repo';
import { createWatchService } from './services/watch.service';
import { createSourceService } from './services/source.service';
import { createPlatformService } from './services/platform.service';
import { createCheckerService } from './services/checker.service';
import { createDeliveryService } from './services/delivery.service';
import { createLinkingService } from './services/linking.service';
import { createI18nService } from './services/i18n.service';
import { createTranslationService } from './services/translation.service';
import { createTools } from './tools';
import { parseCommand, handleCommand } from './commands';
import { createTranslationCacheRepo } from './repositories/translation-cache.repo';
import { join } from 'path';

export interface PluginConfig {
  timezone?: string;
  locale?: string;
  quietHours?: { start: string; end: string };
  dbPath?: string | null;
}

export interface PluginApi {
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: object;
    execute: (id: string, params: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
  }, opts?: { optional?: boolean }) => void;
  registerCommand?: (opts: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: {
      senderId?: string;
      channel?: string;
      isAuthorizedSender?: boolean;
      args?: string;
      commandBody?: string;
      config?: unknown;
    }) => Promise<{ text: string }> | { text: string };
  }) => void;
  registerService?: (id: string, service: { start: () => void; stop: () => void }) => void;
  config?: { plugins?: { entries?: Record<string, { config?: PluginConfig }> } };
  workspacePath?: string;
}

function getConfig(api: PluginApi, configParam?: PluginConfig): PluginConfig {
  if (configParam && Object.keys(configParam).length > 0) return configParam;
  const cfg = api.config?.plugins?.entries?.['tv-watcher']?.config;
  return (cfg as PluginConfig) ?? {};
}

export default function register(api: PluginApi, configParam?: PluginConfig) {
  const config = getConfig(api, configParam);
  const workspacePath = (api as { workspacePath?: string }).workspacePath ?? process.cwd();
  const dbPath = config.dbPath ?? `${workspacePath}/.openclaw/watchers/watchers.db`;

  const db = createDb({ dbPath, workspacePath });

  const settingsRepo = createSettingsRepo(db);
  const watchlistRepo = createWatchlistRepo(db);
  const sourceRepo = createSourceRepo(db);
  const platformRepo = createPlatformRepo(db);
  const episodeRepo = createEpisodeRepo(db);
  const movieReleaseRepo = createMovieReleaseRepo(db);
  const eventRepo = createEventRepo(db);
  const entityLinkRepo = createEntityLinkRepo(db);
  const pendingLinkRepo = createPendingLinkRepo(db);
  const translationCacheRepo = createTranslationCacheRepo(db);

  const i18nDir = join(__dirname, '..', 'i18n');
  const i18nService = createI18nService({ i18nDir });

  const translationService = createTranslationService({
    cache: translationCacheRepo,
  });

  // Seed settings from config on first run
  if (!settingsRepo.get('timezone')) {
    settingsRepo.set('timezone', config.timezone ?? 'Europe/Kyiv');
  }
  if (!settingsRepo.get('locale')) {
    settingsRepo.set('locale', config.locale ?? 'auto');
  }
  if (!settingsRepo.get('quiet_start') && config.quietHours) {
    settingsRepo.set('quiet_start', config.quietHours.start);
    settingsRepo.set('quiet_end', config.quietHours.end);
  }

  const watchService = createWatchService(watchlistRepo, sourceRepo);
  const sourceService = createSourceService(sourceRepo);
  const platformService = createPlatformService(platformRepo);
  const linkingService = createLinkingService(entityLinkRepo, pendingLinkRepo);

  const logEvent = (type: string, payload: unknown) => {
    try {
      db.prepare('INSERT INTO events_log (at, event) VALUES (?, ?)').run(
        new Date().toISOString(),
        JSON.stringify({ type, payload })
      );
    } catch (_e) {}
  };

  const checkerService = createCheckerService({
    watchlist: watchlistRepo,
    episode: episodeRepo,
    movieRelease: movieReleaseRepo,
    event: eventRepo,
    source: sourceRepo,
    settings: settingsRepo,
    logEvent,
  });

  const deliveryService = createDeliveryService({
    event: eventRepo,
    watchlist: watchlistRepo,
    episode: episodeRepo,
    logEvent,
  });

  /** Checker + prepareReport: returns text for agent/cron to deliver. */
  const runCheckReport = async () => {
    const { eventsCreated, errors } = await checkerService.run();
    const reportText = deliveryService.prepareReport();
    return { eventsCreated, reportText, errors };
  };

  const services = {
    watch: watchService,
    source: sourceService,
    platform: platformService,
    settings: settingsRepo,
    runCheckReport,
    linking: linkingService,
  };

  const tools = createTools(services);

  for (const tool of tools) {
    api.registerTool(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        async execute(id, params) {
          return tool.execute(id, params as never);
        },
      },
      { optional: true }
    );
  }

  if (api.registerCommand) {
    api.registerCommand({
      name: 'watch',
      description: 'TV Watcher: add/list/status/remove/quiet/tz/lang/check',
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const body = (ctx.args ?? ctx.commandBody ?? '').trim();
        const parsed = parseCommand('watch ' + (body || 'list'));
        if (!parsed) return { text: 'Usage: /watch add <query> | list | status <id> | remove <id> | quiet 23:00-09:00 | tz <tz> | lang <locale> | check' };
        const text = await handleCommand(parsed, services);
        return { text };
      },
    });
    api.registerCommand({
      name: 'source',
      description: 'TV Watcher: list/enable/disable/key for data sources',
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const body = (ctx.args ?? ctx.commandBody ?? '').trim();
        const parsed = parseCommand('source ' + (body || 'list'));
        if (!parsed) return { text: 'Usage: /source list | enable <id> | disable <id> | key <id> <key>' };
        const text = await handleCommand(parsed, services);
        return { text };
      },
    });
    api.registerCommand({
      name: 'platform',
      description: 'TV Watcher: list/add/remove streaming platforms',
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const body = (ctx.args ?? ctx.commandBody ?? '').trim();
        const parsed = parseCommand('platform ' + (body || 'list'));
        if (!parsed) return { text: 'Usage: /platform list | add <id> | remove <id>' };
        const text = await handleCommand(parsed, services);
        return { text };
      },
    });
  }
}
