import ConfirmModal from '../../components/ConfirmModal';

type BuilderSwitchModalState = {
  open: boolean;
  from?: string | null;
  to?: string | null;
};

type FcomConfirmModalsProps = {
  builderSwitchModal: BuilderSwitchModalState;
  onCancelBuilderSwitch: () => void;
  onConfirmBuilderSwitch: () => void;
  panelNavWarningOpen: boolean;
  onConfirmPanelNavWarning: () => void;
  pendingNavOpen: boolean;
  onCancelPendingNav: () => void;
  onConfirmPendingNav: () => void;
  pendingCancelOpen: boolean;
  onCancelPendingCancel: () => void;
  onConfirmPendingCancel: () => void;
  pendingReviewDiscard: boolean;
  onCancelPendingReviewDiscard: () => void;
  onConfirmPendingReviewDiscard: () => void;
};

export default function FcomConfirmModals({
  builderSwitchModal,
  onCancelBuilderSwitch,
  onConfirmBuilderSwitch,
  panelNavWarningOpen,
  onConfirmPanelNavWarning,
  pendingNavOpen,
  onCancelPendingNav,
  onConfirmPendingNav,
  pendingCancelOpen,
  onCancelPendingCancel,
  onConfirmPendingCancel,
  pendingReviewDiscard,
  onCancelPendingReviewDiscard,
  onConfirmPendingReviewDiscard,
}: FcomConfirmModalsProps) {
  return (
    <>
      <ConfirmModal
        open={builderSwitchModal.open}
        title="Switch builder type"
        message={
          <>
            Switch from {builderSwitchModal.from} to {builderSwitchModal.to}? This will replace the
            current configuration.
          </>
        }
        onCancel={onCancelBuilderSwitch}
        onConfirm={onConfirmBuilderSwitch}
        confirmLabel="Switch"
      />
      <ConfirmModal
        open={panelNavWarningOpen}
        title="Unsaved panel edits"
        message="Please save or cancel the panel edits before navigating away."
        onConfirm={onConfirmPanelNavWarning}
        confirmLabel="OK"
      />
      <ConfirmModal
        open={pendingNavOpen}
        title="Unsaved changes"
        message="You have unsaved changes. Discard and navigate away?"
        onCancel={onCancelPendingNav}
        onConfirm={onConfirmPendingNav}
        confirmLabel="Discard"
      />
      <ConfirmModal
        open={pendingCancelOpen}
        title="Discard changes?"
        message="You have unsaved changes. Discard them?"
        onCancel={onCancelPendingCancel}
        onConfirm={onConfirmPendingCancel}
        confirmLabel="Discard"
      />
      <ConfirmModal
        open={pendingReviewDiscard}
        title="Discard changes?"
        message="Discard all staged changes?"
        onCancel={onCancelPendingReviewDiscard}
        onConfirm={onConfirmPendingReviewDiscard}
        confirmLabel="Discard"
      />
    </>
  );
}
