import type { ReactNode } from 'react';

type PathCrumb = {
  label: string;
  value?: string | null;
};

type PathBreadcrumbsProps = {
  title?: string;
  items: PathCrumb[];
  onSelect: (index: number) => void;
  action?: ReactNode;
};

export default function PathBreadcrumbs({
  title = 'Path',
  items,
  onSelect,
  action,
}: PathBreadcrumbsProps) {
  return (
    <div className="panel-section">
      <div className="panel-title-row">
        <div className="panel-section-title">{title}</div>
        {action && <div>{action}</div>}
      </div>
      <div className="breadcrumbs">
        {items.map((crumb, index) => (
          <button
            key={`${crumb.label}-${index}`}
            type="button"
            className="crumb"
            onClick={() => onSelect(index)}
            disabled={index === items.length - 1}
          >
            {crumb.label}
          </button>
        ))}
      </div>
    </div>
  );
}
