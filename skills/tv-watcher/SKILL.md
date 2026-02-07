---
name: TV Watcher
description: Track TV series and movies, get notifications about new episodes, date changes, and streaming availability.
user-invocable: true
---

# TV Watcher

Track TV series and movies. Get notified about new episodes, date changes, and streaming availability.

## Important: use tools only

**Always use the TV Watcher tools** for any watchlist, series, or movie operations. Do not:

- Write custom Node.js or other scripts that import `better-sqlite3` or access the database directly
- Use the `exec` tool to run code that talks to the watchers DB

The database lives inside the plugin. Scripts run via `exec` execute in an isolated environment (e.g. `/tmp/`) where npm packages like `better-sqlite3` are not installed, so such scripts will fail with `ERR_MODULE_NOT_FOUND`.

For adding, searching, removing, or checking shows, use: `watch_add`, `watch_search`, `watch_remove`, `watch_list`, `watch_status`, `watch_check`, etc.

## Tools

| Tool | What it does |
|------|-------------|
| `watch_search` | Search for shows/movies by name |
| `watch_add` | Add to watchlist |
| `watch_remove` | Remove from watchlist |
| `watch_list` | Show current watchlist |
| `watch_status` | Show status and upcoming episodes for a title |
| `watch_recommend` | Get recommendations (requires TMDB or Trakt) |
| `watch_check` | Run checker: poll sources, find new episodes/releases, return report |
| `watch_set_locale` | Set interface language |
| `source_list` | List data sources and their status |
| `source_enable` | Enable a data source |
| `source_disable` | Disable a data source |
| `source_set_key` | Set API key for a source (DM only!) |
| `platform_list` | List user's streaming platforms |
| `platform_add` | Add a streaming platform |
| `platform_remove` | Remove a streaming platform |

## Natural language understanding

Understand user intent and call the right tool. Do not require exact syntax.

| User says | Tool |
|-----------|------|
| "add Fallout", "track Shogun", "add to watchlist" | `watch_add` |
| "remove Fallout", "stop tracking" | `watch_remove` |
| "what in watchlist", "my list", "what am I watching" | `watch_list` |
| "status Fallout", "what episodes", "what is new" | `watch_status` |
| "recommend something", "what to watch" | `watch_recommend` |
| "find Fallout", "search series" | `watch_search` |
| "enable TMDB", "add source" | `source_enable` |
| "add Netflix", "platform add disney-plus" | `platform_add` |
| "language uk", "switch to Russian" | `watch_set_locale` |
| "check for updates", "any new episodes?" | `watch_check` |

## Context resolution

- "add the second one" after search/recommendations - use the second item from the previous response.
- "remove this" / "delete that" - resolve from conversation context.
- "status" without a title - if only one item in watchlist, use it; otherwise ask.

## Setup / Onboarding

When the user first asks about tracking series or activating TV Watcher:

1. **Sources:** TVMaze works without an API key (series only). Ask if the user wants TMDB, OMDb, or Trakt for movies and recommendations. These need free API keys.
   - If yes: ask for the key, call `source_set_key`, then `source_enable`.
   - Remind: API keys should only be shared in DM, not in group chats.

2. **Notifications:** Ask if the user wants automatic notifications about new episodes.
   - If yes: ask how often (every morning, twice a day, etc.) and where to send (current chat or another).
   - Create a cron job using the built-in `cron.add` tool:
     ```json
     {
       "name": "TV Watcher check",
       "schedule": { "kind": "cron", "expr": "<user's schedule>", "tz": "<user's timezone>" },
       "sessionTarget": "isolated",
       "payload": { "kind": "agentTurn", "message": "Call the watch_check tool and return its result verbatim. Do not add commentary." },
       "delivery": { "mode": "announce", "channel": "<channel>", "to": "<chat_id>" }
     }
     ```
   - If the user says "send here", use the current channel and chat from the conversation context.

3. **Platforms:** Ask which streaming platforms the user subscribes to (Netflix, Disney+, etc.) and call `platform_add` for each.

4. **Language:** Detect from the user's language in chat. If they write in Ukrainian, call `watch_set_locale` with `uk`. If Russian - `ru`. Default is `en`.

## Changing notification settings

- "change notifications to 7am" - update the cron job schedule using `cron.update`.
- "stop notifications" - remove the cron job using `cron.remove`.
- "send notifications to Slack instead" - update the cron job delivery using `cron.update`.

## Commands (optional shortcuts)

Users may also use `/watch add X`, `/watch list`, `/source enable tmdb`, `/platform add netflix` etc. These are auto-reply commands that work without the AI agent.
