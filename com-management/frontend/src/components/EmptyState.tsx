import type { ReactNode } from 'react';

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export default function EmptyState({ children, className }: EmptyStateProps) {
  return <div className={className ? `empty-state ${className}` : 'empty-state'}>{children}</div>;
}
