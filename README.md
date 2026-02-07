# TV Watcher Plugin for OpenClaw

Plugin for tracking TV series and movies, sending notifications about new episodes, date changes, and availability on streaming platforms.

## Features

- Natural language: "add Fallout", "what in watchlist", "recommend something"
- Data sources: TVMaze (series, no key), TMDB/OMDb/Trakt (with API keys)
- Notifications via OpenClaw cron jobs (agent sets up in chat)
- SQLite storage, SOLID architecture
- Tools: watch_search, watch_add, watch_remove, watch_list, watch_status, watch_recommend, watch_check
- Commands: /watch, /source, /platform

## Install

```bash
openclaw plugins install @openclaw/tv-watcher
```

## Usage

Just talk to the bot:

> "I want to track TV series"

The agent will guide you through setup: sources, API keys, notification schedule, streaming platforms.

## Config (optional)

`plugins.entries.tv-watcher.config`:

```json
{
  "timezone": "Europe/Kyiv",
  "locale": "auto",
  "quietHours": { "start": "23:00", "end": "09:00" }
}
```

Most settings are configured by the agent in chat.

## Docs

- **[TZ.md](./TZ.md)** - full spec (Russian)
- **[docs/INTEGRATION.md](./docs/INTEGRATION.md)** - integration with OpenClaw

## License

MIT
