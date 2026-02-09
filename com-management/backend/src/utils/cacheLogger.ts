import pino from 'pino';

const cacheLogPath = process.env.CACHE_LOG_PATH || '/root/navigator/com-management/backend/cache.log';
const cacheLogLevel = process.env.CACHE_LOG_LEVEL || process.env.LOG_LEVEL || 'info';

const cacheLogger = pino(
  {
    level: cacheLogLevel,
  },
  pino.destination({ dest: cacheLogPath, sync: false }),
);

export default cacheLogger;
