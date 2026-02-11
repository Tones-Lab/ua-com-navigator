import type { ReactNode } from 'react';

type FavoriteToggle = {
  active: boolean;
  onToggle: () => void;
  label?: string;
};

type FileTitleRowProps = {
  title: ReactNode;
  path?: string | null;
  favorite?: FavoriteToggle | null;
};

type ViewToggleProps = {
  viewMode: 'friendly' | 'preview';
  onChange: (mode: 'friendly' | 'preview') => void;
};

export function FileTitleRow({ title, path, favorite }: FileTitleRowProps) {
  return (
    <div className="file-title">
      <strong>
        {title}
        {favorite && (
          <button
            type="button"
            className={favorite.active ? 'star-button star-active' : 'star-button'}
            onClick={favorite.onToggle}
            aria-label={favorite.label || 'Toggle favorite file'}
            title={favorite.label || 'Toggle favorite file'}
          >
            ★
          </button>
        )}
      </strong>
      {path && <span className="file-path">{path}</span>}
    </div>
  );
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <span className={viewMode === 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
        Friendly
      </span>
      <label className="switch" aria-label="Toggle friendly/raw view">
        <input
          type="checkbox"
          checked={viewMode !== 'friendly'}
          onChange={(event) => {
            if (event.target.checked) {
              onChange('preview');
            } else {
              onChange('friendly');
            }
          }}
        />
        <span className="slider" />
      </label>
      <span className={viewMode !== 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
        Raw
      </span>
    </div>
  );
}
