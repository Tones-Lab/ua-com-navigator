import type { ReactNode } from 'react';

type ModalProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  ariaLabel?: string;
};

export default function Modal({ children, className, overlayClassName, ariaLabel }: ModalProps) {
  const overlay = overlayClassName ? `modal-overlay ${overlayClassName}` : 'modal-overlay';
  const container = className ? `modal ${className}` : 'modal';

  return (
    <div className={overlay} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={container}>{children}</div>
    </div>
  );
}
