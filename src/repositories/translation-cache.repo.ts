/**
 * Translation cache - avoid repeated LLM calls.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'crypto';

export interface ITranslationCacheRepo {
  get(sourceText: string, targetLocale: string): string | null;
  set(sourceText: string, targetLocale: string, translatedText: string): void;
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function storageKey(text: string): string {
  return text.length > 200 ? hashText(text) : text;
}

export function createTranslationCacheRepo(db: Database.Database): ITranslationCacheRepo {
  return {
    get(sourceText: string, targetLocale: string): string | null {
      const key = storageKey(sourceText);
      const row = db
        .prepare('SELECT translated_text FROM translation_cache WHERE source_text = ? AND target_locale = ?')
        .get(key, targetLocale) as { translated_text: string } | undefined;
      return row?.translated_text ?? null;
    },
    set(sourceText: string, targetLocale: string, translatedText: string): void {
      const key = storageKey(sourceText);
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO translation_cache (source_text, target_locale, translated_text, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source_text, target_locale) DO UPDATE SET translated_text = excluded.translated_text`
      ).run(key, targetLocale, translatedText, now);
    },
  };
}
