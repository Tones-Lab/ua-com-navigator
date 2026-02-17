import FcomConfirmModals from './FcomConfirmModals';
import FcomOverrideRemovalModals from './FcomOverrideRemovalModals';
import FcomProcessorTooltip from './FcomProcessorTooltip';
import FcomSaveOverlays from './FcomSaveOverlays';
import FcomFieldSelectionModals from './FcomFieldSelectionModals';
import FcomPathHelpModal from './FcomPathHelpModal';
import FcomTrapVariablesModal from './FcomTrapVariablesModal';

type FcomAuxOverlaysProps = any;

export default function FcomAuxOverlays({
  builderSwitchModal,
  setBuilderSwitchModal,
  applyBuilderTypeSwitch,
  panelNavWarning,
  setPanelNavWarning,
  pendingNav,
  setPendingNav,
  discardAllEdits,
  pendingCancel,
  setPendingCancel,
  closeBuilder,
  discardEventEdit,
  pendingReviewDiscard,
  setPendingReviewDiscard,
  setShowReviewModal,
  removeOverrideModal,
  setRemoveOverrideModal,
  confirmRemoveOverride,
  removeAllOverridesModal,
  setRemoveAllOverridesModal,
  confirmRemoveAllOverrides,
  openAdvancedFlowModal,
  processorTooltip,
  saveLoading,
  saveElapsed,
  overrideSaveDisplayStatus,
  redeployLoading,
  microserviceActionLabel,
  redeployElapsed,
  showAddFieldModal,
  addFieldContext,
  addFieldSearch,
  setAddFieldSearch,
  availableEventFields,
  panelAddedFields,
  reservedEventFields,
  getEventFieldDescription,
  addFieldToPanel,
  setShowAddFieldModal,
  eventFieldPickerOpen,
  eventFieldSearch,
  setEventFieldSearch,
  handleEventFieldInsertSelect,
  setEventFieldPickerOpen,
  setEventFieldInsertContext,
  showPathModal,
  getCurrentPath,
  setShowPathModal,
  varModalOpen,
  varModalMode,
  varModalVars,
  varModalToken,
  varListRef,
  varRowRefs,
  renderValue,
  formatDescription,
  renderEnums,
  getModalOverlayStyle,
  handleVarInsertSelect,
  setVarModalOpen,
  setVarModalMode,
  setVarInsertContext,
}: FcomAuxOverlaysProps) {
  return (
    <>
      <FcomConfirmModals
        builderSwitchModal={builderSwitchModal}
        onCancelBuilderSwitch={() => setBuilderSwitchModal({ open: false })}
        onConfirmBuilderSwitch={() => {
          if (builderSwitchModal.to) {
            applyBuilderTypeSwitch(builderSwitchModal.to);
          }
          setBuilderSwitchModal({ open: false });
        }}
        panelNavWarningOpen={panelNavWarning.open}
        onConfirmPanelNavWarning={() => setPanelNavWarning((prev: any) => ({ ...prev, open: false }))}
        pendingNavOpen={Boolean(pendingNav)}
        onCancelPendingNav={() => setPendingNav(null)}
        onConfirmPendingNav={() => {
          const action = pendingNav;
          setPendingNav(null);
          discardAllEdits();
          if (action) {
            action();
          }
        }}
        pendingCancelOpen={Boolean(pendingCancel)}
        onCancelPendingCancel={() => setPendingCancel(null)}
        onConfirmPendingCancel={() => {
          const next = pendingCancel;
          setPendingCancel(null);
          if (!next) {
            return;
          }
          if (next.type === 'builder') {
            closeBuilder();
            return;
          }
          if (next.type === 'panel' && next.panelKey) {
            discardEventEdit(next.panelKey);
          }
        }}
        pendingReviewDiscard={pendingReviewDiscard}
        onCancelPendingReviewDiscard={() => setPendingReviewDiscard(false)}
        onConfirmPendingReviewDiscard={() => {
          setPendingReviewDiscard(false);
          discardAllEdits();
          setShowReviewModal(false);
        }}
      />
      <FcomOverrideRemovalModals
        removeOverrideModal={removeOverrideModal}
        onCloseRemoveOverride={() => setRemoveOverrideModal({ open: false })}
        onConfirmRemoveOverride={confirmRemoveOverride}
        removeAllOverridesModal={removeAllOverridesModal}
        onCloseRemoveAllOverrides={() => setRemoveAllOverridesModal({ open: false })}
        onConfirmRemoveAllOverrides={confirmRemoveAllOverrides}
        onOpenAdvancedFlow={(objectName) => {
          openAdvancedFlowModal('object', objectName, null);
        }}
      />
      <FcomProcessorTooltip tooltip={processorTooltip} />
      <FcomSaveOverlays
        saveLoading={saveLoading}
        saveElapsed={saveElapsed}
        overrideSaveDisplayStatus={overrideSaveDisplayStatus}
        redeployLoading={redeployLoading}
        microserviceActionLabel={microserviceActionLabel}
        redeployElapsed={redeployElapsed}
      />
      <FcomFieldSelectionModals
        showAddFieldModal={showAddFieldModal}
        addFieldContext={addFieldContext}
        addFieldSearch={addFieldSearch}
        setAddFieldSearch={setAddFieldSearch}
        availableEventFields={availableEventFields}
        panelAddedFields={panelAddedFields}
        reservedEventFields={reservedEventFields}
        getEventFieldDescription={getEventFieldDescription}
        addFieldToPanel={addFieldToPanel}
        onCloseAddField={() => setShowAddFieldModal(false)}
        eventFieldPickerOpen={eventFieldPickerOpen}
        eventFieldSearch={eventFieldSearch}
        setEventFieldSearch={setEventFieldSearch}
        handleEventFieldInsertSelect={handleEventFieldInsertSelect}
        onCloseEventFieldPicker={() => {
          setEventFieldPickerOpen(false);
          setEventFieldInsertContext(null);
        }}
      />
      <FcomPathHelpModal
        open={showPathModal}
        currentPath={getCurrentPath()}
        onClose={() => setShowPathModal(false)}
      />
      <FcomTrapVariablesModal
        open={varModalOpen}
        mode={varModalMode}
        variables={varModalVars}
        selectedToken={varModalToken}
        varListRef={varListRef}
        varRowRefs={varRowRefs}
        renderValue={renderValue}
        formatDescription={formatDescription}
        renderEnums={renderEnums}
        getModalOverlayStyle={getModalOverlayStyle}
        onInsertSelect={handleVarInsertSelect}
        onClose={() => {
          setVarModalOpen(false);
          setVarModalMode('view');
          setVarInsertContext(null);
        }}
      />
    </>
  );
}
