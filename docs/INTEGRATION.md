# TV Watcher Plugin - Integration

How the plugin fits into OpenClaw (MoltBot).

## Plugin API used

| OpenClaw API | Usage |
|--------------|-------|
| `api.registerTool` | 15 agent tools (all optional): watch_search, watch_add, watch_check, etc. |
| `api.registerCommand` | Auto-reply commands: /watch, /source, /platform |
| `api.config` | Fallback for plugin config |

## How it works

1. User installs plugin: `openclaw plugins install @openclaw/tv-watcher`
2. Plugin registers tools and commands
3. Skill (`skills/tv-watcher/SKILL.md`) teaches the agent how to use the tools
4. User interacts via natural language in chat

## Notifications (cron)

Notifications use OpenClaw's built-in [Cron Jobs](https://docs.molt.bot/automation/cron-jobs).

The agent creates a cron job during setup (guided by the skill):
- Cron runs an isolated agent turn with message "Call watch_check tool..."
- Agent calls `watch_check`, which polls sources and returns formatted report
- Cron delivers the agent's response to the configured channel via `delivery.announce`

No custom delivery mechanism needed - OpenClaw handles it.

## Config

Minimal config in `plugins.entries.tv-watcher.config`:

```json
{
  "timezone": "Europe/Kyiv",
  "locale": "auto",
  "quietHours": { "start": "23:00", "end": "09:00" }
}
```

Most settings are configured by the agent in chat (sources, keys, platforms, cron schedule).

## Data sources

| Source | API key | Content |
|--------|---------|---------|
| TVMaze | not needed | series |
| TMDB | free, register | series + movies + recommendations |
| OMDb | free, register | search |
| Trakt | free, register | trending, search |

## Storage

SQLite at `<workspace>/.openclaw/watchers/watchers.db` (or `dbPath` in config).
