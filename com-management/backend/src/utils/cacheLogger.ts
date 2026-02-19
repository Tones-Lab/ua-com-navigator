import pino from 'pino';

const cacheLogPath = process.env.CACHE_LOG_PATH || '/root/navigator/com-management/backend/cache.log';

const normalizeBackendLogLevel = (value: unknown): 'info' | 'debug' => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'debug' ? 'debug' : 'info';
};

const cacheLogLevel = normalizeBackendLogLevel(
  process.env.BACKEND_CACHE_LOG_LEVEL ||
    process.env.CACHE_LOG_LEVEL ||
    process.env.BACKEND_LOG_LEVEL ||
    process.env.LOG_LEVEL ||
    'info',
);

const cacheLogger = pino(
  {
    level: cacheLogLevel,
  },
  pino.destination({ dest: cacheLogPath, sync: false }),
);

export default cacheLogger;
