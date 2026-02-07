# Плагин TV Watcher для OpenClaw - техническое задание

## 1. Обзор

Плагин OpenClaw для отслеживания сериалов и фильмов и отправки уведомлений о новых эпизодах, переносах дат и появлении на стриминговых площадках в настроенные каналы. **Основной режим:** пользователь говорит естественным языком ("добавь Fallout", "убери этот сериал", "что у меня в отслеживании"), агент понимает контекст и сам вызывает соответствующие инструменты. Явные команды (`watch add` и т.д.) - быстрый shortcut, но не обязательны.

---

## 2. Область применения

- **Платформа:** OpenClaw (MoltBot)
- **Распространение:** npm-пакет `@openclaw/tv-watcher` (или `@<scope>/openclaw-tv-watcher`), установка через `openclaw plugins install @scope/tv-watcher`
- **Хранилище:** SQLite (один файл `watchers.db` в workspace)
- **Источники:** TVMaze (сериалы, без ключа), TMDB / OMDb / Trakt (фильмы и сериалы, бесплатные API - регистрация, без оплаты)

---

## 3. Архитектура и паттерны проектирования

### 3.1 Принципы

- **SOLID:** каждый модуль - одна ответственность; зависимости через интерфейсы, а не конкретные реализации
- **Без дублирования:** бизнес-логика вынесена в service layer; tools и commands - тонкие обёртки над сервисами
- **Расширяемость:** добавление нового источника данных или канала не требует изменения существующего кода

### 3.2 Паттерны

| Паттерн    | Где применяется                                |
|------------|------------------------------------------------|
| Strategy   | Источники данных: общий интерфейс `IDataSource`, реализации `TVMazeSource`, `TMDBSource` и т.д. |
| Repository | Доступ к БД: `WatchlistRepo`, `EpisodeRepo`, `SettingsRepo` и т.д. - вся работа с SQLite за абстракцией |
| Service    | Бизнес-логика: `WatchService`, `SourceService`, `PlatformService` - вызываются из tools и commands |
| Factory    | `DataSourceFactory` - создание нужного клиента по `source_id` |
| Facade     | `CheckerFacade` - оркестрация проверки: загрузка watchlist, опрос источников, дедупликация, создание событий |

### 3.3 Слои

```
tools.ts / commands.ts          <- тонкие обёртки (вход)
        |
   services/                    <- бизнес-логика (WatchService, SourceService, PlatformService, CheckerFacade, DeliveryService)
        |
   repositories/                <- доступ к данным (WatchlistRepo, EpisodeRepo, EventRepo, SettingsRepo, ...)
        |
   data-sources/                <- внешние API (TVMazeSource, TMDBSource, OMDbSource, TraktSource)
        |
   db.ts                        <- SQLite: подключение, миграции
```

