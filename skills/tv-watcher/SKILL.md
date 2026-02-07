# TV Watcher Skill

When the user talks about TV series, movies, watchlist, or recommendations - use the TV Watcher tools. Do not require exact command syntax. Understand intent and call the right tool.

## Phrase to Tool Mapping

| User says | Tool |
|-----------|------|
| add Fallout, track Shogun, add to watchlist | watch_add |
| remove Fallout, delete from list, stop tracking | watch_remove |
| what in watchlist, my list, what am I watching | watch_list |
| status Fallout, what episodes, what is new | watch_status |
| recommend something, what to watch | watch_recommend |
| find Fallout, search series | watch_search |
| enable TMDB, add source | source_enable |
| disable OMDb | source_disable |
| add Netflix, platform add disney-plus | platform_add |
| remove HBO from platforms | platform_remove |
| language uk, watch lang ru | watch_set_locale |

## Context

- "add the second one" after recommendations - use the second item from the previous response.
- "remove this" / "delete that" - resolve from conversation context.

## Commands (optional shortcut)

Users may use `watch add X`, `watch list`, etc. - these are shortcuts. Prefer understanding natural language.
