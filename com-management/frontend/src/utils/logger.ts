export type FrontendLogLevel = 'info' | 'debug';

const LOG_LEVEL_RANK: Record<FrontendLogLevel, number> = {
  info: 1,
  debug: 2,
};

const normalizeLevel = (value: unknown): FrontendLogLevel => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'debug' ? 'debug' : 'info';
};

const envLogLevel =
  (import.meta as any)?.env?.VITE_FRONTEND_LOG_LEVEL || (import.meta as any)?.env?.VITE_LOG_LEVEL;
let configuredLevel: FrontendLogLevel = normalizeLevel(envLogLevel || 'info');

const shouldLog = (messageLevel: FrontendLogLevel) => {
  return LOG_LEVEL_RANK[messageLevel] <= LOG_LEVEL_RANK[configuredLevel];
};

export const setFrontendLogLevel = (level: FrontendLogLevel) => {
  configuredLevel = normalizeLevel(level);
};

export const getFrontendLogLevel = (): FrontendLogLevel => configuredLevel;

const stringifyArgs = (args: unknown[]) => {
  return args
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    })
    .join(' ')
    .slice(0, 4000);
};

const emitToBackendFile = (level: FrontendLogLevel, args: unknown[]) => {
  if (typeof fetch !== 'function') {
    return;
  }
  const message = stringifyArgs(args);
  if (!message) {
    return;
  }
  const payload = {
    level,
    message,
    context: typeof window !== 'undefined' ? window.location?.pathname || '' : '',
  };
  void fetch('/api/v1/logs/frontend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {
    // Intentionally suppress logger transport errors.
  });
};

const frontendLogger = {
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      emitToBackendFile('info', args);
    }
  },
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      emitToBackendFile('debug', args);
    }
  },
};

export default frontendLogger;
