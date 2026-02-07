/**
 * I18nService - load CSV locales, fallback to en.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface I18nDeps {
  i18nDir: string;
}

function parseCsv(content: string): Record<string, string> {
  const lines = content.trim().split('\n');
  const result: Record<string, string> = {};
  const header = lines[0]?.toLowerCase();
  const keyIdx = header?.includes('key') ? header.split(',').indexOf('key') : 0;
  const valIdx = header?.includes('value') ? header.split(',').indexOf('value') : 1;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    if (row[keyIdx]) result[row[keyIdx]] = row[valIdx] ?? '';
  }
  return result;
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n') {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function createI18nService(deps: I18nDeps) {
  const { i18nDir } = deps;

  function loadLocale(locale: string): Record<string, string> | null {
    const path = join(i18nDir, `${locale}.csv`);
    if (!existsSync(path)) return null;
    try {
      const content = readFileSync(path, 'utf-8');
      return parseCsv(content);
    } catch {
      return null;
    }
  }

  function getLocale(locale: string): Record<string, string> {
    if (locale === 'auto') locale = 'en';
    const data = loadLocale(locale);
    if (data) return data;
    if (locale === 'en') return {};
    return loadLocale('en') ?? {};
  }

  function t(keys: Record<string, string>, key: string, params?: Record<string, string>): string {
    let s = keys[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return s;
  }

  return { loadLocale, getLocale, t };
}