- **tools.ts / commands.ts** - принимают вход, вызывают сервис, форматируют ответ. Без бизнес-логики.
- **services/** - вся логика: добавить/удалить/проверить/отправить. Не знают о формате ввода (tool vs command).
- **repositories/** - CRUD над таблицами. Не знают о бизнес-правилах.
- **data-sources/** - реализации `IDataSource`. Не знают о БД.

### 3.4 Интерфейсы (ключевые)

```typescript
// Strategy: общий интерфейс для источников данных
interface IDataSource {
  id: string;                    // 'tvmaze' | 'tmdb' | ...
  requiresKey: boolean;
  search(query: string): Promise<SearchResult[]>;
  getEpisodes(externalId: string): Promise<EpisodeData[]>;
  getMovieReleases?(externalId: string): Promise<ReleaseData[]>;
  getWatchProviders?(externalId: string, country: string): Promise<ProviderData[]>;
}

// Repository: абстракция над БД
interface IWatchlistRepo {
  add(item: WatchlistItem): number;
  remove(id: number): void;
  getAll(): WatchlistItem[];
  getByTitle(title: string): WatchlistItem | null;
  findDuplicate(title: string, year?: number): WatchlistItem | null;
}

// Service: бизнес-логика
interface IWatchService {
  search(query: string): Promise<SearchResult[]>;
  add(query: string): Promise<WatchlistItem>;
  remove(idOrTitle: string): Promise<void>;
  list(): WatchlistItem[];
  status(idOrTitle: string): Promise<StatusResult>;
  recommend(opts?: { genre?: string; limit?: number }): Promise<SearchResult[]>;
}
```

---

## 4. Хранилище (SQLite)

### 4.1 Файл базы данных

- Путь: `<workspace>/.openclaw/watchers/watchers.db` (или настраивается в конфиге плагина)
- Схема: миграции при первом запуске, версионируются (v1, v2, ...)

### 4.2 Таблицы

**settings** (настройки, изменяемые через чат без рестарта gateway)

| Колонка | Тип  | Описание                         |
|---------|------|----------------------------------|
| key     | TEXT | PK (`timezone`, `quiet_start`, `quiet_end`, `locale`) |
| value   | TEXT | значение                         |
| updated_at | TEXT | ISO timestamp                 |

> Начальные значения берутся из конфига плагина при первом запуске. Далее команды `watch tz`, `watch quiet`, `watch lang` пишут в эту таблицу и применяются сразу, без рестарта.

**watchlist**

| Колонка      | Тип     | Описание                                      |
|--------------|---------|-----------------------------------------------|
| id           | INTEGER | PK, autoincrement                             |
| content_type | TEXT    | `series` \| `movie`                           |
| source       | TEXT    | `tvmaze` \| `tmdb` \| `omdb` \| `trakt`      |
| external_id  | TEXT    | showId / movieId из API                       |
| title        | TEXT    | Отображаемое название                         |
| year         | INTEGER | Год выхода (для дедупликации)                 |
| added_at     | TEXT    | ISO timestamp                                 |
| meta         | TEXT    | JSON (url, image, director и т.д.)            |
| external_ids | TEXT    | JSON (`{ imdb, thetvdb }` - для связывания)   |

- UNIQUE constraint: `(source, external_id)` - нельзя добавить дубль из одного источника

**episodes** (сериалы, кэш из API)

| Колонка       | Тип    | Описание                                  |
|---------------|--------|-------------------------------------------|
| id            | INTEGER| PK, autoincrement                         |
| watchlist_id  | INTEGER| FK → watchlist(id) ON DELETE CASCADE      |
| external_id   | TEXT   | episodeId из API                          |
| canonical_key | TEXT   | для дедупликации: `imdb:tt123:S02:E08`    |
| season        | INTEGER| номер сезона                              |
| episode       | INTEGER| номер эпизода                             |
| title         | TEXT   | название эпизода                          |
| airstamp      | TEXT   | ISO UTC                                   |
| status        | TEXT   | `scheduled` \| `aired` \| `unknown`       |
| fetched_at    | TEXT   | ISO timestamp                             |

**movie_releases** (фильмы, дата релиза / появление на площадках)

| Колонка       | Тип    | Описание                                  |
|---------------|--------|-------------------------------------------|
| id            | INTEGER| PK, autoincrement                         |
| watchlist_id  | INTEGER| FK → watchlist(id) ON DELETE CASCADE      |
| canonical_key | TEXT   | для дедупликации: `imdb:tt456`            |
| release_date  | TEXT   | ISO date                                  |
| platform_id   | INTEGER| FK → platforms(id), NULL = theatrical     |
| status        | TEXT   | `announced` \| `released` \| `unknown`    |
| fetched_at    | TEXT   | ISO timestamp                             |

**platforms** (подписки пользователя - стриминговые площадки)

| Колонка    | Тип    | Описание                                  |
|------------|--------|-------------------------------------------|
| id         | INTEGER| PK, autoincrement                         |
| external_id| TEXT   | UNIQUE; `netflix`, `disney-plus` и т.д.   |
| name       | TEXT   | Отображаемое название                     |
| added_at   | TEXT   | ISO timestamp                             |

**sources** (источники данных - включены ли, API-ключи)

| Колонка    | Тип    | Описание                                  |
|------------|--------|-------------------------------------------|
| id         | INTEGER| PK, autoincrement                         |
| source_id  | TEXT   | UNIQUE; `tvmaze`, `tmdb`, `omdb`, `trakt` |
| enabled    | INTEGER| 0/1                                       |
| api_key    | TEXT   | ключ (не логировать, маскировать)         |
| updated_at | TEXT   | ISO timestamp                             |

> При первом запуске `tvmaze` добавляется как enabled без ключа. Остальные - disabled, ключ пуст.

**entity_links** (подтверждённые пользователем связи: один контент в разных источниках)

| Колонка      | Тип    | Описание                              |
|--------------|--------|---------------------------------------|
| id           | INTEGER| PK, autoincrement                     |
| source_a     | TEXT   | напр. `tvmaze`                        |
| id_a         | TEXT   | external_id в источнике A             |
| source_b     | TEXT   | напр. `tmdb`                          |
| id_b         | TEXT   | external_id в источнике B             |
| confirmed_at | TEXT   | ISO timestamp                         |

- UNIQUE constraint: `(source_a, id_a, source_b, id_b)`

**events** (все события - единая модель)

| Колонка      | Тип    | Описание                                                    |
|--------------|--------|-------------------------------------------------------------|
| id           | INTEGER| PK, autoincrement                                           |
| watchlist_id | INTEGER| FK → watchlist(id)                                          |
| ref_id       | INTEGER| FK → episodes(id) или movie_releases(id), в зависимости от типа |
| ref_type     | TEXT   | `episode` \| `movie_release`                                |
| event_type   | TEXT   | `new_episode` \| `date_changed` \| `movie_released` \| `available_on_platform` |
| payload      | TEXT   | JSON (old/new airstamp, platform и т.д.)                    |
| created_at   | TEXT   | ISO timestamp                                               |
| status       | TEXT   | `pending` \| `queued` \| `delivered` \| `failed`            |
| delivered_at | TEXT   | ISO timestamp, NULL до доставки                             |

> Объединяет прежние `notifications` и `queue`. Одна таблица, одна модель жизненного цикла: pending → queued (тихие часы) или pending → delivered. При ошибке доставки: failed (с retry).

**delivery_log** (какое событие куда отправлено)

| Колонка    | Тип    | Описание                              |
|------------|--------|---------------------------------------|
| id         | INTEGER| PK, autoincrement                     |
| event_id   | INTEGER| FK → events(id)                       |
| target_key | TEXT   | напр. `telegram:-5233765153`          |
| sent_at    | TEXT   | ISO timestamp                         |
| success    | INTEGER| 0/1                                   |
| error      | TEXT   | текст ошибки или NULL                 |

**events_log** (журнал для аудита, опционально append-only)

| Колонка | Тип    | Описание              |
|---------|--------|-----------------------|
| id      | INTEGER| PK, autoincrement     |
| at      | TEXT   | ISO timestamp         |
| event   | TEXT   | JSON (type, payload)  |

**translation_cache** (кэш переводов LLM, для снижения нагрузки)

| Колонка   | Тип    | Описание                              |
|-----------|--------|---------------------------------------|
| id        | INTEGER| PK, autoincrement                     |
| source_text | TEXT | исходный текст (хеш при длине > 200)  |
| target_locale | TEXT | целевой язык (en, uk, ru...)       |
| translated_text | TEXT | результат перевода                |
| created_at | TEXT  | ISO timestamp                         |

- UNIQUE constraint: `(source_text, target_locale)` или по хешу при длинных текстах

---

## 5. Конфигурация

### 5.1 Конфиг плагина (`plugins.entries.tv-watcher.config`)

Конфиг - начальные значения. После первого запуска изменяемые настройки (timezone, quietHours) хранятся в таблице `settings` и управляются через чат.

```yaml
# Цели для уведомлений (все каналы OpenClaw)
targets:
  - channel: telegram
    chatId: "-5233765153"
  - channel: slack
    channelId: "C01234ABCD"
  # discord, whatsapp и т.д. - тот же формат

# Начальные значения (далее управляются через чат)
timezone: "Europe/Kyiv"
locale: "auto"              # "auto" = язык интерфейса канала, иначе "en", "uk", "ru" и т.д.
quietHours:
  start: "23:00"
  end: "09:00"

# Расписание проверок
checkInterval: "0 */6 * * *"   # каждые 6 часов
deliverAt: "09:05"             # утренний дайджест, или null

