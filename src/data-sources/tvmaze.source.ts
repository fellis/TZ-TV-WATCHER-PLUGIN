/**
 * TVMaze data source - series only, no API key.
 */

import type { IDataSource, SearchResult, EpisodeData } from '../interfaces/data-source';

const BASE = 'https://api.tvmaze.com';

export class TVMazeSource implements IDataSource {
  id = 'tvmaze';
  requiresKey = false;

  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch(`${BASE}/search/shows?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`TVMaze search failed: ${res.status}`);
    const data = (await res.json()) as Array<{ show: TVMazeShow }>;
    return data.map(({ show }) => mapShow(show));
  }

  async getEpisodes(externalId: string): Promise<EpisodeData[]> {
    const res = await fetch(`${BASE}/shows/${externalId}/episodes`);
    if (!res.ok) throw new Error(`TVMaze episodes failed: ${res.status}`);
    const data = (await res.json()) as TVMazeEpisode[];
    return data.map(mapEpisode);
  }
}

interface TVMazeShow {
  id: number;
  name: string;
  premiered?: string;
  externals?: { imdb?: string; thetvdb?: number };
  url?: string;
  image?: { medium?: string };
}

interface TVMazeEpisode {
  id: number;
  season: number;
  number: number;
  name: string;
  airstamp: string | null;
  status: string;
}

function mapShow(show: TVMazeShow): SearchResult {
  const year = show.premiered ? parseInt(show.premiered.slice(0, 4), 10) : undefined;
  return {
    source: 'tvmaze',
    externalId: String(show.id),
    contentType: 'series',
    title: show.name,
    year,
    meta: { url: show.url, image: show.image?.medium },
    externalIds: {
      imdb: show.externals?.imdb,
      thetvdb: show.externals?.thetvdb ? String(show.externals.thetvdb) : undefined,
    },
  };
}

function mapEpisode(ep: TVMazeEpisode): EpisodeData {
  const status = (ep.status?.toLowerCase() || 'unknown') as EpisodeData['status'];
  const validStatus: EpisodeData['status'] =
    status === 'scheduled' || status === 'aired' ? status : 'unknown';
  return {
    externalId: String(ep.id),
    season: ep.season,
    episode: ep.number,
    title: ep.name || '',
    airstamp: ep.airstamp || '',
    status: validStatus,
  };
}
