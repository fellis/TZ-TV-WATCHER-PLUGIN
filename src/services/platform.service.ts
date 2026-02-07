/**
 * PlatformService - add, remove, list streaming platforms.
 */

import type { IPlatformService } from '../interfaces/services';
import type { IPlatformRepo, PlatformRecord } from '../interfaces/repositories';

const PLATFORM_NAMES: Record<string, string> = {
  netflix: 'Netflix',
  'disney-plus': 'Disney+',
  'hbo-max': 'HBO Max',
  prime: 'Prime Video',
  apple: 'Apple TV+',
};

export function createPlatformService(platformRepo: IPlatformRepo): IPlatformService {
  return {
    list() {
      return platformRepo.getAll().map((p: PlatformRecord) => ({
        id: p.id,
        externalId: p.externalId,
        name: p.name,
      }));
    },
    add(platformId: string, name?: string) {
      const n = name || PLATFORM_NAMES[platformId.toLowerCase()] || platformId;
      if (platformRepo.getByExternalId(platformId)) return;
      platformRepo.add(platformId, n);
    },
    remove(platformId: string) {
      platformRepo.remove(platformId);
    },
  };
}