# Путь к БД (опционально)
dbPath: null                   # по умолчанию <workspace>/.openclaw/watchers/watchers.db

# Перевод контента: дешёвая модель (не модель агента)
translation:
  defaultModel: "gpt-4o-mini"  # если провайдер не в маппинге
  # modelMap: { openai: "gpt-4o-mini", anthropic: "claude-3-haiku", ... }  # опционально, переопределение
```

### 5.2 Схема конфига (openclaw.plugin.json)

- `targets`: массив `{ channel, chatId | channelId | to }` - обязательно, минимум 1
- `timezone`: строка, по умолчанию `Europe/Kyiv`
- `locale`: `"auto"` (язык канала) или код языка (`en`, `uk`, `ru` и т.д.), по умолчанию `"auto"`
- `quietHours`: `{ start, end }` или `null` для отключения
- `checkInterval`: cron-выражение, по умолчанию каждые 6 ч
- `deliverAt`: HH:mm или null
- `dbPath`: строка или null
- `translation.defaultModel`: модель для переводов при отсутствии провайдера в маппинге
- `translation.modelMap`: опционально, переопределение провайдер → простая модель

### 5.3 Хранение настроек

- При первом запуске (миграция): значения из конфига плагина записываются в таблицу `settings`.
- Далее **единственный источник правды - БД**. Конфиг больше не проверяется.
- Команды `watch tz` / `watch quiet` / `watch lang` пишут в БД и применяются сразу, без рестарта.

### 5.4 Язык и локализация

**Выбор языка пользователем:**
- В настройках хранится `locale`. По умолчанию: `"auto"` - используется язык интерфейса канала (если Gateway предоставляет его в контексте сообщения).
- Явная установка: `watch lang uk` / `watch lang en` / `watch lang auto`
- Инструмент: `watch_set_locale` (или параметр в другом tool при необходимости)
- Команда: `watch lang <locale>` - задаёт язык для всех ответов плагина (списки, уведомления, описания)

**i18n через CSV:**
- Все UI-строки плагина (сообщения, форматы уведомлений, названия команд) хранятся в CSV.
- Структура: `i18n/<locale>.csv` - ключ, значение. Пример:
  ```
  key,value
  new_episode_title,"{title} S{season}E{episode} - {episodeTitle}"
  released_at,"Вышел"
  source_label,"Источник"
  watch_added,"Добавлено в отслеживание"
  ...
  ```
- Английский `en` - базовая локализация (в комплекте). Другие языки - по мере наличия файлов.

**Генерация локализации LLM (если CSV нет):**
- Если запрошен `locale=uk`, а файла `i18n/uk.csv` нет - плагин создаёт LLM task один раз:
  - Вход: эталонный `i18n/en.csv` (ключи + значения)
  - Промпт: "Переведи значения (колонка value) на язык [uk]. Ключи не трогай. Верни CSV в том же формате."
  - Результат сохраняется в `i18n/uk.csv` (или в `<workspace>/.openclaw/watchers/i18n/uk.csv`).
- Повторных вызовов нет - файл переиспользуется.
- Если LLM недоступен - fallback на `en`.

**Перевод контента API (названия, описания) на лету:**
- Данные из TVMaze, TMDB и т.д. приходят чаще всего на английском.
- Перед отображением пользователю: названия шоу/фильмов, названия эпизодов, описания (summary) переводятся на выбранный `locale`.
- **Простая задача** - перевод не требует «умной» модели. Используем только дешёвую/лёгкую модель.
- **Не использовать** основную модель агента (Claude, GPT-4 и т.д.) для переводов - слишком дорого.

**Маппинг провайдеров OpenClaw → простая модель для переводов:**
- Плагин хранит таблицу: `provider_id` (из конфига OpenClaw) → `simple_model_id` (идентификатор дешёвой модели этого провайдера).
- Пример маппинга (актуализировать под список провайдеров OpenClaw/Clawbot):

| provider_id | simple_model_id (для переводов) |
|-------------|---------------------------------|
| openai      | gpt-4o-mini или gpt-3.5-turbo   |
| anthropic   | claude-3-haiku-20240307         |
| google      | gemini-1.5-flash                |
| groq        | llama-3.1-8b-instant            |
| together    | meta-llama/Llama-3.2-3B         |
| ollama      | llama3.2 (или самая быстрая)    |
| ...         | ...                             |

- **Дефолт:** если провайдер отсутствует в маппинге - использовать `translation.defaultModel` из конфига плагина (напр. `gpt-4o-mini` или `claude-3-haiku`). Либо первый доступный «простой» вариант из настроек OpenClaw.
- Маппинг: в коде как константа `TRANSLATION_MODEL_MAP`, при добавлении нового провайдера в OpenClaw - дополнять. Опционально: переопределение через конфиг плагина `translation.modelMap`.

**Технические детали:**
- Вызов: OpenClaw API с явным указанием `model: simpleModelId` (не дефолтная модель агента).
- Промпт-шаблон: "Translate to [locale]: {text}. Return only the translation, no extra text."
- Кэширование: `translation_cache` таблица или in-memory LRU.
- Если `locale=en` или исходный текст уже на целевом языке - перевод не вызываем.
- Throttling: не более N переводов в минуту (напр. 20).

**Итог:** Пользователь видит интерфейс плагина и весь контент (названия, описания, уведомления) на выбранном языке. Язык по умолчанию - язык канала.

---

## 6. Источники данных

Все источники - бесплатные API (регистрация для ключа, без оплаты). Управление через чат: включение/выключение, ввод API-ключей.

Каждый источник реализует интерфейс `IDataSource` (Strategy pattern). Новый источник = новый класс, без изменения существующего кода.

### 6.1 TVMaze (сериалы)

- **Поиск:** `GET https://api.tvmaze.com/search/shows?q=<query>`
- **Эпизоды:** `GET https://api.tvmaze.com/shows/<id>/episodes`
- API-ключ не требуется
- Ответ: id шоу, externals (imdb, thetvdb), эпизоды с season, number, name, airstamp (UTC), status
- **Рекомендации:** TVMaze не имеет endpoint для трендов - `watch_recommend` через этот источник недоступен

