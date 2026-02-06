import logger from '../utils/logger';
import { getRedisClient } from './redisClient';

export type FavoriteType = 'file' | 'folder';

export interface FavoriteItem {
  type: FavoriteType;
  label: string;
  pathId: string;
  node?: string;
}

const FAVORITES_PREFIX = 'fcom:favorites:';

const buildFavoritesKey = (user: string, serverId: string) =>
  `${FAVORITES_PREFIX}${serverId}:${user}`;

const buildFavoriteHashKey = (favorite: FavoriteItem) => `${favorite.type}:${favorite.pathId}`;

const parseFavoriteEntry = (raw: string): FavoriteItem | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.type || !parsed?.pathId) {
      return null;
    }
    return parsed as FavoriteItem;
  } catch {
    return null;
  }
};

export const getFavorites = async (user: string, serverId: string): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    const rawEntries = await client.hGetAll(buildFavoritesKey(user, serverId));
    return Object.values(rawEntries)
      .map((entry) => parseFavoriteEntry(entry))
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
): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    const key = buildFavoritesKey(user, serverId);
    const hashKey = buildFavoriteHashKey(favorite);
    await client.hSet(key, hashKey, JSON.stringify(favorite));
    return await getFavorites(user, serverId);
  } catch (error: any) {
    logger.error(`Failed to write favorites store: ${error?.message || 'unknown error'}`);
    return [];
  }
};

export const removeFavorite = async (
  user: string,
  serverId: string,
  favorite: FavoriteItem,
): Promise<FavoriteItem[]> => {
  try {
    const client = await getRedisClient();
    const key = buildFavoritesKey(user, serverId);
    const hashKey = buildFavoriteHashKey(favorite);
    await client.hDel(key, hashKey);
    return await getFavorites(user, serverId);
  } catch (error: any) {
    logger.error(`Failed to write favorites store: ${error?.message || 'unknown error'}`);
    return [];
  }
};
