import {
  useFcomBuilderActionsContext,
  useFcomBuilderViewContext,
} from './FcomBuilderContext';
import FcomProcessorForeachEditor from './FcomProcessorForeachEditor';
import FcomProcessorReviewStep from './FcomProcessorReviewStep';
import FcomProcessorSelectStep from './FcomProcessorSelectStep';
import FcomProcessorStepNav from './FcomProcessorStepNav';
import FcomProcessorSwitchEditor from './FcomProcessorSwitchEditor';
import useProcessorConfigure from './useProcessorConfigure';

export default function FcomBuilderProcessorSection() {
  const {
    builderPatchMode,
    builderPatchPreview,
    isBuilderTargetReady,
    builderTarget,
    processorStep,
    processorType,
    processorPayload,
    processorCatalog,
    builderProcessorConfig,
    builderNestedAddType,
    builderPaletteItems,
    builderSwitchCaseAddType,
    builderSwitchDefaultAddType,
    showProcessorJson,
  } = useFcomBuilderViewContext();
  const {
    openAdvancedFlowModal,
    setProcessorStep,
    handleBuilderSelect,
    setBuilderProcessorConfig,
    setBuilderNestedAddType,
    setBuilderSwitchCaseAddType,
    setBuilderSwitchDefaultAddType,
    createFlowNodeFromPaletteValue,
    renderProcessorHelp,
    renderProcessorConfigFields,
    renderFlowList,
    getProcessorCatalogLabel,
    getProcessorSummaryLines,
    setShowProcessorJson,
    applyProcessor,
    nextSwitchCaseId,
  } = useFcomBuilderActionsContext();

  const {
    toArray,
    renderPaletteOptions,
    onAddForeachProcessor,
    renderForeachFlow,
    onUpdateCaseMatch,
    onUpdateCaseOperator,
    onAddCaseProcessor,
    onRemoveCase,
    onAddCase,
    onAddDefaultProcessor,
    renderCaseFlow,
    renderDefaultFlow,
  } = useProcessorConfigure({
    builderProcessorConfig,
    setBuilderProcessorConfig,
    builderPaletteItems,
    builderNestedAddType,
    builderSwitchCaseAddType,
    setBuilderSwitchCaseAddType,
    builderSwitchDefaultAddType,
    createFlowNodeFromPaletteValue,
    nextSwitchCaseId,
    renderFlowList,
  });

  return (
    <div className="builder-section processor-builder">
      <div className="builder-section-title-row">
        <div className="builder-section-title">
          {builderPatchMode ? 'V3 Patch Builder' : 'Processor Builder'}
        </div>
        <button
          type="button"
          className="builder-link"
          onClick={() => {
            openAdvancedFlowModal(
              'object',
              undefined,
              builderTarget ? `$.event.${builderTarget.field}` : null,
            );
          }}
        >
          Advanced Flow
        </button>
      </div>
      {!isBuilderTargetReady && <div className="builder-hint">Select a field in Edit mode.</div>}
      {isBuilderTargetReady && (
        <>
          {builderPatchMode && (
            <div className="builder-hint">
              Editing a v3 patch. The value below is the processor payload.
            </div>
          )}
          <FcomProcessorStepNav
            processorStep={processorStep}
            setProcessorStep={setProcessorStep}
            processorType={processorType}
            builderPatchMode={builderPatchMode}
            builderPatchPreview={builderPatchPreview}
            processorPayload={processorPayload}
          />
          {processorStep === 'select' && (
            <FcomProcessorSelectStep
              processorCatalog={processorCatalog}
              processorType={processorType}
              handleBuilderSelect={handleBuilderSelect}
              renderProcessorHelp={renderProcessorHelp}
            />
          )}
          {processorStep === 'configure' && (
            <div className="processor-form">
              <div className="builder-section-title">
                Processor: {processorType ? getProcessorCatalogLabel(processorType) : '—'}
              </div>
              {!processorType && (
                <div className="builder-hint">Select a processor to configure.</div>
              )}
              {processorType && (
                <>
                  {renderProcessorConfigFields(
                    processorType,
                    builderProcessorConfig,
                    (key, value) =>
                      setBuilderProcessorConfig((prev) => ({
                        ...prev,
                        [key]: value,
                      })),
                    'builder',
                  )}
                  {processorType === 'foreach' && (
                    <FcomProcessorForeachEditor
                      builderNestedAddType={builderNestedAddType}
                      setBuilderNestedAddType={setBuilderNestedAddType}
                      renderPaletteOptions={renderPaletteOptions}
                      onAddProcessor={onAddForeachProcessor}
                      processorsFlow={renderForeachFlow}
                    />
                  )}
                  {processorType === 'switch' && (
                    <FcomProcessorSwitchEditor
                      cases={toArray(builderProcessorConfig.cases)}
                      builderNestedAddType={builderNestedAddType}
                      builderSwitchCaseAddType={builderSwitchCaseAddType}
                      setBuilderSwitchCaseAddType={setBuilderSwitchCaseAddType}
                      builderSwitchDefaultAddType={builderSwitchDefaultAddType}
                      setBuilderSwitchDefaultAddType={setBuilderSwitchDefaultAddType}
                      renderPaletteOptions={renderPaletteOptions}
                      onUpdateCaseMatch={onUpdateCaseMatch}
                      onUpdateCaseOperator={onUpdateCaseOperator}
                      onAddCaseProcessor={onAddCaseProcessor}
                      onRemoveCase={onRemoveCase}
                      onAddCase={onAddCase}
                      onAddDefaultProcessor={onAddDefaultProcessor}
                      renderCaseFlow={renderCaseFlow}
                      renderDefaultFlow={renderDefaultFlow}
                    />
                  )}
                  <div className="processor-actions">
                    <button
                      type="button"
                      className="builder-card"
                      onClick={() => setProcessorStep('review')}
                    >
                      Next: Review/Save
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {processorStep === 'review' && (
            <FcomProcessorReviewStep
              builderPatchMode={builderPatchMode}
              builderPatchPreview={builderPatchPreview}
              processorPayload={processorPayload}
              showProcessorJson={showProcessorJson}
              setShowProcessorJson={setShowProcessorJson}
              getProcessorSummaryLines={getProcessorSummaryLines}
              setProcessorStep={setProcessorStep}
              applyProcessor={applyProcessor}
            />
          )}
        </>
      )}
    </div>
  );
}
