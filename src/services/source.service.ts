/**
 * SourceService - enable, disable, set key, list.
 */

import type { ISourceService } from '../interfaces/services';
import type { ISourceRepo, SourceRecord } from '../interfaces/repositories';
import { DataSourceFactory } from '../data-sources/source.factory';

export function createSourceService(sourceRepo: ISourceRepo): ISourceService {
  const allIds = DataSourceFactory.getAllIds();
  return {
    list() {
      const rows = sourceRepo.getAll();
      const byId = new Map(rows.map((r: SourceRecord) => [r.sourceId, r]));
      return allIds.map((id) => ({
        sourceId: id,
        enabled: ((byId.get(id) as SourceRecord | undefined)?.enabled ?? (id === 'tvmaze' ? 1 : 0)) === 1,
      }));
    },
    enable(sourceId: string) {
      ensureSourceExists(sourceRepo, sourceId);
      sourceRepo.setEnabled(sourceId, true);
    },
    disable(sourceId: string) {
      ensureSourceExists(sourceRepo, sourceId);
      sourceRepo.setEnabled(sourceId, false);
    },
    setKey(sourceId: string, key: string) {
      ensureSourceExists(sourceRepo, sourceId);
      sourceRepo.setApiKey(sourceId, key);
    },
  };
}

function ensureSourceExists(
  repo: ISourceRepo & { ensureExists?(id: string): void },
  sourceId: string
): void {
  const ids = DataSourceFactory.getAllIds();
  if (!ids.includes(sourceId.toLowerCase())) throw new Error(`Unknown source: ${sourceId}`);
  if (repo.ensureExists) repo.ensureExists(sourceId);
}
