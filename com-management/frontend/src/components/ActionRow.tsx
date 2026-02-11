import type { ReactNode } from 'react';

type ActionRowProps = {
  children: ReactNode;
  className?: string;
};

export default function ActionRow({ children, className }: ActionRowProps) {
  return <div className={className ? `action-row ${className}` : 'action-row'}>{children}</div>;
}
