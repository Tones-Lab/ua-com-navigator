import FcomAdvancedFlowModal from './FcomAdvancedFlowModal';
import FcomBuilderHelpModal from './FcomBuilderHelpModal';
import FcomFieldReferenceModal from './FcomFieldReferenceModal';
import FcomFlowEditorModal from './FcomFlowEditorModal';

type FcomFlowModalStackProps = any;

export default function FcomFlowModalStack({
  showBuilderHelpModal,
  onCloseBuilderHelpModal,
  showAdvancedProcessorModal,
  pendingAdvancedFlowClose,
  getModalOverlayStyle,
  advancedFlowModalRef,
  advancedProcessorScope,
  requestCloseAdvancedFlowModal,
  advancedFlowDirty,
  flowErrorCount,
  advancedFlowRemovedTargets,
  formatFlowTargetLabel,
  advancedProcessorSearch,
  setAdvancedProcessorSearch,
  advancedFlowVersionInfo,
  advancedFlowNotice,
  advancedFlowPatchPreview,
  canConvertToV3,
  onConvertToV3,
  advancedFlowFocusTarget,
  advancedFlowFocusIndex,
  advancedFlowFocusOnly,
  focusedFlowMatch,
  focusedFlowMatches,
  focusedLaneLabel,
  setAdvancedFlowFocusTarget,
  setAdvancedFlowFocusIndex,
  setAdvancedFlowFocusOnly,
  paletteSections,
  renderProcessorHelp,
  renderFlowList,
  globalPreFlow,
  setGlobalPreFlow,
  globalPostFlow,
  setGlobalPostFlow,
  advancedFlow,
  setAdvancedFlow,
  flowValidation,
  renderFlowJsonPreview,
  buildFlowProcessors,
  normalizeSourcePath,
  hasEditPermission,
  triggerFlowErrorPulse,
  saveAdvancedFlow,
  onCancelAdvancedFlowClose,
  onConfirmAdvancedFlowClose,
  flowEditor,
  flowEditorDraft,
  flowEditorModalRef,
  getFlowNodeLabel,
  setShowFieldReferenceModal,
  applyFlowEditorExample,
  renderProcessorConfigFields,
  flowEditorFieldErrors,
  handleFlowEditorInputChange,
  setFlowEditorDraft,
  validateFlowNodes,
  nextSwitchCaseId,
  flowEditorNodeErrors,
  flowEditorHasErrors,
  triggerValidationPulse,
  handleCancelFlowEditor,
  handleSaveFlowEditor,
  showFieldReferenceModal,
  availableEventFields,
  getEventFieldDescription,
}: FcomFlowModalStackProps) {
  return (
    <>
      <FcomBuilderHelpModal open={showBuilderHelpModal} onClose={onCloseBuilderHelpModal} />
      <FcomAdvancedFlowModal
        showAdvancedProcessorModal={showAdvancedProcessorModal}
        pendingAdvancedFlowClose={pendingAdvancedFlowClose}
        getModalOverlayStyle={getModalOverlayStyle}
        advancedFlowModalRef={advancedFlowModalRef}
        advancedProcessorScope={advancedProcessorScope}
        requestCloseAdvancedFlowModal={requestCloseAdvancedFlowModal}
        advancedFlowDirty={advancedFlowDirty}
        flowErrorCount={flowErrorCount}
        advancedFlowRemovedTargets={advancedFlowRemovedTargets}
        formatFlowTargetLabel={formatFlowTargetLabel}
        advancedProcessorSearch={advancedProcessorSearch}
        onAdvancedProcessorSearchChange={setAdvancedProcessorSearch}
        advancedFlowVersionInfo={advancedFlowVersionInfo}
        advancedFlowNotice={advancedFlowNotice}
        advancedFlowPatchPreview={advancedFlowPatchPreview}
        canConvertToV3={canConvertToV3}
        onConvertToV3={onConvertToV3}
        advancedFlowFocusTarget={advancedFlowFocusTarget}
        advancedFlowFocusIndex={advancedFlowFocusIndex}
        advancedFlowFocusOnly={advancedFlowFocusOnly}
        focusedFlowMatch={focusedFlowMatch}
        focusedFlowMatches={focusedFlowMatches}
        focusedLaneLabel={focusedLaneLabel}
        setAdvancedFlowFocusTarget={setAdvancedFlowFocusTarget}
        setAdvancedFlowFocusIndex={setAdvancedFlowFocusIndex}
        setAdvancedFlowFocusOnly={setAdvancedFlowFocusOnly}
        paletteSections={paletteSections}
        renderProcessorHelp={renderProcessorHelp}
        renderFlowList={renderFlowList}
        globalPreFlow={globalPreFlow}
        setGlobalPreFlow={setGlobalPreFlow}
        globalPostFlow={globalPostFlow}
        setGlobalPostFlow={setGlobalPostFlow}
        advancedFlow={advancedFlow}
        setAdvancedFlow={setAdvancedFlow}
        flowValidation={flowValidation}
        renderFlowJsonPreview={renderFlowJsonPreview}
        buildFlowProcessors={(nodes, normalizePath) => buildFlowProcessors(nodes, normalizePath)}
        normalizeSourcePath={normalizeSourcePath}
        hasEditPermission={hasEditPermission}
        triggerFlowErrorPulse={triggerFlowErrorPulse}
        saveAdvancedFlow={saveAdvancedFlow}
        onCancelAdvancedFlowClose={onCancelAdvancedFlowClose}
        onConfirmAdvancedFlowClose={onConfirmAdvancedFlowClose}
      />
      <FcomFlowEditorModal
        flowEditor={flowEditor}
        flowEditorDraft={flowEditorDraft}
        flowEditorModalRef={flowEditorModalRef}
        getModalOverlayStyle={getModalOverlayStyle}
        getFlowNodeLabel={getFlowNodeLabel}
        onShowFieldReference={() => setShowFieldReferenceModal(true)}
        applyFlowEditorExample={applyFlowEditorExample}
        renderProcessorConfigFields={renderProcessorConfigFields}
        flowEditorFieldErrors={flowEditorFieldErrors}
        handleFlowEditorInputChange={handleFlowEditorInputChange}
        setFlowEditorDraft={setFlowEditorDraft}
        renderFlowList={renderFlowList}
        validateFlowNodes={validateFlowNodes}
        nextSwitchCaseId={nextSwitchCaseId}
        flowEditorNodeErrors={flowEditorNodeErrors}
        flowEditorHasErrors={flowEditorHasErrors}
        triggerValidationPulse={triggerValidationPulse}
        onCancelFlowEditor={handleCancelFlowEditor}
        onSaveFlowEditor={handleSaveFlowEditor}
      />
      <FcomFieldReferenceModal
        open={showFieldReferenceModal}
        hasModalOnTop={Boolean(showAdvancedProcessorModal || flowEditor)}
        availableEventFields={availableEventFields}
        getEventFieldDescription={getEventFieldDescription}
        getModalOverlayStyle={getModalOverlayStyle}
        onClose={() => setShowFieldReferenceModal(false)}
      />
    </>
  );
}
