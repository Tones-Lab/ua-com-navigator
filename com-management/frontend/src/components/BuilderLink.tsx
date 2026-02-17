import type { ButtonHTMLAttributes } from 'react';

type BuilderLinkProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function BuilderLink({ className = '', type = 'button', ...props }: BuilderLinkProps) {
  const mergedClassName = className
    ? `builder-link ${className}`
    : 'builder-link';

  return <button type={type} className={mergedClassName} {...props} />;
}
