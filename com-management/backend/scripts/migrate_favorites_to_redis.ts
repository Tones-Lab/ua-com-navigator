/**
 * Purpose: Migrate legacy favorites.json into Redis.
 * Usage:
 *   tsx scripts/migrate_favorites_to_redis.ts
 * Notes:
 * - Reads FAVORITES_JSON_PATH or defaults to ./data/favorites.json.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getRedisClient } from '../src/services/redisClient';

dotenv.config();

type FavoriteItem = {
  type: 'file' | 'folder';
  label: string;
  pathId: string;
  node?: string;
  scope?: 'fcom' | 'pcom' | 'mib';
};

type FavoritesState = Record<string, Record<string, FavoriteItem[]>>;

const FAVORITES_PREFIX = 'favorites:';

const buildFavoritesKey = (user: string, serverId: string, scope: 'fcom' | 'pcom' | 'mib') =>
  `${FAVORITES_PREFIX}${scope}:${serverId}:${user}`;

const buildFavoriteHashKey = (favorite: FavoriteItem) => `${favorite.type}:${favorite.pathId}`;

const resolveFavoritesPath = () => {
  const overridePath = process.env.FAVORITES_JSON_PATH;
  if (overridePath) {
    return overridePath;
  }
  return path.resolve(process.cwd(), 'data', 'favorites.json');
};

const readFavorites = (filePath: string): FavoritesState | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw);
};

const migrate = async () => {
  const filePath = resolveFavoritesPath();
  const state = readFavorites(filePath);
  if (state === null) {
    console.log(`No legacy favorites file found at ${filePath}`);
    return;
  }

  const client = await getRedisClient();
  let migrated = 0;

  try {
    for (const [user, servers] of Object.entries(state)) {
      if (!servers || typeof servers !== 'object') {
        continue;
      }
      for (const [serverId, favorites] of Object.entries(servers)) {
        if (!Array.isArray(favorites)) {
          continue;
        }
        const key = buildFavoritesKey(user, serverId, 'fcom');
        for (const favorite of favorites) {
          if (!favorite?.type || !favorite?.pathId) {
            continue;
          }
          const normalized = { ...favorite, scope: 'fcom' };
          const hashKey = buildFavoriteHashKey(normalized);
          await client.hSet(key, hashKey, JSON.stringify(normalized));
          migrated += 1;
        }
      }
    }

    console.log(`Migrated ${migrated} favorites into Redis.`);
  } finally {
    await client.quit();
  }
};

migrate().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
