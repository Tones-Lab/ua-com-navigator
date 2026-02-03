import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export type FavoriteType = 'file' | 'folder';

export interface FavoriteItem {
  type: FavoriteType;
  label: string;
  pathId: string;
  node?: string;
}

export interface FavoritesState {
  [user: string]: {
    [serverId: string]: FavoriteItem[];
  };
}

const storagePath = path.resolve(process.cwd(), 'data', 'favorites.json');

const readStore = (): FavoritesState => {
  try {
    if (!fs.existsSync(storagePath)) {
      return {};
    }
    const raw = fs.readFileSync(storagePath, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch (error: any) {
    logger.error(`Failed to read favorites store: ${error.message}`);
    return {};
  }
};

const writeStore = (state: FavoritesState) => {
  try {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
  } catch (error: any) {
    logger.error(`Failed to write favorites store: ${error.message}`);
  }
};


export const getFavorites = (user: string, serverId: string): FavoriteItem[] => {
  const state = readStore();
  return state[user]?.[serverId] ?? [];
};

export const addFavorite = (user: string, serverId: string, favorite: FavoriteItem): FavoriteItem[] => {
  const state = readStore();
  if (!state[user]) {
    state[user] = {};
  }
  if (!state[user][serverId]) {
    state[user][serverId] = [];
  }
  const exists = state[user][serverId].some((item) => item.pathId === favorite.pathId && item.type === favorite.type);
  if (!exists) {
    state[user][serverId].push(favorite);
    writeStore(state);
  }
  return state[user][serverId];
};

export const removeFavorite = (user: string, serverId: string, favorite: FavoriteItem): FavoriteItem[] => {
  const state = readStore();
  if (!state[user] || !state[user][serverId]) {
    return [];
  }
  state[user][serverId] = state[user][serverId].filter(
    (item) => !(item.pathId === favorite.pathId && item.type === favorite.type),
  );
  writeStore(state);
  return state[user][serverId];
};
