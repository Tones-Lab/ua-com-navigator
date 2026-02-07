import logger from '../utils/logger';
import { getBootstrapClient } from './bootstrapClient';
import { getMicroserviceStatus, MicroserviceStatusSummary } from './microserviceStatus';
import {
  recordMicroserviceStatusError,
  recordMicroserviceStatusSuccess,
} from '../utils/microserviceMetrics';

export type MicroserviceStatusCacheSnapshot = {
  data: MicroserviceStatusSummary | null;
  error: string | null;
  updatedAt: string | null;
  lastAttemptAt: string | null;
  source: 'bootstrap' | 'session' | null;
  serverId: string | null;
};

const DEFAULT_POLL_MS = 60000;

let cache: MicroserviceStatusCacheSnapshot = {
  data: null,
  error: null,
  updatedAt: null,
  lastAttemptAt: null,
  source: null,
  serverId: null,
};

const getPollIntervalMs = () => {
  const raw = Number(process.env.MICROSERVICE_STATUS_POLL_MS || DEFAULT_POLL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_POLL_MS;
  }
  return raw;
};

export const getMicroserviceStatusPollMs = () => getPollIntervalMs();

export const getCachedMicroserviceStatus = (): MicroserviceStatusCacheSnapshot => ({
  ...cache,
  data: cache.data ? { ...cache.data } : null,
});

export const setCachedMicroserviceStatus = (
  data: MicroserviceStatusSummary,
  source: 'bootstrap' | 'session',
  serverId: string | null,
) => {
  recordMicroserviceStatusSuccess(data);
  cache = {
    data,
    error: null,
    updatedAt: data.updatedAt || new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    source,
    serverId,
  };
};

const setCacheError = (message: string, source: 'bootstrap' | 'session', serverId: string | null) => {
  recordMicroserviceStatusError();
  cache = {
    data: cache.data,
    error: message,
    updatedAt: cache.updatedAt,
    lastAttemptAt: new Date().toISOString(),
    source,
    serverId,
  };
};

export const refreshMicroserviceStatusNow = async (): Promise<void> => {
  const bootstrap = getBootstrapClient();
  if (!bootstrap) {
    setCacheError('Bootstrap credentials not configured', 'bootstrap', null);
    return;
  }
  try {
    const data = await getMicroserviceStatus(bootstrap.uaClient);
    setCachedMicroserviceStatus(data, 'bootstrap', bootstrap.serverId);
  } catch (error: any) {
    logger.warn(`Microservice status refresh failed: ${error?.message || 'unknown error'}`);
    setCacheError(error?.message || 'Microservice status refresh failed', 'bootstrap', bootstrap.serverId);
  }
};

export const startMicroserviceStatusPolling = () => {
  const pollMs = getPollIntervalMs();
  const bootstrap = getBootstrapClient();
  if (!bootstrap) {
    logger.warn('Microservice status polling disabled: bootstrap credentials missing.');
    return;
  }

  const run = async () => {
    try {
      const data = await getMicroserviceStatus(bootstrap.uaClient);
      setCachedMicroserviceStatus(data, 'bootstrap', bootstrap.serverId);
    } catch (error: any) {
      logger.warn(`Microservice status polling failed: ${error?.message || 'unknown error'}`);
      setCacheError(error?.message || 'Microservice status polling failed', 'bootstrap', bootstrap.serverId);
    }
  };

  run();
  setInterval(run, pollMs).unref();
};