### 6.2 TMDB (фильмы и сериалы)

- Бесплатный API, регистрация на themoviedb.org
- Лимиты: ~40 запросов/10 сек
- Для фильмов и доп. метаданных сериалов
- `watch/providers` - доступность на площадках (по стране)
- `trending` и `discover` - рекомендации и тренды (основной источник для `watch_recommend`)
- **Если TMDB выключен:** `watch_recommend` возвращает ошибку "нет источника для рекомендаций, включите TMDB"

### 6.3 OMDb

- Бесплатный тариф: 1000 запросов/день
- Регистрация для API-ключа
- Поиск и метаданные; нет эндпоинтов для эпизодов и рекомендаций

### 6.4 Trakt

- Бесплатный API по запросу
- Регистрация для client_id/secret
- Trending, рекомендации, watchlist

### 6.5 Управление источниками (через чат)

- **source list** - список источников, статус (вкл/выкл)
- **source enable/disable \<id\>** - включить/выключить
- **source key \<id\> \<ключ\>** - задать API-ключ (рекомендуется только в личке)
- Инструменты агента: `source_list`, `source_enable`, `source_disable`, `source_set_key`

---

## 7. Связывание нескольких источников и дедупликация

**Проблема:** один и тот же контент в разных источниках имеет разные ID. Без связывания одно событие может породить несколько уведомлений.

