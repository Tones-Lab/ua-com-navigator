import type { ReactNode } from 'react';
import Modal from './Modal';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  onCancel?: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmClassName?: string;
  confirmDisabled?: boolean;
  ariaLabel?: string;
  children?: ReactNode;
};

export default function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmClassName,
  confirmDisabled,
  ariaLabel,
  children,
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal ariaLabel={ariaLabel || title}>
      <h3>{title}</h3>
      <p>{message}</p>
      {children}
      <div className="modal-actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          className={confirmClassName}
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
