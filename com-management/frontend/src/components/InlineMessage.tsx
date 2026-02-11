import type { ReactNode } from 'react';

type InlineMessageTone = 'error' | 'success' | 'muted' | 'info';

type InlineMessageProps = {
  tone: InlineMessageTone;
  children: ReactNode;
  className?: string;
};

const toneClassMap: Record<InlineMessageTone, string> = {
  error: 'error',
  success: 'success',
  muted: 'muted',
  info: 'muted',
};

export default function InlineMessage({ tone, children, className }: InlineMessageProps) {
  const toneClass = toneClassMap[tone] || 'muted';
  const combinedClass = className ? `${toneClass} ${className}` : toneClass;
  return <div className={combinedClass}>{children}</div>;
}
