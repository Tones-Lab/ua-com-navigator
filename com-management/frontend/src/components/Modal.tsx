import type { CSSProperties, ReactNode, Ref } from 'react';

type ModalProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  ariaLabel?: string;
  style?: CSSProperties;
  containerRef?: Ref<HTMLDivElement>;
};

export default function Modal({
  children,
  className,
  overlayClassName,
  ariaLabel,
  style,
  containerRef,
}: ModalProps) {
  const overlay = overlayClassName ? `modal-overlay ${overlayClassName}` : 'modal-overlay';
  const container = className ? `modal ${className}` : 'modal';

  return (
    <div className={overlay} style={style} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={container} ref={containerRef}>
        {children}
      </div>
    </div>
  );
}
