import type { ReactNode } from 'react';

type PanelHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
  flag?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function PanelHeader({ title, actions, flag, children, className }: PanelHeaderProps) {
  const headerClass = className ? `panel-header ${className}` : 'panel-header';

  return (
    <div className={headerClass}>
      <div className="panel-title-row">
        <h2>{title}</h2>
        {actions}
      </div>
      {flag && <div className="panel-flag-row">{flag}</div>}
      {children}
    </div>
  );
}