### 7.1 Стратегия (MVP)

1. **По ID:** imdb, thetvdb - общие идентификаторы. Строим `canonical_key`:
   - Сериалы: `imdb:tt123:S02:E08` (или `thetvdb:456:S02:E08`, или `tvmaze:789:S02:E08`)
   - Фильмы: `imdb:tt456` (или `tmdb:movie:123`)
   - Приоритет: imdb → thetvdb → source-specific id
2. **Если canonical_key совпадает** - один эпизод, одно уведомление.
3. **Если ID нет или не совпадают** - нормализованное сравнение (MVP):
   - normalized title (lowercase, без спецсимволов) + year + season + episode
   - Если совпадение - запрос пользователю: «Похоже на X из TVMaze. Это одно и то же? (да/нет)»
4. **Подтверждение сохраняется** в `entity_links` - при следующих проверках вопрос не повторяется.

### 7.2 Нормализованное сравнение (MVP)

- Вход: title, year, director (если есть), season/episode
- Алгоритм: `normalize(title)` = lowercase → удалить пунктуацию → trim → transliterate (опционально)
- Совпадение: `normalized_title + year + season + episode` идентичны → кандидат на объединение
- Автоматическое объединение **не делаем** - всегда спрашиваем пользователя (два фильма с одинаковым названием в один год)
- Реализация: чистая функция, без внешних зависимостей

### 7.3 Фаза 2: семантическое сравнение

- Self-hosted эмбеддинги или LLM-промпт через OpenClaw
- Заменяет нормализованное сравнение при необходимости
- Не требуется для MVP

---

## 8. Каналы уведомлений

- Поддержка **всех** каналов OpenClaw: Telegram, Slack, Discord, WhatsApp и т.д.
- Использование API доставки Gateway OpenClaw (как при отправке агентом)
- Каждая цель: `{ channel: string, chatId | channelId | to: string }`
- Формат доставки настраивается по типу события (см. раздел 11)
- Управление targets - только через конфиг плагина (рестарт gateway). Через чат не меняется (targets - чувствительная настройка)

---

## 9. Инструменты агента (Agent Tools)

| Инструмент        | Описание                                      | Параметры                      |
|-------------------|-----------------------------------------------|--------------------------------|
| `watch_search`    | Поиск шоу/фильмов по названию                | `query: string`                |
| `watch_recommend` | Популярное / тренды / похожее                 | `?genre`, `?limit`             |
| `watch_add`       | Добавить в watchlist                          | `showId`/`movieId` или `query` |
| `watch_remove`    | Удалить из watchlist                          | `showId`/`movieId` или `title` |
| `watch_list`      | Список отслеживаемых                          | -                              |
| `watch_status`    | Эпизоды/релизы + статус                       | `showId`/`movieId` или `title` |
| `source_list`     | Список источников, вкл/выкл                  | -                              |
| `source_enable`   | Включить источник                             | `source_id`                    |
| `source_disable`  | Выключить источник                            | `source_id`                    |
| `source_set_key`  | Задать API-ключ (только в личке)              | `source_id`, `key`             |
| `platform_list`   | Список подписок (площадки)                    | -                              |
| `platform_add`    | Добавить площадку                             | `platform_id`                  |
| `platform_remove` | Удалить площадку                              | `platform_id`                  |
| `watch_set_locale`| Установить язык интерфейса                    | `locale: string`               |

Каждый инструмент - тонкая обёртка: валидация входа → вызов сервиса → форматирование ответа.

Схемы инструментов должны иметь чёткое `description` с примерами фраз-триггеров, чтобы агент понимал, когда их вызывать.

### 9.1 Понимание контекста и авто-вызов инструментов

Агент (LLM) получает список инструментов и их описания. При сообщении пользователя агент должен **сам определить намерение** и вызвать нужный инструмент, без требования точного синтаксиса команды.

**Примеры маппинга фраза → инструмент:**

| Фраза пользователя                                  | Инструмент      |
|------------------------------------------------------|-----------------|
| добавь Fallout, трекай Shogun, добавь в отслеживание | `watch_add`     |
| убери Fallout, удали из списка, больше не следи       | `watch_remove`  |
| что в отслеживании, мой список, что смотрю            | `watch_list`    |
| статус Fallout, какие эпизоды вышли, что нового       | `watch_status`  |
| дай что посмотреть, порекомендуй сериал               | `watch_recommend` |
| найди Fallout, поиск по названию                      | `watch_search`  |
| включи TMDB, добавь источник                          | `source_enable` |
| выключи OMDb                                          | `source_disable` |
| добавь Netflix в площадки, подписка на Disney+        | `platform_add`  |
| убери HBO из площадок                                 | `platform_remove` |
| язык украинский, переключи на русский, watch lang uk  | `watch_set_locale` |

