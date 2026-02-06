import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

type RedisClient = RedisClientType;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient> | null = null;

const buildRedisClient = () => {
  const url = process.env.REDIS_URL;
  if (url) {
    return createClient({ url });
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || 6379);
  const username = process.env.REDIS_USERNAME || undefined;
  const password = process.env.REDIS_PASSWORD || undefined;
  const database = Number(process.env.REDIS_DB || 0);
  const useTls = (process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true';

  return createClient({
    socket: {
      host,
      port,
      tls: useTls ? {} : undefined,
    },
    username,
    password,
    database,
  });
};

export const getRedisClient = async (): Promise<RedisClient> => {
  if (client) {
    return client;
  }
  if (!connectPromise) {
    const nextClient = buildRedisClient();
    nextClient.on('error', (error) => {
      logger.error(`Redis client error: ${error?.message || 'unknown error'}`);
    });
    connectPromise = nextClient
      .connect()
      .then(() => {
        logger.info('Redis client connected');
        client = nextClient;
        return nextClient;
      })
      .catch((error) => {
        connectPromise = null;
        logger.error(`Redis connection failed: ${error?.message || 'unknown error'}`);
        throw error;
      });
  }
  return connectPromise;
};
