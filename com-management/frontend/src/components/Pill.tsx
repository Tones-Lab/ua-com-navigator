import type { HTMLAttributes } from 'react';

type PillProps = HTMLAttributes<HTMLSpanElement>;

export default function Pill({ className = '', ...props }: PillProps) {
  const mergedClassName = className ? `pill ${className}` : 'pill';
  return <span className={mergedClassName} {...props} />;
}