**Требования:**
- `description` каждого инструмента - на русском и/или английском, с примерами фраз-триггеров
- Skill (SKILL.md) - явная инструкция: «Когда пользователь просит добавить/удалить/показать - вызывай соответствующий инструмент. Не требуй точного формата команд.»
- Контекст диалога: «добавь второй» после списка рекомендаций - агент связывает «второй» с позицией в предыдущем ответе

### 9.2 watch_recommend: источники и fallback

- **Основной источник:** TMDB (`trending`, `discover`)
- **Дополнительно:** Trakt (если включён)
- **Если ни один не включён:** возврат сообщения «Для рекомендаций нужен TMDB или Trakt. Включите: source enable tmdb»
- **Fallback:** если TMDB недоступен временно - Trakt; если и Trakt - ошибка

---

## 10. Команды автоответа (явные)

Обрабатываются плагином напрямую, без участия LLM. Быстрый shortcut для тех, кто знает синтаксис.

| Команда                 | Описание                               | Пример                    |
|-------------------------|----------------------------------------|---------------------------|
| `watch add <query>`     | Поиск и добавление шоу/фильма         | `watch add Fallout`       |
| `watch list`            | Список отслеживаемых                   | `watch list`              |
| `watch status <id>`     | Эпизоды/релизы и статус               | `watch status Fallout`    |
| `watch remove <id>`     | Удаление из watchlist                  | `watch remove Fallout`    |
| `watch quiet <range>`   | Установка тихих часов                  | `watch quiet 23:00-09:00` |
| `watch tz <tz>`         | Установка часового пояса               | `watch tz Europe/Kyiv`    |
| `watch lang <locale>`   | Установка языка (auto/en/uk/ru...)     | `watch lang uk`           |
| `watch check`           | Ручной запуск checker + deliverer      | `watch check`             |
| `source list`           | Список источников данных               | `source list`             |
| `source enable <id>`    | Включить источник                      | `source enable tmdb`      |
| `source disable <id>`   | Выключить источник                     | `source disable omdb`     |
| `source key <id> <key>` | Задать API-ключ (лучше в личке)        | `source key tmdb xxx`     |
| `platform list`         | Список подписок (площадки)             | `platform list`           |
| `platform add <id>`     | Добавить площадку                      | `platform add netflix`    |
| `platform remove <id>`  | Удалить площадку                       | `platform remove netflix` |

Все команды требуют авторизованного отправителя. Команду `source key` выполнять только в личке. Работают в группах и личке.

Каждая команда - тонкая обёртка: парсинг аргументов → вызов того же сервиса, что и tools → форматирование ответа.

---

## 11. Формат уведомлений

### 11.1 Новый эпизод

```
Fallout S02E03 - <название эпизода>
Вышел: <дата-время в локальной tz>
Источник: TVMaze
```

### 11.2 Перенос даты

```
Перенос: Fallout S02E03
было: <old airstamp>
стало: <new airstamp>
```

### 11.3 Появление на площадке (available_on_platform)

```
Dune: Part Two теперь на HBO Max
Доступен с: <date>
Источник: TMDB
```

### 11.4 Дайджест (несколько событий после тихих часов)

```
Обновления по сериалам и фильмам:

1. Fallout S02E03 - <title>
   Вышел: ...

2. Shogun S01E05 - перенос
   было: ... стало: ...

3. Dune: Part Two - появился на HBO Max
   Доступен с: ...
```

---

## 12. Логика

### 12.1 Checker (cron / по расписанию)

**Сериалы:**
1. `WatchlistRepo.getAll(content_type='series')`
2. Для каждого шоу: `DataSourceFactory.get(source).getEpisodes(external_id)` из всех включённых источников
3. Связывание по canonical_key или entity_links. При потенциальном совпадении без сохранённой связи - нормализованное сравнение + запрос пользователю (через чат)
4. Сравнить с кэшем (`EpisodeRepo`): новый canonical_key → `new_episode`; тот же, другой airstamp → `date_changed`
5. Записать в `episodes`, создать event (status=`pending`). Дедупликация: один canonical_key = одно событие

**Фильмы:**
1. `WatchlistRepo.getAll(content_type='movie')`
2. Для каждого фильма: проверить дату релиза (theatrical), доступность на площадках из `platforms` через `getWatchProviders()`
3. Новый релиз → `movie_released`, появление на площадке из списка → `available_on_platform`
4. Дедупликация по canonical_key / entity_links

**Общее:**
5. Для каждого нового event:
   - Вне тихих часов → status=`pending`, сразу передать в deliverer
   - Внутри тихих часов → status=`queued`

### 12.2 Deliverer (cron / по расписанию)

1. Если задан `deliverAt`: запуск в это время (напр. 09:05)
2. Иначе: запуск каждые 10 мин, когда не тихие часы
3. Забрать все events со status=`pending` или `queued` (если вне тихих часов)
4. Для каждого события:
   - Отправить во все targets через Gateway API (`DeliveryService`)
   - Записать в `delivery_log` (success/error)
   - Обновить event: status=`delivered` (или `failed`)
