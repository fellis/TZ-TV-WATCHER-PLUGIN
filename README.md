# TV Watcher Plugin for OpenClaw

Plugin for tracking TV series and movies, sending notifications about new episodes, date changes, and availability on streaming platforms.

## Features

- Natural language: "add Fallout", "what in watchlist", "recommend something"
- Data sources: TVMaze (series, no key), TMDB/OMDb/Trakt (with API keys)
- SQLite storage, SOLID architecture
- Tools: watch_search, watch_add, watch_remove, watch_list, watch_status, watch_recommend
- Commands: watch add/list/status/remove, source enable/disable, platform add/remove

## Install

```bash
openclaw plugins install @openclaw/tv-watcher
# or from local path
npm install ./path/to/TZ-TV-WATCHER-PLUGIN
```

## Config (plugins.entries.tv-watcher.config)

```yaml
targets:
  - channel: telegram
    chatId: "-123456"
timezone: "Europe/Kyiv"
locale: "auto"
quietHours: { start: "23:00", end: "09:00" }
checkInterval: "0 */6 * * *"
deliverAt: "09:05"
```

## Docs

- **[TZ.md](./TZ.md)** - full spec (Russian)

## License

MIT
