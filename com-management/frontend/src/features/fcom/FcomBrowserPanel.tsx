import type { FormEvent } from 'react';

type FcomBrowserPanelProps = {
  hasEditPermission: boolean;
  setShowPathModal: (open: boolean) => void;
  breadcrumbs: Array<{ label: string; node: string | null }>;
  handleCrumbClick: (index: number) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchScope: 'all' | 'name' | 'content';
  setSearchScope: (value: 'all' | 'name' | 'content') => void;
  handleSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  searchLoading: boolean;
  handleClearSearch: () => void;
  handleResetNavigation: () => void;
  favoritesFolders: Array<{ type: 'folder'; pathId: string; label: string }>;
  favoritesFiles: Array<{ type: 'file'; pathId: string; label: string; node?: string }>;
  favoritesLoading: boolean;
  favoritesError: string | null;
  handleOpenFolder: (entry: any) => void;
  openFileFromUrl: (pathId: string, node?: string | null) => void;
  handleOpenSearchResult: (result: any) => void;
  getParentLabel: (node?: string) => string;
  getParentPath: (node?: string) => string;
  searchResults: any[];
  searchError: string | null;
  getSearchResultName: (result: any) => string;
  browseError: string | null;
  browseLoading: boolean;
  entries: any[];
  isFolder: (entry: any) => boolean;
  handleOpenFile: (entry: any) => void;
};

export default function FcomBrowserPanel({
  hasEditPermission,
  setShowPathModal,
  breadcrumbs,
  handleCrumbClick,
  searchQuery,
  setSearchQuery,
  searchScope,
  setSearchScope,
  handleSearchSubmit,
  searchLoading,
  handleClearSearch,
  handleResetNavigation,
  favoritesFolders,
  favoritesFiles,
  favoritesLoading,
  favoritesError,
  handleOpenFolder,
  openFileFromUrl,
  handleOpenSearchResult,
  getParentLabel,
  getParentPath,
  searchResults,
  searchError,
  getSearchResultName,
  browseError,
  browseLoading,
  entries,
  isFolder,
  handleOpenFile,
}: FcomBrowserPanelProps) {
  return (
    <div className="panel">
      <div className="panel-scroll">
        <div className="panel-header">
          <div className="panel-title-row">
            <h2>File Browser</h2>
            <button
              type="button"
              className="info-button"
              onClick={() => setShowPathModal(true)}
              aria-label="Show full path"
              title="Show full path"
            >
              ?
            </button>
          </div>
          {!hasEditPermission && (
            <div className="panel-flag-row">
              <span className="read-only-flag" title="You do not have permission to edit rules.">
                Read-only access
              </span>
            </div>
          )}
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <button
                key={`${crumb.label}-${index}`}
                type="button"
                className="crumb"
                onClick={() => handleCrumbClick(index)}
                disabled={index === breadcrumbs.length - 1}
              >
                {crumb.label}
              </button>
            ))}
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Search</div>
            <form className="global-search" onSubmit={handleSearchSubmit}>
              <div className="global-search-row">
                <input
                  type="text"
                  placeholder="Search files and contents"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as 'all' | 'name' | 'content')}
                >
                  <option value="all">All</option>
                  <option value="name">Names</option>
                  <option value="content">Content</option>
                </select>
                <button type="submit" className="search-button" disabled={searchLoading}>
                  {searchLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
              <div className="search-actions-row">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleClearSearch}
                  disabled={!searchQuery && searchResults.length === 0}
                >
                  Clear Search
                </button>
                <button type="button" className="ghost-button" onClick={handleResetNavigation}>
                  Reset Navigation
                </button>
              </div>
            </form>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Favorites</div>
            <div className="favorites-section">
              <div className="favorites-scroll">
                <details open={favoritesFolders.length > 0}>
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
                            className="quick-link"
                            onClick={() => handleOpenFolder({ PathID: fav.pathId, PathName: fav.label })}
                          >
                            {fav.label}
                            {getParentLabel(getParentPath(fav.pathId)) && (
                              <span className="favorite-parent"> - ({getParentLabel(getParentPath(fav.pathId))})</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
                <details open={favoritesFiles.length > 0}>
                  <summary>Favorite Files</summary>
                  {favoritesFiles.length === 0 ? (
                    <div className="empty-state">No favorites yet.</div>
                  ) : (
                    <ul className="favorites-list">
                      {favoritesFiles.map((fav) => (
                        <li key={`${fav.type}-${fav.pathId}`}>
                          <button
                            type="button"
                            className="quick-link"
                            onClick={() => openFileFromUrl(fav.pathId, fav.node)}
                          >
                            {fav.label}
                            {fav.node && (
                              <span className="favorite-parent"> - ({getParentLabel(fav.node)})</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            </div>
          </div>
        </div>
        {searchQuery.trim() && (
          <div className="search-results">
            <div className="search-results-header">
              <span>Search results ({searchResults.length})</span>
              {searchLoading && <span className="muted">Searching…</span>}
            </div>
            {searchError && <div className="error">{searchError}</div>}
            {!searchLoading && !searchError && searchResults.length === 0 && (
              <div className="empty-state">No matches found.</div>
            )}
            {!searchLoading && !searchError && searchResults.length > 0 && (
              <ul className="search-results-list">
                {searchResults.map((result, idx) => (
                  <li key={`${result?.pathId || result?.name || 'result'}-${idx}`}>
                    <button
                      type="button"
                      className="search-result-link"
                      onClick={() => handleOpenSearchResult(result)}
                    >
                      {getSearchResultName(result)}
                    </button>
                    {result?.pathId && <div className="search-result-path">{result.pathId}</div>}
                    {result?.snippet && <div className="search-snippet">{result.snippet}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {browseError && <div className="error">{browseError}</div>}
        {browseLoading ? (
          <div className="browse-loading">Loading folders…</div>
        ) : (
          <div className="browse-results">
            {entries.length === 0 ? (
              <div className="empty-state">No files or folders found.</div>
            ) : (
              <ul className="browse-list">
                {entries.map((entry) => {
                  const folder = isFolder(entry);
                  return (
                    <li key={entry.PathID || entry.PathName}>
                      <button
                        type="button"
                        className={folder ? 'browse-link' : 'browse-link file-link'}
                        onClick={() => (folder ? handleOpenFolder(entry) : handleOpenFile(entry))}
                      >
                        <span className="browse-icon" aria-hidden="true">
                          {folder ? '📁' : '📄'}
                        </span>
                        {entry.PathName || entry.PathID}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
