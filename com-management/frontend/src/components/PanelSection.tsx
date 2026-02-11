import type { ReactNode } from 'react';

type PanelSectionProps = {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
};

export default function PanelSection({
  title,
  children,
  className,
  titleClassName,
}: PanelSectionProps) {
  return (
    <div className={className ? `panel-section ${className}` : 'panel-section'}>
      {title && (
        <div className={titleClassName ? `panel-section-title ${titleClassName}` : 'panel-section-title'}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
