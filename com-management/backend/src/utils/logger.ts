import pino from 'pino';

const normalizeBackendLogLevel = (value: unknown): 'info' | 'debug' => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'debug' ? 'debug' : 'info';
};

const backendLogLevel = normalizeBackendLogLevel(
  process.env.BACKEND_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
);

const logger = pino({
  level: backendLogLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export default logger;
