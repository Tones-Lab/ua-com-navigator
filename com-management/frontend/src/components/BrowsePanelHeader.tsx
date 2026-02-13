import type { FormEvent, ReactNode } from 'react';
import FavoritesPanel, { type FavoriteEntry } from './FavoritesPanel';
import PanelHeader from './PanelHeader';
import PathBreadcrumbs from './PathBreadcrumbs';
import SearchPanel from './SearchPanel';

type BreadcrumbItem = { label: string; value: string | null };

type SearchConfig = {
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  scopes?: Array<{ value: string; label: string }>;
  scopeValue?: string;
  onScopeChange?: (value: string) => void;
  isLoading?: boolean;
  helperContent?: ReactNode;
  actions?: ReactNode;
  disableSearch?: boolean;
};

type FavoritesConfig = {
  folders: FavoriteEntry[];
  files: FavoriteEntry[];
  loading: boolean;
  error: string | null;
  onOpenFolder: (entry: FavoriteEntry) => void;
  onOpenFile: (entry: FavoriteEntry) => void;
};

type BrowsePanelHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
  flag?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  onCrumbSelect?: (index: number) => void;
  search?: SearchConfig;
  favorites?: FavoritesConfig;
  isCompact?: boolean;
};

export default function BrowsePanelHeader({
  title,
  actions,
  flag,
  breadcrumbs,
  onCrumbSelect,
  search,
  favorites,
  isCompact = false,
}: BrowsePanelHeaderProps) {
  return (
    <PanelHeader title={title} actions={actions} flag={flag}>
      {breadcrumbs && onCrumbSelect && (
        <PathBreadcrumbs items={breadcrumbs} onSelect={onCrumbSelect} />
      )}
      {search && (
        <SearchPanel
          placeholder={search.placeholder}
          query={search.query}
          onQueryChange={search.onQueryChange}
          onSubmit={search.onSubmit}
          scopes={search.scopes}
          scopeValue={search.scopeValue}
          onScopeChange={search.onScopeChange}
          isLoading={search.isLoading}
          helperContent={search.helperContent}
          actions={search.actions}
          disableSearch={search.disableSearch}
        />
      )}
      {favorites && (
        <FavoritesPanel
          favoritesFolders={favorites.folders}
          favoritesFiles={favorites.files}
          favoritesLoading={favorites.loading}
          favoritesError={favorites.error}
          isCompact={isCompact}
          onOpenFolder={favorites.onOpenFolder}
          onOpenFile={favorites.onOpenFile}
        />
      )}
    </PanelHeader>
  );
}
