import logger from '../utils/logger';
import { incCounter, setGauge } from '../utils/metricsStore';
import { getBootstrapClient } from './bootstrapClient';
import { getCachedMicroserviceStatus, refreshMicroserviceStatusNow } from './microserviceStatusCache';

export type ConnectivityStatusSummary = {
  success: boolean;
  uaRest: {
    ok: boolean;
    error: string | null;
  };
  microservices: {
    ok: boolean;
    error: string | null;
  };
  updatedAt: string;
};

export type ConnectivityStatusCacheSnapshot = {
  data: ConnectivityStatusSummary | null;
  error: string | null;
  updatedAt: string | null;
  lastAttemptAt: string | null;
  serverId: string | null;
};

const DEFAULT_POLL_MS = 60000;

let cache: ConnectivityStatusCacheSnapshot = {
  data: null,
  error: null,
  updatedAt: null,
  lastAttemptAt: null,
  serverId: null,
};

const getPollIntervalMs = () => {
  const raw = Number(process.env.CONNECTIVITY_STATUS_POLL_MS || DEFAULT_POLL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_POLL_MS;
  }
  return raw;
};

export const getConnectivityStatusPollMs = () => getPollIntervalMs();

export const getCachedConnectivityStatus = (): ConnectivityStatusCacheSnapshot => ({
  ...cache,
  data: cache.data ? { ...cache.data } : null,
});

const setCache = (data: ConnectivityStatusSummary, serverId: string | null) => {
  cache = {
    data,
    error: null,
    updatedAt: data.updatedAt,
    lastAttemptAt: data.updatedAt,
    serverId,
  };
};

const setCacheError = (message: string, serverId: string | null) => {
  cache = {
    data: cache.data,
    error: message,
    updatedAt: cache.updatedAt,
    lastAttemptAt: new Date().toISOString(),
    serverId,
  };
};

const checkMicroserviceHealth = () => {
  const microserviceCache = getCachedMicroserviceStatus();
  if (!microserviceCache.data) {
    return { ok: false, error: 'Microservice status not available' };
  }
  const required = Array.isArray(microserviceCache.data.required)
    ? microserviceCache.data.required
    : [];
  const missingCount = Array.isArray(microserviceCache.data.missing)
    ? microserviceCache.data.missing.length
    : 0;
  const hasDown = required.some((entry: any) => {
    if (entry?.runningState) {
      return entry.runningState === 'down';
    }
    return Boolean(entry?.installed) && entry?.running === false;
  });
  const hasUnknown =
    microserviceCache.data.chainUnknown === true ||
    required.some((entry: any) => entry?.runningState === 'unknown');
  const ok = missingCount === 0 && !hasDown && (microserviceCache.data.chainReady || hasUnknown);
  return { ok, error: ok ? null : 'Microservice chain not ready' };
};

const checkUaRest = async () => {
  const bootstrap = getBootstrapClient();
  if (!bootstrap) {
    return { ok: false, error: 'Bootstrap credentials not configured', serverId: null };
  }
  try {
    await bootstrap.uaClient.listRules('/', 1);
    return { ok: true, error: null, serverId: bootstrap.serverId };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'UA REST check failed', serverId: bootstrap.serverId };
  }
};

export const refreshConnectivityStatusNow = async () => {
  const uaResult = await checkUaRest();
  const microserviceCache = getCachedMicroserviceStatus();
  const pollMs = getPollIntervalMs();
  const updatedAtMs = microserviceCache.updatedAt ? Date.parse(microserviceCache.updatedAt) : 0;
  const ageMs = updatedAtMs ? Date.now() - updatedAtMs : Number.MAX_SAFE_INTEGER;
  const sessionFresh =
    microserviceCache.data && microserviceCache.source === 'session' && ageMs < pollMs;

  if (!sessionFresh) {
    await refreshMicroserviceStatusNow();
  }
  const microserviceResult = checkMicroserviceHealth();

  const data: ConnectivityStatusSummary = {
    success: uaResult.ok && microserviceResult.ok,
    uaRest: { ok: uaResult.ok, error: uaResult.error },
    microservices: { ok: microserviceResult.ok, error: microserviceResult.error },
    updatedAt: new Date().toISOString(),
  };

  if (data.success) {
    incCounter('com_connectivity_poll_success_total');
    setGauge('com_connectivity_poll_last_success_timestamp', Date.now());
  } else {
    incCounter('com_connectivity_poll_error_total');
    setGauge('com_connectivity_poll_last_error_timestamp', Date.now());
  }

  setGauge('com_connectivity_status_ok', data.success ? 1 : 0);
  setGauge('com_connectivity_status_ua_rest_ok', uaResult.ok ? 1 : 0);
  setGauge('com_connectivity_status_microservices_ok', microserviceResult.ok ? 1 : 0);

  setCache(data, uaResult.serverId);

  if (!data.success) {
    setCacheError('Connectivity check failed', uaResult.serverId);
    logger.warn(`Connectivity check failed: uaRest=${uaResult.ok} microservices=${microserviceResult.ok}`);
  }
};

export const startConnectivityStatusPolling = () => {
  const pollMs = getPollIntervalMs();
  const bootstrap = getBootstrapClient();
  if (!bootstrap) {
    logger.warn('Connectivity status polling disabled: bootstrap credentials missing.');
    return;
  }

  const run = async () => {
    try {
      await refreshConnectivityStatusNow();
    } catch (error: any) {
      incCounter('com_connectivity_poll_error_total');
      setGauge('com_connectivity_poll_last_error_timestamp', Date.now());
      logger.warn(`Connectivity status polling failed: ${error?.message || 'unknown error'}`);
      setCacheError(error?.message || 'Connectivity status polling failed', bootstrap.serverId);
    }
  };

  run();
  setInterval(run, pollMs).unref();
};
