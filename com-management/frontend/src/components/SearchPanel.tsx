import type { FormEvent, ReactNode } from 'react';

type SearchScopeOption = {
  value: string;
  label: string;
};

type SearchPanelProps = {
  title?: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  scopes?: SearchScopeOption[];
  scopeValue?: string;
  onScopeChange?: (value: string) => void;
  isLoading?: boolean;
  searchLabel?: string;
  disableSearch?: boolean;
  helperContent?: ReactNode;
  actions?: ReactNode;
};

export default function SearchPanel({
  title = 'Search',
  placeholder,
  query,
  onQueryChange,
  onSubmit,
  scopes,
  scopeValue,
  onScopeChange,
  isLoading,
  searchLabel,
  disableSearch,
  helperContent,
  actions,
}: SearchPanelProps) {
  return (
    <div className="panel-section panel-section-search">
      <div className="panel-section-title">{title}</div>
      <form className="global-search" onSubmit={onSubmit}>
        <div className="global-search-row">
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {scopes && onScopeChange && (
            <select
              value={scopeValue}
              onChange={(event) => onScopeChange(event.target.value)}
            >
              {scopes.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="search-button"
            disabled={Boolean(disableSearch || isLoading)}
          >
            {isLoading ? 'Searching…' : searchLabel || 'Search'}
          </button>
        </div>
        {(helperContent || actions) && (
          <div className="search-meta-row">
            {helperContent ? <div className="search-helper">{helperContent}</div> : <div />}
            {actions && <div className="search-actions-row">{actions}</div>}
          </div>
        )}
      </form>
    </div>
  );
}