5. Несколько событий после тихих часов → объединить в дайджест (раздел 11.4)

### 12.3 Retry при ошибках доставки

- При status=`failed`: повторить при следующем запуске deliverer
- Максимум 3 попытки, затем status=`failed` окончательно + запись в events_log
- Ошибки API источников (checker): пропустить источник, продолжить с остальными, записать в events_log

### 12.4 Фоновый сервис

- Плагин регистрирует `api.registerService` с `start` / `stop`
- Планировщик использует cron OpenClaw или внутренний `setInterval` на основе `checkInterval` и `deliverAt`

---

## 13. Обработка ошибок

| Ситуация                            | Поведение                                              |
|--------------------------------------|-------------------------------------------------------|
| API источника недоступен             | Пропустить источник, продолжить с остальными, лог     |
| Доставка в канал не удалась          | status=`failed`, retry (макс. 3 попытки)              |
| Пользователь добавляет дубликат      | Проверка по `(source, external_id)` - отказ с сообщением «уже в watchlist» |
| Пользователь добавляет похожее       | Нормализованное сравнение → вопрос «это одно и то же?» |
| source disabled, но в watchlist есть записи | Записи остаются; checker пропускает выключенный источник |
| API-ключ не задан для источника      | source не используется, сообщение при попытке enable   |
| БД заблокирована / ошибка записи     | Retry с backoff (макс. 3), лог, не терять event       |
| Неизвестный platform_id              | Возврат списка доступных площадок                     |
| Локализация для locale отсутствует, LLM недоступен | Fallback на en                            |
| Ошибка перевода (LLM timeout/error)  | Вернуть оригинальный текст, записать в events_log     |

---

## 14. Skill (SKILL.md)

Плагин поставляет `skills/tv-watcher/SKILL.md` с:

- **Приоритет: понимание контекста.** Пользователь говорит естественным языком - агент сам определяет намерение и вызывает соответствующий инструмент. Не требовать точный синтаксис команд.
- Маппинг фраз на инструменты: «добавь» → watch_add, «убери» → watch_remove, «что в списке» → watch_list и т.д.
- Управление источниками и площадками: source_*, platform_*
- Контекст диалога: «добавь второй» после рекомендаций - второй элемент из предыдущего ответа
- Сценарий: предложить → пользователь выбирает («этот», «второй», «Shogun») → добавить по согласию
- Подтверждение совпадений: при вопросе «это одно и то же?» пользователь отвечает да/нет
- Язык: по умолчанию - язык интерфейса канала. Пользователь может сменить: «язык украинский», «watch lang uk». Все ответы и контент (названия, описания) отображаются на выбранном языке.

---

## 15. Сценарий диалога

1. Пользователь: «Дай что посмотреть» → агент вызывает `watch_recommend`, возвращает список
2. Пользователь: «Второй добавь» / «Shogun добавь» / «добавь тот что про самураев» → агент по контексту понимает выбор и вызывает `watch_add`
3. Пользователь: «Что у меня в отслеживании?» / «что смотрю» → агент вызывает `watch_list`
4. Пользователь: «Убери Fallout» / «больше не следи за этим» → агент вызывает `watch_remove`
5. Пользователь: «Добавь Netflix» (в контексте площадок) → агент вызывает `platform_add`
6. Пользователь: «Включи TMDB» → агент вызывает `source_enable`

**Ключевое:** агент не ждёт команду в формате `watch add X`. Он понимает любую естественную формулировку и сам вызывает нужный инструмент. Команды автоответа - быстрый shortcut для тех, кто их знает.

---

## 16. Структура файлов

```
@openclaw/tv-watcher/
├── package.json
├── openclaw.plugin.json
├── src/
│   ├── index.ts                    # точка входа плагина, register
│   ├── db.ts                       # SQLite: подключение, миграции
│   │
│   ├── interfaces/
│   │   ├── data-source.ts          # IDataSource
│   │   ├── repositories.ts         # IWatchlistRepo, IEpisodeRepo, IEventRepo, ...
│   │   └── services.ts             # IWatchService, ISourceService, IPlatformService
│   │
│   ├── data-sources/
│   │   ├── tvmaze.source.ts        # TVMazeSource implements IDataSource
│   │   ├── tmdb.source.ts          # TMDBSource implements IDataSource
│   │   ├── omdb.source.ts          # OMDbSource implements IDataSource
│   │   ├── trakt.source.ts         # TraktSource implements IDataSource
│   │   └── source.factory.ts       # DataSourceFactory
│   │
│   ├── repositories/
│   │   ├── watchlist.repo.ts
│   │   ├── episode.repo.ts
│   │   ├── movie-release.repo.ts
│   │   ├── event.repo.ts
│   │   ├── platform.repo.ts
│   │   ├── source.repo.ts
│   │   ├── entity-link.repo.ts
│   │   ├── settings.repo.ts
│   │   └── translation-cache.repo.ts
│   │
│   ├── services/
│   │   ├── watch.service.ts        # add, remove, list, status, search, recommend
│   │   ├── source.service.ts       # enable, disable, set key, list
│   │   ├── platform.service.ts     # add, remove, list
│   │   ├── checker.service.ts      # CheckerFacade: проверка всех watchlist
│   │   ├── delivery.service.ts     # отправка в каналы OpenClaw
│   │   ├── linking.service.ts      # canonical_key, нормализация, entity_links
│   │   ├── i18n.service.ts         # загрузка CSV, генерация LLM при отсутствии
│   │   └── translation.service.ts  # перевод API на лету: маппинг провайдер→простая модель, кэш
│   │
│   ├── tools.ts                    # agent tools: тонкие обёртки над services
│   └── commands.ts                 # auto-reply commands: тонкие обёртки над services
│
├── i18n/
│   ├── en.csv                       # базовая локализация (ключ, значение)
│   └── *.csv                        # сгенерированные LLM (uk, ru...)
├── skills/
│   └── tv-watcher/
│       └── SKILL.md
└── README.md
```

