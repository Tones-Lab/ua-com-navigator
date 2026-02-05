import logger from '../utils/logger';
import UAClient from './ua';
import { overviewIndex } from './overviewIndex';
import { rebuildAllFolderOverviewCaches } from '../routes/folders';
import { getServerById, listServers } from './serverRegistry';

const DEFAULT_CACHE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CACHE_REFRESH_INTERVAL_MS = Number(
  process.env.CACHE_REFRESH_INTERVAL_MS || DEFAULT_CACHE_REFRESH_INTERVAL_MS,
);

let warmupTimer: NodeJS.Timeout | null = null;
let warmupActive = false;

const buildBootstrapClient = () => {
  const serverId = process.env.UA_BOOTSTRAP_SERVER_ID || listServers()[0]?.server_id;
  const server = serverId ? getServerById(serverId) : listServers()[0];
  if (!server) {
    logger.warn('Cache warmup skipped: no UA server configured.');
    return null;
  }

  const authMethod = process.env.UA_BOOTSTRAP_AUTH_METHOD || 'basic';
  const username = process.env.UA_BOOTSTRAP_USERNAME;
  const password = process.env.UA_BOOTSTRAP_PASSWORD;
  const certPath = process.env.UA_BOOTSTRAP_CERT_PATH;
  const keyPath = process.env.UA_BOOTSTRAP_KEY_PATH;
  const caCertPath = process.env.UA_BOOTSTRAP_CA_CERT_PATH;
  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';

  if (authMethod === 'certificate') {
    if (!certPath || !keyPath) {
      logger.warn('Cache warmup skipped: missing certificate credentials.');
      return null;
    }
  } else if (!username || !password) {
    logger.warn('Cache warmup skipped: missing username/password credentials.');
    return null;
  }

  const uaClient = new UAClient({
    hostname: server.hostname,
    port: server.port,
    auth_method: authMethod as 'basic' | 'certificate',
    username,
    password,
    cert_path: certPath,
    key_path: keyPath,
    ca_cert_path: caCertPath,
    insecure_tls: insecureTls,
  });

  return { uaClient, serverId: server.server_id };
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
