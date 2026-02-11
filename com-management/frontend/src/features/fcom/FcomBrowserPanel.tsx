import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import EmptyState from '../../components/EmptyState';
import FavoritesPanel from '../../components/FavoritesPanel';
import InlineMessage from '../../components/InlineMessage';
import PanelHeader from '../../components/PanelHeader';
import SearchPanel from '../../components/SearchPanel';
import PathBreadcrumbs from '../../components/PathBreadcrumbs';

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
  openFileFromUrl: (pathId: string, node?: string | null) => void | Promise<boolean>;
  handleOpenSearchResult: (result: any) => void;
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
  searchResults,
  searchError,
  getSearchResultName,
  browseError,
  browseLoading,
  entries,
  isFolder,
  handleOpenFile,
}: FcomBrowserPanelProps) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1200px)');
    const update = () => setIsCompact(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return (
    <div className="panel">
      <div className="panel-scroll">
        <PanelHeader
          title="File Browser"
          actions={
            <button
              type="button"
              className="info-button"
              onClick={() => setShowPathModal(true)}
              aria-label="Show full path"
              title="Show full path"
            >
              ?
            </button>
          }
          flag={
            !hasEditPermission ? (
              <span className="read-only-flag" title="You do not have permission to edit rules.">
                Read-only access
              </span>
            ) : null
          }
        >
          <PathBreadcrumbs
            items={breadcrumbs.map((crumb) => ({ label: crumb.label, value: crumb.node }))}
            onSelect={handleCrumbClick}
          />
          <SearchPanel
            placeholder="Search names + contents"
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            scopes={[
              { value: 'all', label: 'All' },
              { value: 'name', label: 'Names' },
              { value: 'content', label: 'Content' },
            ]}
            scopeValue={searchScope}
            onScopeChange={(value) => setSearchScope(value as 'all' | 'name' | 'content')}
            isLoading={searchLoading}
            helperContent={
              <>
                <span>
                  Scope: {searchScope === 'all' ? 'All' : searchScope === 'name' ? 'Names' : 'Content'}
                </span>
                {searchQuery.trim() && (
                  <span className="search-helper-query">Query: “{searchQuery.trim()}”</span>
                )}
              </>
            }
            actions={
              <>
                <button
                  type="button"
                  className="link-button"
                  onClick={handleClearSearch}
                  disabled={!searchQuery && searchResults.length === 0}
                >
                  Clear
                </button>
                <button type="button" className="link-button" onClick={handleResetNavigation}>
                  Reset
                </button>
              </>
            }
          />
          <FavoritesPanel
            favoritesFolders={favoritesFolders}
            favoritesFiles={favoritesFiles}
            favoritesLoading={favoritesLoading}
            favoritesError={favoritesError}
            isCompact={isCompact}
            onOpenFolder={(fav) => handleOpenFolder({ PathID: fav.pathId, PathName: fav.label })}
            onOpenFile={(fav) => openFileFromUrl(fav.pathId, fav.node)}
          />
        </PanelHeader>
        {searchQuery.trim() && (
          <details className="search-results" open={!isCompact}>
            <summary className="search-results-summary">
              <span>Search results ({searchResults.length})</span>
              <div className="search-results-actions">
                {searchLoading && <span className="muted">Searching…</span>}
                <button
                  type="button"
                  className="link-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleClearSearch();
                  }}
                  disabled={!searchQuery && searchResults.length === 0}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleResetNavigation();
                  }}
                >
                  Reset
                </button>
              </div>
            </summary>
            <div className="search-results-body">
              {searchError && <InlineMessage tone="error">{searchError}</InlineMessage>}
              {!searchLoading && !searchError && searchResults.length === 0 && (
                <EmptyState>No matches found.</EmptyState>
              )}
              {!searchLoading && !searchError && searchResults.length > 0 && (
                <ul className="search-results-list">
                  {searchResults.map((result, idx) => (
                    <li key={`${result?.pathId || result?.name || 'result'}-${idx}`}>
                      <button
                        type="button"
                        className="search-result-link"
                        onClick={() => handleOpenSearchResult(result)}
                        title={result?.pathId || ''}
                      >
                        {getSearchResultName(result)}
                      </button>
                      <div className="search-result-meta">
                        {result?.source === 'both'
                          ? 'Match: filename and content'
                          : result?.source === 'content'
                            ? 'Match: content'
                            : 'Match: filename'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )}
        {browseError && <InlineMessage tone="error">{browseError}</InlineMessage>}
        {browseLoading ? (
          <div className="browse-loading">Refreshing folders…</div>
        ) : (
          <div className="browse-results">
            {entries.length === 0 ? (
              <EmptyState>No files or folders found.</EmptyState>
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