---

## 17. Зависимости

- `better-sqlite3` для SQLite (синхронный, быстрый, без native rebuild проблем в OpenClaw)
- Встроенный `fetch` для API (TVMaze, TMDB и т.д.)
- Внешняя среда не требуется, кроме Node.js (уже есть в OpenClaw)

---

## 18. Тестирование

### 18.1 Юнит-тесты

- **Repositories:** CRUD-операции, constraints, каскадное удаление
- **Services:** бизнес-логика (добавление дубликата, проверка disabled source, quiet hours)
- **Data sources:** парсинг ответов TVMaze/TMDB (мок fetch)
- **Linking:** нормализация title, canonical_key, нормализованное сравнение
- **Checker:** генерация правильных событий (new_episode, date_changed, available_on_platform)
- **Deliverer:** retry-логика, дайджест, status transitions

### 18.2 Интеграция

- Мок API-источников → полный цикл checker → deliverer
- Проверка дедупликации при нескольких источниках

### 18.3 Ручная проверка

1. Добавить Fallout, выполнить `watch check`
2. Убедиться: events созданы, уведомления отправлены в настроенный канал
3. Повторный `watch check` - дублей нет
4. Добавить площадку (netflix), проверить available_on_platform для фильма

---

## 19. Безопасность / ограничения

- Устанавливать только из доверенного источника
- Лимиты API: TVMaze допускает разумный объём запросов; при необходимости добавить throttling
- Конфиг: `targets` чувствителен - не логировать
- API-ключи (sources.api_key): не логировать, не показывать в чате (маскировать: `sk-xxx...yyy`). Команду `source key` выполнять только в личке
- Плагин работает in-process с gateway - без sandbox

---

## 20. Фаза 2 (будущее)

- Фильтры: жанр, год, "только новые сезоны"
- Настройки уведомлений по каждому шоу/фильму
- JustWatch для availability
- Семантическое сравнение (эмбеддинги / LLM) вместо нормализованного
- Управление targets через чат (добавление/удаление каналов уведомлений)
- Batch-перевод для снижения числа LLM-вызовов

---

## 21. Контрольный список

- [ ] Архитектура: интерфейсы (IDataSource, IWatchlistRepo, IWatchService и т.д.)
- [ ] SQLite: подключение, миграции с версиями
- [ ] Таблицы: settings, watchlist, episodes, movie_releases, platforms, sources, entity_links, events, delivery_log, events_log, translation_cache
- [ ] Манифест плагина (openclaw.plugin.json)
- [ ] Схема конфига (targets, timezone, locale, quietHours, checkInterval, deliverAt)
- [ ] Data sources: TVMazeSource, TMDBSource (OMDbSource, TraktSource - опционально)
- [ ] DataSourceFactory
- [ ] Repositories для каждой таблицы
- [ ] WatchService (add, remove, list, status, search, recommend)
- [ ] SourceService (enable, disable, set key, list)
- [ ] PlatformService (add, remove, list)
- [ ] LinkingService (canonical_key, нормализация, entity_links, запрос пользователю)
- [ ] CheckerFacade (series + movies + available_on_platform)
- [ ] DeliveryService + retry (макс. 3)
- [ ] I18nService (CSV, LLM-генерация при отсутствии locale)
- [ ] TranslationService (маппинг провайдер→простая модель, перевод на лету, кэш, throttling)
- [ ] Инструменты агента с описаниями-триггерами (watch_*, source_*, platform_*, watch_set_locale)
- [ ] Команды автоответа
- [ ] Обработка ошибок (API down, дубликаты, retry, fallback)
- [ ] Skill SKILL.md (понимание контекста, маппинг фраз → инструменты)
- [ ] Фоновый сервис (планировщик)
- [ ] Тесты: юнит + интеграция
- [ ] README + пример конфига
