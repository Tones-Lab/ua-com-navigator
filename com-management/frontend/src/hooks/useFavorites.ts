import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import type {
  FavoriteEntry,
  FavoriteFileEntry,
  FavoriteFolderEntry,
  FavoriteScope,
} from '../types/api';

type FavoritesAppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

type UseFavoritesParams = {
  isAuthenticated: boolean;
  activeApp: FavoritesAppTab;
};

const supportsFavorites = (app: FavoritesAppTab): app is FavoriteScope =>
  app === 'fcom' || app === 'pcom' || app === 'mib';

const getFavoriteScope = (app: FavoritesAppTab): FavoriteScope =>
  app === 'pcom' || app === 'mib' ? app : 'fcom';

export default function useFavorites({ isAuthenticated, activeApp }: UseFavoritesParams) {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavorites([]);
      setFavoritesError(null);
      setFavoritesLoading(false);
      return;
    }

    if (!supportsFavorites(activeApp)) {
      setFavorites([]);
      setFavoritesError(null);
      setFavoritesLoading(false);
      return;
    }

    let isMounted = true;
    const loadFavorites = async () => {
      setFavoritesError(null);
      setFavoritesLoading(true);
      try {
        const resp = await api.getFavorites(getFavoriteScope(activeApp));
        if (isMounted) {
          setFavorites(resp.data?.favorites || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setFavoritesError(err?.response?.data?.error || 'Failed to load favorites');
        }
      } finally {
        if (isMounted) {
          setFavoritesLoading(false);
        }
      }
    };

    void loadFavorites();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, activeApp]);

  const isFavorite = useCallback(
    (type: 'file' | 'folder', pathId: string) =>
      favorites.some((fav) => fav.pathId === pathId && fav.type === type),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (favorite: FavoriteEntry) => {
      if (!supportsFavorites(activeApp)) {
        return;
      }
      try {
        setFavoritesError(null);
        const scope = getFavoriteScope(activeApp);
        if (isFavorite(favorite.type, favorite.pathId)) {
          const resp = await api.removeFavorite({
            type: favorite.type,
            pathId: favorite.pathId,
            scope,
          });
          setFavorites(resp.data?.favorites || []);
        } else {
          const resp = await api.addFavorite({ ...favorite, scope });
          setFavorites(resp.data?.favorites || []);
        }
      } catch (err: any) {
        setFavoritesError(err?.response?.data?.error || 'Failed to update favorites');
      }
    },
    [activeApp, isFavorite],
  );

  const favoritesFiles = useMemo(
    () => favorites.filter((fav): fav is FavoriteFileEntry => fav.type === 'file'),
    [favorites],
  );

  const favoritesFolders = useMemo(
    () => favorites.filter((fav): fav is FavoriteFolderEntry => fav.type === 'folder'),
    [favorites],
  );

  return {
    favoritesFiles,
    favoritesFolders,
    favoritesLoading,
    favoritesError,
    isFavorite,
    toggleFavorite,
  };
}
