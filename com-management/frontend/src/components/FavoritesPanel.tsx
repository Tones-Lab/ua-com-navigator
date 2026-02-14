import EmptyState from './EmptyState';
import InlineMessage from './InlineMessage';
import type { FavoriteEntry } from '../types/api';

type FavoritesPanelProps = {
  favoritesFolders: FavoriteEntry[];
  favoritesFiles: FavoriteEntry[];
  favoritesLoading: boolean;
  favoritesError: string | null;
  isCompact: boolean;
  onOpenFolder: (entry: FavoriteEntry) => void;
  onOpenFile: (entry: FavoriteEntry) => void;
};

export default function FavoritesPanel({
  favoritesFolders,
  favoritesFiles,
  favoritesLoading,
  favoritesError,
  isCompact,
  onOpenFolder,
  onOpenFile,
}: FavoritesPanelProps) {
  const favoritesCount = favoritesFolders.length + favoritesFiles.length;
  return (
    <div className="panel-section">
      <div className="favorites-header favorites-header-inline">
        <span className="panel-section-title favorites-title">Favorites</span>
        <span className="favorites-separator" aria-hidden="true">
          {' - '}
        </span>
        <span className="favorites-count">Pinned ({favoritesCount})</span>
      </div>
      <div className="favorites-section">
        <div className="favorites-scroll">
          <details open={!isCompact && favoritesFolders.length > 0}>
            <summary>
              <span>Favorite Folders</span>
              <span className="favorites-subcount">{favoritesFolders.length}</span>
            </summary>
            {favoritesLoading && <InlineMessage tone="muted">Loading…</InlineMessage>}
            {favoritesError && <InlineMessage tone="error">{favoritesError}</InlineMessage>}
            {favoritesFolders.length === 0 ? (
              <EmptyState>No favorites yet.</EmptyState>
            ) : (
              <ul className="favorites-list">
                {favoritesFolders.map((fav) => (
                  <li key={`${fav.type}-${fav.pathId}`} className="favorite-row">
                    <button
                      type="button"
                      className="favorite-link"
                      onClick={() => onOpenFolder(fav)}
                    >
                      <span className="favorite-label">{fav.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details open={!isCompact && favoritesFiles.length > 0}>
            <summary>
              <span>Favorite Files</span>
              <span className="favorites-subcount">{favoritesFiles.length}</span>
            </summary>
            {favoritesFiles.length === 0 ? (
              <EmptyState>No favorites yet.</EmptyState>
            ) : (
              <ul className="favorites-list">
                {favoritesFiles.map((fav) => (
                  <li key={`${fav.type}-${fav.pathId}`} className="favorite-row">
                    <button
                      type="button"
                      className="favorite-link"
                      onClick={() => onOpenFile(fav)}
                    >
                      <span className="favorite-label">{fav.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      </div>
    </div>
  );
}
