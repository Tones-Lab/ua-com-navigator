type FavoriteEntry = { type: 'file' | 'folder'; pathId: string; label: string; node?: string };

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
            <summary>Favorite Folders</summary>
            {favoritesLoading && <div className="muted">Loading…</div>}
            {favoritesError && <div className="error">{favoritesError}</div>}
            {favoritesFolders.length === 0 ? (
              <div className="empty-state">No favorites yet.</div>
            ) : (
              <ul className="favorites-list">
                {favoritesFolders.map((fav) => (
                  <li key={`${fav.type}-${fav.pathId}`}>
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
            <summary>Favorite Files</summary>
            {favoritesFiles.length === 0 ? (
              <div className="empty-state">No favorites yet.</div>
            ) : (
              <ul className="favorites-list">
                {favoritesFiles.map((fav) => (
                  <li key={`${fav.type}-${fav.pathId}`}>
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
