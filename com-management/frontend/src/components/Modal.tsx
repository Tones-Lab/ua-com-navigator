import type { CSSProperties, ReactNode } from 'react';

type ModalProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

export default function Modal({
  children,
  className,
  overlayClassName,
  ariaLabel,
  style,
}: ModalProps) {
  const overlay = overlayClassName ? `modal-overlay ${overlayClassName}` : 'modal-overlay';
  const container = className ? `modal ${className}` : 'modal';

  return (
    <div className={overlay} style={style} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={container}>{children}</div>
    </div>
  );
}
