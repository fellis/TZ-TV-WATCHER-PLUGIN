/**
 * TV Watcher plugin entry point for OpenClaw.
 */

import { createDb } from './db';
import { createSettingsRepo } from './repositories/settings.repo';
import { createWatchlistRepo } from './repositories/watchlist.repo';
import { createSourceRepo } from './repositories/source.repo';
import { createPlatformRepo } from './repositories/platform.repo';
import { createWatchService } from './services/watch.service';
import { createSourceService } from './services/source.service';
import { createPlatformService } from './services/platform.service';
import { createTools } from './tools';

export interface PluginConfig {
  targets?: Array<{ channel: string; chatId?: string; channelId?: string; to?: string }>;
  timezone?: string;
  locale?: string;
  quietHours?: { start: string; end: string };
  checkInterval?: string;
  deliverAt?: string | null;
  dbPath?: string | null;
  translation?: { defaultModel?: string; modelMap?: Record<string, string> };
}

export interface PluginApi {
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: object;
    execute: (id: string, params: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
  }, opts?: { optional?: boolean }) => void;
  registerService?: (id: string, service: { start: () => void; stop: () => void }) => void;
  workspacePath?: string;
}

export default function register(api: PluginApi, config: PluginConfig = {}) {
  const workspacePath = (api as { workspacePath?: string }).workspacePath ?? process.cwd();
  const dbPath = config.dbPath ?? `${workspacePath}/.openclaw/watchers/watchers.db`;

  const db = createDb({ dbPath, workspacePath });

  const settingsRepo = createSettingsRepo(db);
  const watchlistRepo = createWatchlistRepo(db);
  const sourceRepo = createSourceRepo(db);
  const platformRepo = createPlatformRepo(db);

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

  const services = {
    watch: watchService,
    source: sourceService,
    platform: platformService,
    settings: settingsRepo,
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
}
