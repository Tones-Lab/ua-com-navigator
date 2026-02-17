import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import useRequest from './useRequest';
import { getApiErrorMessage } from '../utils/errorUtils';
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
  const {
    loading: favoritesLoading,
    error: favoritesError,
    setError: setFavoritesError,
    setLoading: setFavoritesLoading,
    run: runFavoritesRequest,
  } = useRequest();

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
      const resp = await runFavoritesRequest(
        () => api.getFavorites(getFavoriteScope(activeApp)),
        {
          getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to load favorites'),
        },
      );
      if (isMounted && resp) {
        setFavorites(resp.data?.favorites || []);
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
      const scope = getFavoriteScope(activeApp);
      if (isFavorite(favorite.type, favorite.pathId)) {
        const resp = await runFavoritesRequest(
          () =>
            api.removeFavorite({
              type: favorite.type,
              pathId: favorite.pathId,
              scope,
            }),
          {
            getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to update favorites'),
            clearError: true,
          },
        );
        if (!resp) {
          return;
        }
        setFavorites(resp.data?.favorites || []);
      } else {
        const resp = await runFavoritesRequest(
          () => api.addFavorite({ ...favorite, scope }),
          {
            getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to update favorites'),
            clearError: true,
          },
        );
        if (!resp) {
          return;
        }
        setFavorites(resp.data?.favorites || []);
      }
    },
    [activeApp, isFavorite, runFavoritesRequest],
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
