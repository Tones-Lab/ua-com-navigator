/**
 * Purpose: Normalize favorite labels to match the leaf of pathId.
 * Usage:
 *   DRY_RUN=1 tsx scripts/normalize_favorites_labels.ts
 *   tsx scripts/normalize_favorites_labels.ts
 */
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

const FAVORITES_PREFIX = 'favorites:';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const deriveLabel = (pathId?: string) => {
  if (!pathId) {
    return '';
  }
  const cleaned = pathId.replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  return parts[parts.length - 1];
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

const normalizeFavorites = async () => {
  const client = await getRedisClient();
  let totalEntries = 0;
  let updatedEntries = 0;
  let totalKeys = 0;

  try {
    for await (const key of client.scanIterator({ MATCH: `${FAVORITES_PREFIX}*`, COUNT: 100 })) {
      const entries = await client.hGetAll(key as string);
      const updates: Record<string, string> = {};
      totalKeys += 1;

      Object.entries(entries).forEach(([hashKey, raw]) => {
        const favorite = parseFavoriteEntry(raw);
        if (!favorite) {
          return;
        }
        totalEntries += 1;
        const nextLabel = deriveLabel(favorite.pathId);
        if (!nextLabel || nextLabel === favorite.label) {
          return;
        }
        updates[hashKey] = JSON.stringify({ ...favorite, label: nextLabel });
        updatedEntries += 1;
      });

      if (!DRY_RUN && Object.keys(updates).length > 0) {
        await client.hSet(key as string, updates);
      }
    }

    const modeLabel = DRY_RUN ? 'dry-run' : 'apply';
    console.log(
      `Favorites label normalization (${modeLabel}): ${updatedEntries}/${totalEntries} entries updated across ${totalKeys} keys.`,
    );
  } finally {
    await client.quit();
  }
};

normalizeFavorites().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
