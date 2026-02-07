/**
 * Auto-reply commands - watch add, watch list, etc.
 * Thin wrappers over services, parse args and call service.
 */

import type { IWatchService, ISourceService, IPlatformService } from './interfaces/services';
import type { ISettingsRepo } from './interfaces/repositories';

export interface CommandServices {
  watch: IWatchService;
  source: ISourceService;
  platform: IPlatformService;
  settings: ISettingsRepo;
}

export function parseCommand(text: string): { cmd: string; args: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('watch ') && !trimmed.startsWith('source ') && !trimmed.startsWith('platform ')) {
    return null;
  }
  const parts = trimmed.split(/\s+/);
  if (parts[0] === 'watch') {
    return { cmd: `watch_${parts[1] ?? 'list'}`, args: parts.slice(2) };
  }
  if (parts[0] === 'source') {
    return { cmd: `source_${parts[1] ?? 'list'}`, args: parts.slice(2) };
  }
  if (parts[0] === 'platform') {
    return { cmd: `platform_${parts[1] ?? 'list'}`, args: parts.slice(2) };
  }
  return null;
}

export async function handleCommand(
  parsed: { cmd: string; args: string[] },
  services: CommandServices
): Promise<string> {
  const { watch, source, platform, settings } = services;

  switch (parsed.cmd) {
    case 'watch_add':
      if (!parsed.args[0]) return 'Usage: watch add <query>';
      return (await watch.add(parsed.args[0])).title + ' added.';

    case 'watch_list':
      const items = watch.list();
      return items.length ? items.map((i) => `- ${i.title}`).join('\n') : 'Watchlist is empty.';

    case 'watch_status':
      if (!parsed.args[0]) return 'Usage: watch status <id|title>';
      const s = await watch.status(parsed.args[0]);
      return `${s.item.title}: ${s.episodes?.length ?? 0} episodes`;

    case 'watch_remove':
      if (!parsed.args[0]) return 'Usage: watch remove <id|title>';
      await watch.remove(parsed.args[0]);
      return 'Removed.';

    case 'watch_quiet':
      if (!parsed.args[0]) return 'Usage: watch quiet 23:00-09:00';
      const [start, end] = parsed.args[0].split('-');
      if (start && end) {
        settings.set('quiet_start', start.trim());
        settings.set('quiet_end', end.trim());
        return `Quiet hours: ${start}-${end}`;
      }
      return 'Usage: watch quiet 23:00-09:00';

    case 'watch_tz':
      if (!parsed.args[0]) return 'Usage: watch tz Europe/Kyiv';
      settings.set('timezone', parsed.args[0]);
      return `Timezone: ${parsed.args[0]}`;

    case 'watch_lang':
      if (!parsed.args[0]) return 'Usage: watch lang <en|uk|ru|auto>';
      settings.set('locale', parsed.args[0]);
      return `Locale: ${parsed.args[0]}`;

    case 'source_list':
      return source.list().map((s) => `- ${s.sourceId}: ${s.enabled ? 'on' : 'off'}`).join('\n');

    case 'source_enable':
      if (!parsed.args[0]) return 'Usage: source enable <id>';
      source.enable(parsed.args[0]);
      return `Enabled ${parsed.args[0]}`;

    case 'source_disable':
      if (!parsed.args[0]) return 'Usage: source disable <id>';
      source.disable(parsed.args[0]);
      return `Disabled ${parsed.args[0]}`;

    case 'source_key':
      if (parsed.args.length < 2) return 'Usage: source key <id> <key>';
      source.setKey(parsed.args[0], parsed.args.slice(1).join(' '));
      return 'API key set.';

    case 'platform_list':
      return platform.list().length
        ? platform.list().map((p) => `- ${p.externalId}`).join('\n')
        : 'No platforms.';

    case 'platform_add':
      if (!parsed.args[0]) return 'Usage: platform add <id>';
      platform.add(parsed.args[0]);
      return `Added ${parsed.args[0]}`;

    case 'platform_remove':
      if (!parsed.args[0]) return 'Usage: platform remove <id>';
      platform.remove(parsed.args[0]);
      return `Removed ${parsed.args[0]}`;

    default:
      return 'Unknown command.';
  }
}
