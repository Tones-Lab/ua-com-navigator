import logger from '../utils/logger';
import { getRedisClient } from './redisClient';

export type FavoriteType = 'file' | 'folder';
export type FavoriteScope = 'fcom' | 'pcom' | 'mib';

export interface FavoriteItem {
  type: FavoriteType;
  label: string;
  pathId: string;
  node?: string;
  scope?: FavoriteScope;
}

const FAVORITES_PREFIX = 'favorites:';
const LEGACY_FAVORITES_PREFIX = 'fcom:favorites:';

const buildFavoritesKey = (user: string, serverId: string, scope: FavoriteScope) =>
  `${FAVORITES_PREFIX}${scope}:${serverId}:${user}`;

const buildLegacyFavoritesKey = (user: string, serverId: string) =>
  `${LEGACY_FAVORITES_PREFIX}${serverId}:${user}`;

const buildFavoriteHashKey = (favorite: FavoriteItem) => `${favorite.type}:${favorite.pathId}`;

const parseFavoriteEntry = (raw: string, scope: FavoriteScope): FavoriteItem | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.type || !parsed?.pathId) {
      return null;
    }
    return {
      ...(parsed as FavoriteItem),
      scope: parsed.scope || scope,
    };
  } catch {
    return null;
  }
};

const migrateLegacyFavorites = async (
  client: Awaited<ReturnType<typeof getRedisClient>>,
  user: string,
  serverId: string,
  scope: FavoriteScope,
) => {
  if (scope !== 'fcom') {
    return;
  }
  const legacyKey = buildLegacyFavoritesKey(user, serverId);
  const legacyEntries = await client.hGetAll(legacyKey);
  if (!legacyEntries || Object.keys(legacyEntries).length === 0) {
    return;
  }
  const key = buildFavoritesKey(user, serverId, scope);
  const existing = await client.hLen(key);
  if (existing > 0) {
    return;
  }
  const payloads = Object.values(legacyEntries)
    .map((entry) => parseFavoriteEntry(entry, scope))
    .filter((entry): entry is FavoriteItem => Boolean(entry))
    .map((entry) => ({
      ...entry,
      scope,
    }));
  if (payloads.length === 0) {
    return;
  }
  const toWrite: Record<string, string> = {};
  payloads.forEach((entry) => {
    toWrite[buildFavoriteHashKey(entry)] = JSON.stringify(entry);
  });
  await client.hSet(key, toWrite);
};

export const getFavorites = async (
  user: string,
  serverId: string,
  scope: FavoriteScope,
): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    await migrateLegacyFavorites(client, user, serverId, scope);
    const rawEntries = await client.hGetAll(buildFavoritesKey(user, serverId, scope));
    return Object.values(rawEntries)
      .map((entry) => parseFavoriteEntry(entry, scope))
      .filter((entry): entry is FavoriteItem => Boolean(entry));
  } catch (error: any) {
    logger.error(`Failed to read favorites store: ${error?.message || 'unknown error'}`);
    return [];
  }
};

export const addFavorite = async (
  user: string,
  serverId: string,
  favorite: FavoriteItem,
  scope: FavoriteScope,
): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    const key = buildFavoritesKey(user, serverId, scope);
    const normalized: FavoriteItem = {
      ...favorite,
      scope,
    };
    const hashKey = buildFavoriteHashKey(normalized);
    await client.hSet(key, hashKey, JSON.stringify(normalized));
    return await getFavorites(user, serverId, scope);
  } catch (error: any) {
    logger.error(`Failed to write favorites store: ${error?.message || 'unknown error'}`);
    return [];
  }
};

export const removeFavorite = async (
  user: string,
  serverId: string,
  favorite: FavoriteItem,
  scope: FavoriteScope,
): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    const key = buildFavoritesKey(user, serverId, scope);
    const normalized: FavoriteItem = {
      ...favorite,
      scope,
    };
    const hashKey = buildFavoriteHashKey(normalized);
    await client.hDel(key, hashKey);
    return await getFavorites(user, serverId, scope);
  } catch (error: any) {
    logger.error(`Failed to write favorites store: ${error?.message || 'unknown error'}`);
    return [];
  }
};
