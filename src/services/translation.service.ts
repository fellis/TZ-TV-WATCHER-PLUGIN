/**
 * TranslationService - cache translations stored by the agent.
 * Agent translates content via its own LLM context and stores results here.
 * Service provides cache lookup and storage.
 */

import type { ITranslationCacheRepo } from '../repositories/translation-cache.repo';

export interface TranslationDeps {
  cache: ITranslationCacheRepo;
}

export function createTranslationService(deps: TranslationDeps) {
  const { cache } = deps;

  /** Get cached translation or null. */
  function getCached(text: string, targetLocale: string): string | null {
    if (!text?.trim()) return text;
    if (targetLocale === 'en' || targetLocale === 'auto') return text;
    return cache.get(text, targetLocale);
  }

  /** Store a translation in cache. */
  function store(text: string, targetLocale: string, translation: string): void {
    cache.set(text, targetLocale, translation);
  }

  return { getCached, store };
}
