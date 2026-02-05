import logger from '../utils/logger';
import UAClient from './ua';
import { overviewIndex } from './overviewIndex';
import { rebuildAllFolderOverviewCaches } from '../routes/folders';
import { getBootstrapClient } from './bootstrapClient';

const DEFAULT_CACHE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CACHE_REFRESH_INTERVAL_MS = Number(
  process.env.CACHE_REFRESH_INTERVAL_MS || DEFAULT_CACHE_REFRESH_INTERVAL_MS,
);

let warmupTimer: NodeJS.Timeout | null = null;
let warmupActive = false;

const buildBootstrapClient = () => {
  const client = getBootstrapClient();
  if (!client) {
    logger.warn('Cache warmup skipped: bootstrap client unavailable.');
    return null;
  }
  return client;
};

const runWarmupCycle = async (
  uaClient: UAClient,
  serverId: string,
  trigger: 'startup' | 'schedule' | 'manual',
) => {
  try {
    await overviewIndex().rebuildIndex(serverId, uaClient, trigger);
  } catch (error: any) {
    logger.warn(`Overview warmup failed: ${error?.message || 'unknown error'}`);
  }
  try {
    await rebuildAllFolderOverviewCaches(uaClient, serverId, 25);
  } catch (error: any) {
    logger.warn(`Folder warmup failed: ${error?.message || 'unknown error'}`);
  }
};

const scheduleWarmup = (
  uaClient: UAClient,
  serverId: string,
  trigger: 'startup' | 'manual',
) => {
  if (warmupTimer) {
    clearInterval(warmupTimer);
  }
  warmupActive = true;
  void runWarmupCycle(uaClient, serverId, trigger);
  warmupTimer = setInterval(() => {
    void runWarmupCycle(uaClient, serverId, 'schedule');
  }, CACHE_REFRESH_INTERVAL_MS);
};

export const startCacheWarmupFromEnv = () => {
  const bootstrap = buildBootstrapClient();
  if (!bootstrap) {
    return;
  }
  scheduleWarmup(bootstrap.uaClient, bootstrap.serverId, 'startup');
};

export const ensureCacheWarmupFromSession = (uaClient: UAClient, serverId: string) => {
  if (warmupActive) {
    return;
  }
  scheduleWarmup(uaClient, serverId, 'manual');
};
