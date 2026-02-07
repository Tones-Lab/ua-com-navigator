import logger from '../utils/logger';
import UAClient from './ua';
import { requestOverviewRebuild } from './overviewIndex';
import { rebuildAllFolderOverviewCaches } from '../routes/folders';
import { getBootstrapClient } from './bootstrapClient';
import { getRedisClient } from './redisClient';
import { requestSearchIndexRebuild } from './searchIndex';

const OVERVIEW_CACHE_PREFIX = 'fcom:overview:index:';
const SEARCH_CACHE_PREFIX = 'fcom:search:index:';
const FOLDER_CACHE_META_PREFIX = 'fcom:folder:overview:meta:';

const warmedServers = new Set<string>();

const buildBootstrapClient = () => {
  const client = getBootstrapClient();
  if (!client) {
    logger.warn('Cache warmup skipped: bootstrap client unavailable.');
    return null;
  }
  return client;
};

const warmupIfMissing = async (
  uaClient: UAClient,
  serverId: string,
  trigger: 'startup' | 'auto',
) => {
  try {
    const client = await getRedisClient();
    const [overviewKey, searchKey, folderMetaKey] = [
      `${OVERVIEW_CACHE_PREFIX}${serverId}`,
      `${SEARCH_CACHE_PREFIX}${serverId}`,
      `${FOLDER_CACHE_META_PREFIX}${serverId}`,
    ];

    const [overviewRaw, searchRaw, folderMetaRaw] = await Promise.all([
      client.get(overviewKey),
      client.get(searchKey),
      client.get(folderMetaKey),
    ]);

    const now = Date.now();
    const safeParse = (raw: string | null) => {
      if (!raw) {
        return null as any;
      }
      try {
        return JSON.parse(raw);
      } catch {
        return null as any;
      }
    };

    const overviewExpiresAtMs = safeParse(overviewRaw)?.expiresAtMs ?? null;
    const searchExpiresAtMs = safeParse(searchRaw)?.expiresAtMs ?? null;
    const folderExpiresAtMs = safeParse(folderMetaRaw)?.expiresAtMs ?? null;

    const overviewMissing = !overviewRaw;
    const searchMissing = !searchRaw;
    const folderMissing = !folderMetaRaw;

    const overviewStale = overviewMissing
      ? false
      : typeof overviewExpiresAtMs === 'number'
        ? now > overviewExpiresAtMs
        : true;
    const searchStale = searchMissing
      ? false
      : typeof searchExpiresAtMs === 'number'
        ? now > searchExpiresAtMs
        : true;
    const folderStale = folderMissing
      ? false
      : typeof folderExpiresAtMs === 'number'
        ? now > folderExpiresAtMs
        : true;

    const describeState = (missing: boolean, stale: boolean) => {
      if (missing) {
        return 'missing';
      }
      if (stale) {
        return 'stale';
      }
      return 'fresh';
    };

    logger.info(
      `Cache warmup check (${trigger}) server=${serverId} ` +
        `overview=${describeState(overviewMissing, overviewStale)} ` +
        `search=${describeState(searchMissing, searchStale)} ` +
        `folder=${describeState(folderMissing, folderStale)}`,
    );

    if (overviewMissing || overviewStale) {
      if (overviewStale && !overviewMissing) {
        logger.info(`Cache warmup: overview cache stale; scheduling refresh server=${serverId}`);
      }
      logger.info(`Cache warmup: rebuilding overview cache (${overviewMissing ? 'empty' : 'stale'}) server=${serverId}`);
      requestOverviewRebuild(serverId, uaClient, 'startup');
    }
    if (searchMissing || searchStale) {
      if (searchStale && !searchMissing) {
        logger.info(`Cache warmup: search cache stale; scheduling refresh server=${serverId}`);
      }
      logger.info(`Cache warmup: rebuilding search index (${searchMissing ? 'empty' : 'stale'}) server=${serverId}`);
      requestSearchIndexRebuild(serverId, uaClient, 'startup');
    }
    if (folderMissing || folderStale) {
      if (folderStale && !folderMissing) {
        logger.info(`Cache warmup: folder cache stale; scheduling refresh server=${serverId}`);
      }
      logger.info(`Cache warmup: rebuilding folder cache (${folderMissing ? 'empty' : 'stale'}) server=${serverId}`);
      await rebuildAllFolderOverviewCaches(uaClient, serverId, 25, 'startup');
    }
  } catch (error: any) {
    logger.warn(`Cache warmup failed: ${error?.message || 'unknown error'}`);
  }
};

export const startCacheWarmupFromEnv = () => {
  const bootstrap = buildBootstrapClient();
  if (!bootstrap) {
    return;
  }
  void warmupIfMissing(bootstrap.uaClient, bootstrap.serverId, 'startup');
};

export const ensureCacheWarmupFromSession = (uaClient: UAClient, serverId: string) => {
  if (warmedServers.has(serverId)) {
    return;
  }
  warmedServers.add(serverId);
  void warmupIfMissing(uaClient, serverId, 'auto');
};
