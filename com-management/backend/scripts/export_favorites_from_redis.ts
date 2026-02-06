/**
 * Purpose: Export Redis favorites into a JSON backup file.
 * Usage:
 *   tsx scripts/export_favorites_from_redis.ts
 * Notes:
 * - Writes FAVORITES_EXPORT_PATH or defaults to ./data/favorites.backup.json
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
};

type FavoritesState = Record<string, Record<string, FavoriteItem[]>>;

const FAVORITES_PREFIX = 'fcom:favorites:';

const resolveExportPath = () => {
  const overridePath = process.env.FAVORITES_EXPORT_PATH;
  if (overridePath) {
    return overridePath;
  }
  return path.resolve(process.cwd(), 'data', 'favorites.backup.json');
};

const parseKey = (key: string) => {
  if (!key.startsWith(FAVORITES_PREFIX)) {
    return null;
  }
  const stripped = key.slice(FAVORITES_PREFIX.length);
  const lastColon = stripped.lastIndexOf(':');
  if (lastColon <= 0) {
    return null;
  }
  return {
    serverId: stripped.slice(0, lastColon),
    user: stripped.slice(lastColon + 1),
  };
};

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

const exportFavorites = async () => {
  const client = await getRedisClient();
  const state: FavoritesState = {};
  let totalFavorites = 0;
  let totalKeys = 0;

  try {
    for await (const key of client.scanIterator({ MATCH: `${FAVORITES_PREFIX}*`, COUNT: 100 })) {
      const parsed = parseKey(key as string);
      if (!parsed) {
        continue;
      }
      const { serverId, user } = parsed;
      const entries = await client.hGetAll(key as string);
      const favorites = Object.values(entries)
        .map((entry) => parseFavoriteEntry(entry))
        .filter((entry): entry is FavoriteItem => Boolean(entry))
        .sort((a, b) => `${a.type}:${a.pathId}`.localeCompare(`${b.type}:${b.pathId}`));

      if (!state[user]) {
        state[user] = {};
      }
      state[user][serverId] = favorites;
      totalFavorites += favorites.length;
      totalKeys += 1;
    }

    const outputPath = resolveExportPath();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');

    console.log(`Exported ${totalFavorites} favorites from ${totalKeys} keys to ${outputPath}`);
  } finally {
    await client.quit();
  }
};

exportFavorites().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
