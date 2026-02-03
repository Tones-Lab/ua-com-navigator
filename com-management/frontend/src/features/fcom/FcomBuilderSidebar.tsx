import type { Dispatch, ReactNode, SetStateAction } from 'react';

type FcomBuilderSidebarProps = {
  isAnyPanelEditing: boolean;
  builderOpen: boolean;
  builderTarget: { panelKey: string; field: string } | null;
  builderDirty: boolean;
  canUndoBuilder: boolean;
  canRedoBuilder: boolean;
  handleBuilderUndo: () => void;
  handleBuilderRedo: () => void;
  setShowBuilderHelpModal: (open: boolean) => void;
  requestCancelBuilder: () => void;
  setBuilderOpen: Dispatch<SetStateAction<boolean>>;
  builderFocus: 'literal' | 'eval' | 'processor' | null;
  isBuilderTargetReady: boolean;
  builderTypeLocked: 'literal' | 'eval' | 'processor' | null;
  setBuilderSwitchModal: (value: { open: boolean; from: string; to: string }) => void;
  applyBuilderTypeSwitch: (type: 'literal' | 'eval' | 'processor') => void;
  builderLiteralText: string;
  handleLiteralInputChange: (value: string, caret: number | null, inputType?: string) => void;
  literalDirty: boolean;
  applyLiteralValue: () => void;
  builderMode: 'friendly' | 'regular';
  setBuilderMode: (mode: 'friendly' | 'regular') => void;
  hasEditPermission: boolean;
  setAdvancedProcessorScope: (scope: 'object' | 'global') => void;
  setShowAdvancedProcessorModal: (open: boolean) => void;
  builderConditions: Array<{ id: string; condition: any; result: string }>;
  setBuilderConditions: Dispatch<SetStateAction<Array<{ id: string; condition: any; result: string }>>>;
  updateBuilderCondition: (rowId: string, conditionId: string, key: string, value: string) => void;
  updateBuilderResult: (rowId: string, value: string) => void;
  removeBuilderRow: (rowId: string) => void;
  addBuilderRow: () => void;
  createConditionNode: () => any;
  createGroupNode: () => any;
  nextBuilderId: () => string;
  renderConditionNode: (rowId: string, condition: any, depth: number, isNested: boolean, groupCount: number) => ReactNode;
  builderElseResult: string;
  setBuilderElseResult: (value: string) => void;
  friendlyPreview: string;
  applyFriendlyEval: () => void;
  formatEvalReadableList: (value: string) => string[];
  builderRegularText: string;
  handleRegularEvalInputChange: (value: string, caret: number | null, inputType?: string) => void;
  clearRegularEval: () => void;
  applyRegularEval: () => void;
  applyBuilderTemplate: (template: string) => void;
  openAdvancedFlowModal: (scope: 'object' | 'global', objectName?: string | null, field?: string | null) => void;
  processorStep: 'select' | 'configure' | 'review';
  setProcessorStep: (step: 'select' | 'configure' | 'review') => void;
  processorType: string | null;
  processorPayload: any;
  processorCatalog: any[];
  handleBuilderSelect: (item: any, isEnabled: boolean) => void;
  builderProcessorConfig: any;
  setBuilderProcessorConfig: Dispatch<SetStateAction<any>>;
  builderNestedAddType: string;
  setBuilderNestedAddType: (value: string) => void;
  builderPaletteItems: any[];
  builderSwitchCaseAddType: Record<string, string>;
  setBuilderSwitchCaseAddType: Dispatch<SetStateAction<Record<string, string>>>;
  builderSwitchDefaultAddType: string;
  setBuilderSwitchDefaultAddType: (value: string) => void;
  createFlowNodeFromPaletteValue: (value: string) => any;
  renderProcessorHelp: (helpKey: string) => ReactNode;
  renderProcessorConfigFields: (
    processorType: string,
    config: any,
    onChange: (key: string, value: any) => void,
    context: string,
  ) => ReactNode;
  renderFlowList: (
    items: any[],
    context: { kind: string },
    onChange: (updater: any) => void,
    scope: string,
    parentScope: string,
  ) => ReactNode;
  getProcessorCatalogLabel: (processorType: string) => string;
  getProcessorSummaryLines: (payload: any) => string[];
  showProcessorJson: boolean;
  setShowProcessorJson: Dispatch<SetStateAction<boolean>>;
  applyProcessor: () => void;
  nextSwitchCaseId: () => string;
};

export default function FcomBuilderSidebar({
  isAnyPanelEditing,
  builderOpen,
  builderTarget,
  builderDirty,
  canUndoBuilder,
  canRedoBuilder,
  handleBuilderUndo,
  handleBuilderRedo,
  setShowBuilderHelpModal,
  requestCancelBuilder,
  setBuilderOpen,
  builderFocus,
  isBuilderTargetReady,
  builderTypeLocked,
  setBuilderSwitchModal,
  applyBuilderTypeSwitch,
  builderLiteralText,
  handleLiteralInputChange,
  literalDirty,
  applyLiteralValue,
  builderMode,
  setBuilderMode,
  hasEditPermission,
  setAdvancedProcessorScope,
  setShowAdvancedProcessorModal,
  builderConditions,
  setBuilderConditions,
  updateBuilderCondition,
  updateBuilderResult,
  removeBuilderRow,
  addBuilderRow,
  createConditionNode,
  createGroupNode,
  nextBuilderId,
  renderConditionNode,
  builderElseResult,
  setBuilderElseResult,
  friendlyPreview,
  applyFriendlyEval,
  formatEvalReadableList,
  builderRegularText,
  handleRegularEvalInputChange,
  clearRegularEval,
  applyRegularEval,
  applyBuilderTemplate,
  openAdvancedFlowModal,
  processorStep,
  setProcessorStep,
  processorType,
  processorPayload,
  processorCatalog,
  handleBuilderSelect,
  builderProcessorConfig,
  setBuilderProcessorConfig,
  builderNestedAddType,
  setBuilderNestedAddType,
  builderPaletteItems,
  builderSwitchCaseAddType,
  setBuilderSwitchCaseAddType,
  builderSwitchDefaultAddType,
  setBuilderSwitchDefaultAddType,
  createFlowNodeFromPaletteValue,
  renderProcessorHelp,
  renderProcessorConfigFields,
  renderFlowList,
  getProcessorCatalogLabel,
  getProcessorSummaryLines,
  showProcessorJson,
  setShowProcessorJson,
  applyProcessor,
  nextSwitchCaseId,
}: FcomBuilderSidebarProps) {
  if (!isAnyPanelEditing) {
    return null;
  }

  return (
    <aside className={`builder-sidebar${builderOpen ? '' : ' builder-sidebar-collapsed'}`}>
      <div className="builder-header">
        <div>
          <h3>Builder</h3>
          <div className="builder-target">
            {builderTarget ? (
              <div className="builder-target-row">
                <span className="builder-target-badge">
                  Editing: {builderTarget.field}
                </span>
                {builderDirty && (
                  <span className="pill unsaved-pill">Unsaved</span>
                )}
              </div>
            ) : (
              <span className="builder-target-empty">Select a field to begin</span>
            )}
          </div>
        </div>
        <div className="builder-header-actions">
          {(canUndoBuilder || canRedoBuilder) && (
            <div className="builder-history-actions">
              <button
                type="button"
                className="builder-link"
                onClick={handleBuilderUndo}
                disabled={!canUndoBuilder}
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                type="button"
                className="builder-link"
                onClick={handleBuilderRedo}
                disabled={!canRedoBuilder}
                title="Redo (Ctrl+Shift+Z)"
              >
                Redo
              </button>
            </div>
          )}
          {builderOpen && (
            <button
              type="button"
              className="builder-help-button"
              onClick={() => setShowBuilderHelpModal(true)}
            >
              Help
            </button>
          )}
          {builderTarget && (
            <button
              type="button"
              className="builder-cancel-button"
              onClick={requestCancelBuilder}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="builder-toggle"
            onClick={() => setBuilderOpen((prev) => !prev)}
          >
            {builderOpen ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {builderOpen && (
        <div className="builder-body">
          <div className="builder-section">
            <div className="builder-section-title">
              Builder Type{builderFocus ? '' : ' (Select one)'}
            </div>
            {!isBuilderTargetReady && (
              <div className="builder-hint">Select a field in Edit mode.</div>
            )}
            {isBuilderTargetReady && !builderFocus && (
              <div className="builder-hint">Choose Eval or Processor to continue.</div>
            )}
            {isBuilderTargetReady && builderTarget && (
              <div className="builder-lock-note">
                Other fields are locked while this builder is active.
              </div>
            )}
            <div className="builder-focus-row">
              <button
                type="button"
                className={builderFocus === 'literal'
                  ? 'builder-card builder-card-selected'
                  : 'builder-card'}
                disabled={!isBuilderTargetReady || builderTypeLocked === 'literal'}
                onClick={() => {
                  if (builderTypeLocked && builderTypeLocked !== 'literal') {
                    setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'literal' });
                    return;
                  }
                  applyBuilderTypeSwitch('literal');
                }}
              >
                Literal
              </button>
              <button
                type="button"
                className={builderFocus === 'eval'
                  ? 'builder-card builder-card-selected'
                  : 'builder-card'}
                disabled={!isBuilderTargetReady || builderTypeLocked === 'eval'}
                onClick={() => {
                  if (builderTypeLocked && builderTypeLocked !== 'eval') {
                    setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'eval' });
                    return;
                  }
                  applyBuilderTypeSwitch('eval');
                }}
              >
                Eval
              </button>
              <button
                type="button"
                className={builderFocus === 'processor'
                  ? 'builder-card builder-card-selected'
                  : 'builder-card'}
                disabled={!isBuilderTargetReady || builderTypeLocked === 'processor'}
                onClick={() => {
                  if (builderTypeLocked && builderTypeLocked !== 'processor') {
                    setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'processor' });
                    return;
                  }
                  applyBuilderTypeSwitch('processor');
                }}
              >
                Processor
              </button>
            </div>
          </div>
          {builderFocus === 'literal' && (
            <div className="builder-section">
              <div className="builder-section-title">Literal Editor</div>
              <div className="builder-regular-input">
                <textarea
                  className="builder-textarea"
                  placeholder="Enter literal value"
                  value={builderLiteralText}
                  onChange={(e) => handleLiteralInputChange(
                    e.target.value,
                    e.target.selectionStart,
                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                  )}
                  disabled={!isBuilderTargetReady}
                />
              </div>
              <div className="builder-regular-actions">
                <button
                  type="button"
                  className="builder-card builder-card-primary"
                  disabled={!isBuilderTargetReady || !literalDirty}
                  onClick={applyLiteralValue}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
          {builderFocus === 'eval' && (
            <div className="builder-section">
              <div className="builder-section-title">Eval Builder</div>
              <div className="builder-mode-row">
                <div className="builder-mode-toggle">
                  <button
                    type="button"
                    className={builderMode === 'friendly'
                      ? 'builder-mode-button builder-mode-button-active'
                      : 'builder-mode-button'}
                    onClick={() => setBuilderMode('friendly')}
                  >
                    Friendly
                  </button>
                  <button
                    type="button"
                    className={builderMode === 'regular'
                      ? 'builder-mode-button builder-mode-button-active'
                      : 'builder-mode-button'}
                    onClick={() => setBuilderMode('regular')}
                  >
                    Regular
                  </button>
                </div>
                <button
                  type="button"
                  className="builder-link"
                  onClick={() => {
                    if (!hasEditPermission) {
                      return;
                    }
                    setAdvancedProcessorScope('object');
                    setShowAdvancedProcessorModal(true);
                  }}
                  disabled={!hasEditPermission}
                >
                  Advanced Processors
                </button>
              </div>
              {builderMode === 'friendly' ? (
                <div className="builder-friendly">
                  <div className="builder-friendly-rows">
                    {builderConditions.map((row) => (
                      <div className="builder-condition-block" key={row.id}>
                        {row.condition.type === 'condition' ? (
                          <>
                            <div className="builder-friendly-row">
                              <input
                                className="builder-input"
                                value={row.condition.left}
                                onChange={(e) => updateBuilderCondition(
                                  row.id,
                                  row.condition.id,
                                  'left',
                                  e.target.value,
                                )}
                                placeholder="$v1"
                                disabled={!isBuilderTargetReady}
                                title={row.condition.left}
                              />
                              <select
                                className="builder-select"
                                value={row.condition.operator}
                                onChange={(e) => updateBuilderCondition(
                                  row.id,
                                  row.condition.id,
                                  'operator',
                                  e.target.value,
                                )}
                                disabled={!isBuilderTargetReady}
                              >
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<">&lt;</option>
                                <option value="<=">&lt;=</option>
                              </select>
                              <input
                                className="builder-input"
                                value={row.condition.right}
                                onChange={(e) => updateBuilderCondition(
                                  row.id,
                                  row.condition.id,
                                  'right',
                                  e.target.value,
                                )}
                                placeholder="1"
                                disabled={!isBuilderTargetReady}
                                title={row.condition.right}
                              />
                              <span className="builder-friendly-arrow">→</span>
                              <input
                                className="builder-input builder-input-result"
                                value={row.result}
                                onChange={(e) => updateBuilderResult(row.id, e.target.value)}
                                placeholder="result"
                                disabled={!isBuilderTargetReady}
                                title={row.result}
                              />
                              <button
                                type="button"
                                className="builder-remove"
                                onClick={() => removeBuilderRow(row.id)}
                                disabled={!isBuilderTargetReady || builderConditions.length === 1}
                                aria-label="Remove condition"
                              >
                                ×
                              </button>
                            </div>
                            <div className="builder-group-actions">
                              <button
                                type="button"
                                className="builder-link"
                                onClick={() => {
                                  const newChild = createConditionNode();
                                  setBuilderConditions((prev) => prev.map((item) => (
                                    item.id === row.id
                                      ? {
                                        ...item,
                                        condition: {
                                          id: nextBuilderId(),
                                          type: 'group',
                                          operator: 'AND',
                                          children: [item.condition, newChild],
                                        },
                                      }
                                      : item
                                  )));
                                }}
                                disabled={!isBuilderTargetReady}
                              >
                                Add condition
                              </button>
                              <button
                                type="button"
                                className="builder-link"
                                onClick={() => {
                                  const newGroup = createGroupNode();
                                  setBuilderConditions((prev) => prev.map((item) => (
                                    item.id === row.id
                                      ? {
                                        ...item,
                                        condition: {
                                          id: nextBuilderId(),
                                          type: 'group',
                                          operator: 'AND',
                                          children: [item.condition, newGroup],
                                        },
                                      }
                                      : item
                                  )));
                                }}
                                disabled={!isBuilderTargetReady}
                              >
                                Add group
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="builder-group-row">
                            {renderConditionNode(row.id, row.condition, 0, false, 1)}
                            <div className="builder-group-result">
                              <span className="builder-friendly-arrow">→</span>
                              <input
                                className="builder-input builder-input-result"
                                value={row.result}
                                onChange={(e) => updateBuilderResult(row.id, e.target.value)}
                                placeholder="result"
                                disabled={!isBuilderTargetReady}
                                title={row.result}
                              />
                              <button
                                type="button"
                                className="builder-remove"
                                onClick={() => removeBuilderRow(row.id)}
                                disabled={!isBuilderTargetReady || builderConditions.length === 1}
                                aria-label="Remove condition"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="builder-link"
                    onClick={addBuilderRow}
                    disabled={!isBuilderTargetReady}
                  >
                    Add condition
                  </button>
                  <div className="builder-friendly-else">
                    <span className="builder-friendly-label">Else</span>
                    <input
                      className="builder-input"
                      value={builderElseResult}
                      onChange={(e) => setBuilderElseResult(e.target.value)}
                      placeholder="0"
                      disabled={!isBuilderTargetReady}
                    />
                  </div>
                  <div className="builder-friendly-actions">
                    <button
                      type="button"
                      className="builder-card builder-card-primary"
                      disabled={!isBuilderTargetReady || !friendlyPreview}
                      onClick={applyFriendlyEval}
                    >
                      Apply
                    </button>
                  </div>
                  {isBuilderTargetReady && !friendlyPreview && (
                    <div className="builder-hint builder-hint-warning">
                      Complete each condition and the Else value to enable Apply.
                    </div>
                  )}
                  <div className="builder-preview">
                    <div className="builder-preview-label">Preview</div>
                    <div className="builder-preview-value">
                      {friendlyPreview || '—'}
                    </div>
                    {friendlyPreview && (
                      <details className="builder-preview-details">
                        <summary>Expanded view</summary>
                        <div className="builder-preview-lines">
                          {formatEvalReadableList(friendlyPreview).map((line, idx) => (
                            <span key={`${line}-${idx}`}>{line}</span>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ) : (
                <div className="builder-regular">
                  <div className="builder-regular-input">
                    <textarea
                      className="builder-textarea"
                      placeholder="Enter raw eval expression"
                      value={builderRegularText}
                      onChange={(e) => handleRegularEvalInputChange(
                        e.target.value,
                        e.target.selectionStart,
                        (e.nativeEvent as InputEvent | undefined)?.inputType,
                      )}
                      disabled={!isBuilderTargetReady}
                    />
                    {builderRegularText && (
                      <button
                        type="button"
                        className="builder-clear"
                        onClick={clearRegularEval}
                        aria-label="Clear eval"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="builder-regular-actions">
                    <button
                      type="button"
                      className="builder-card builder-card-primary"
                      disabled={!isBuilderTargetReady || !builderRegularText.trim()}
                      onClick={applyRegularEval}
                    >
                      Apply
                    </button>
                  </div>
                  {isBuilderTargetReady && !builderRegularText.trim() && (
                    <div className="builder-hint builder-hint-warning">
                      Enter an expression to enable Apply.
                    </div>
                  )}
                  <div className="builder-regular-templates">
                    <div className="builder-example-title">Templates</div>
                    <button
                      type="button"
                      className="builder-card"
                      disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                      onClick={() => applyBuilderTemplate('($v1==1) ? 1 : 0')}
                    >
                      Ternary (if/else)
                    </button>
                    <button
                      type="button"
                      className="builder-card"
                      disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                      onClick={() => applyBuilderTemplate('($v1==1) ? 1 : (($v1==2) ? 2 : 0)')}
                    >
                      Else-if chain
                    </button>
                    <button
                      type="button"
                      className="builder-card"
                      disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                      onClick={() => applyBuilderTemplate('$v1')}
                    >
                      Variable ($vN)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {builderFocus === 'processor' && (
            <div className="builder-section processor-builder">
              <div className="builder-section-title-row">
                <div className="builder-section-title">Processor Builder</div>
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
              {!isBuilderTargetReady && (
                <div className="builder-hint">Select a field in Edit mode.</div>
              )}
              {isBuilderTargetReady && (
                <>
                  <div className="processor-steps">
                    {[
                      { key: 'select', label: 'Select' },
                      { key: 'configure', label: 'Configure' },
                      { key: 'review', label: 'Review/Save' },
                    ].map((stepItem, index) => {
                      const isActive = processorStep === stepItem.key;
                      const isConfigureReady = Boolean(processorType);
                      const isReviewReady = Boolean(processorPayload);
                      const isEnabled = stepItem.key === 'select'
                        || (stepItem.key === 'configure' && isConfigureReady)
                        || (stepItem.key === 'review' && isReviewReady);
                      const isComplete = stepItem.key === 'select'
                        ? isConfigureReady
                        : stepItem.key === 'configure'
                          ? isReviewReady
                          : false;
                      const title = stepItem.key === 'configure' && !isConfigureReady
                        ? 'Select a processor to enable.'
                        : stepItem.key === 'review' && !isReviewReady
                          ? 'Complete configuration to enable.'
                          : '';
                      return (
                        <button
                          key={stepItem.key}
                          type="button"
                          className={`processor-step${isActive ? ' processor-step-active' : ''}${isComplete ? ' processor-step-complete' : ''}`}
                          disabled={!isEnabled}
                          title={title}
                          onClick={() => {
                            if (!isEnabled) {
                              return;
                            }
                            setProcessorStep(stepItem.key as 'select' | 'configure' | 'review');
                          }}
                        >
                          <span className="processor-step-index">
                            {isComplete ? '✓' : index + 1}
                          </span>
                          {stepItem.label}
                        </button>
                      );
                    })}
                  </div>
                  {processorStep === 'select' && (
                    <div className="processor-grid">
                      {processorCatalog.map((item) => {
                        const isSelected = processorType === item.id;
                        const isEnabled = item.status !== 'planned';
                        const buttonLabel = item.paletteLabel || item.label;
                        return (
                          <div key={item.id} className="processor-card">
                            <button
                              type="button"
                              className={isSelected
                                ? 'builder-card builder-card-selected'
                                : 'builder-card'}
                              onClick={() => handleBuilderSelect(item, isEnabled)}
                              disabled={!isEnabled}
                            >
                              {buttonLabel}
                            </button>
                            {renderProcessorHelp(item.helpKey)}
                          </div>
                        );
                      })}
                    </div>
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
                            (key, value) => setBuilderProcessorConfig((prev: any) => ({
                              ...prev,
                              [key]: value,
                            })),
                            'builder',
                          )}
                          {processorType === 'foreach' && (
                            <div className="processor-row">
                              <label className="builder-label">Per-item processors</label>
                              <div className="builder-hint">
                                Add processors to run for each item.
                              </div>
                              <div className="builder-inline-actions">
                                <select
                                  className="builder-select"
                                  value={builderNestedAddType}
                                  onChange={(e) => setBuilderNestedAddType(e.target.value)}
                                >
                                  {builderPaletteItems.map((item) => (
                                    <option
                                      key={`${item.nodeKind}-${item.processorType || 'if'}`}
                                      value={item.nodeKind === 'if' ? 'if' : (item.processorType as string)}
                                    >
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="builder-card"
                                  onClick={() => {
                                    const node = createFlowNodeFromPaletteValue(builderNestedAddType);
                                    setBuilderProcessorConfig((prev: any) => {
                                      const current = Array.isArray(prev.processors)
                                        ? prev.processors
                                        : [];
                                      return {
                                        ...prev,
                                        processors: [...current, node],
                                      };
                                    });
                                  }}
                                >
                                  Add processor
                                </button>
                              </div>
                              {renderFlowList(
                                Array.isArray(builderProcessorConfig.processors)
                                  ? (builderProcessorConfig.processors as any[])
                                  : [],
                                { kind: 'root' },
                                (updater) => {
                                  setBuilderProcessorConfig((prev: any) => {
                                    const current = Array.isArray(prev.processors)
                                      ? prev.processors
                                      : [];
                                    const next = typeof updater === 'function'
                                      ? (updater as (items: any[]) => any[])(current)
                                      : updater;
                                    return {
                                      ...prev,
                                      processors: next,
                                    };
                                  });
                                },
                                'object',
                                'object',
                              )}
                            </div>
                          )}
                          {processorType === 'switch' && (
                            <div className="processor-row">
                              <label className="builder-label">Cases</label>
                              <div className="flow-switch-cases">
                                {(Array.isArray(builderProcessorConfig.cases)
                                  ? builderProcessorConfig.cases
                                  : []).map((item: any) => (
                                    <div key={item.id} className="flow-switch-case">
                                      <div className="flow-switch-case-row">
                                        <label className="builder-label">Match</label>
                                        <input
                                          className="builder-input"
                                          value={item.match ?? ''}
                                          onChange={(e) => setBuilderProcessorConfig((prev: any) => {
                                            const cases = Array.isArray(prev.cases)
                                              ? prev.cases
                                              : [];
                                            return {
                                              ...prev,
                                              cases: cases.map((entry: any) => (
                                                entry.id === item.id
                                                  ? { ...entry, match: e.target.value }
                                                  : entry
                                              )),
                                            };
                                          })}
                                        />
                                      </div>
                                      <div className="flow-switch-case-row">
                                        <label className="builder-label">Operator (optional)</label>
                                        <input
                                          className="builder-input"
                                          value={item.operator ?? ''}
                                          onChange={(e) => setBuilderProcessorConfig((prev: any) => {
                                            const cases = Array.isArray(prev.cases)
                                              ? prev.cases
                                              : [];
                                            return {
                                              ...prev,
                                              cases: cases.map((entry: any) => (
                                                entry.id === item.id
                                                  ? { ...entry, operator: e.target.value }
                                                  : entry
                                              )),
                                            };
                                          })}
                                        />
                                      </div>
                                      <div className="flow-switch-case-row">
                                        <label className="builder-label">Processors</label>
                                        <div className="builder-inline-actions">
                                          <select
                                            className="builder-select"
                                            value={builderSwitchCaseAddType[item.id] || builderNestedAddType}
                                            onChange={(e) => setBuilderSwitchCaseAddType((prev) => ({
                                              ...prev,
                                              [item.id]: e.target.value,
                                            }))}
                                          >
                                            {builderPaletteItems.map((paletteItem) => (
                                              <option
                                                key={`${paletteItem.nodeKind}-${paletteItem.processorType || 'if'}`}
                                                value={paletteItem.nodeKind === 'if'
                                                  ? 'if'
                                                  : (paletteItem.processorType as string)}
                                              >
                                                {paletteItem.label}
                                              </option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            className="builder-card"
                                            onClick={() => {
                                              const choice = builderSwitchCaseAddType[item.id] || builderNestedAddType;
                                              const node = createFlowNodeFromPaletteValue(choice);
                                              setBuilderProcessorConfig((prev: any) => {
                                                const cases = Array.isArray(prev.cases)
                                                  ? prev.cases
                                                  : [];
                                                return {
                                                  ...prev,
                                                  cases: cases.map((entry: any) => (
                                                    entry.id === item.id
                                                      ? {
                                                        ...entry,
                                                        processors: [
                                                          ...(Array.isArray(entry.processors) ? entry.processors : []),
                                                          node,
                                                        ],
                                                      }
                                                      : entry
                                                  )),
                                                };
                                              });
                                            }}
                                          >
                                            Add processor
                                          </button>
                                        </div>
                                        {renderFlowList(
                                          Array.isArray(item.processors) ? item.processors : [],
                                          { kind: 'root' },
                                          (updater) => {
                                            setBuilderProcessorConfig((prev: any) => {
                                              const cases = Array.isArray(prev.cases)
                                                ? prev.cases
                                                : [];
                                              return {
                                                ...prev,
                                                cases: cases.map((entry: any) => {
                                                  if (entry.id !== item.id) {
                                                    return entry;
                                                  }
                                                  const current = Array.isArray(entry.processors)
                                                    ? entry.processors
                                                    : [];
                                                  const next = typeof updater === 'function'
                                                    ? (updater as (items: any[]) => any[])(current)
                                                    : updater;
                                                  return {
                                                    ...entry,
                                                    processors: next,
                                                  };
                                                }),
                                              };
                                            });
                                          },
                                          'object',
                                          'object',
                                        )}
                                      </div>
                                      <div className="flow-switch-case-row">
                                        <button
                                          type="button"
                                          className="builder-link"
                                          onClick={() => {
                                            setBuilderProcessorConfig((prev: any) => {
                                              const cases = Array.isArray(prev.cases)
                                                ? prev.cases
                                                : [];
                                              return {
                                                ...prev,
                                                cases: cases.filter((entry: any) => entry.id !== item.id),
                                              };
                                            });
                                            setBuilderSwitchCaseAddType((prev) => {
                                              const next = { ...prev };
                                              delete next[item.id];
                                              return next;
                                            });
                                          }}
                                        >
                                          Remove case
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                <button
                                  type="button"
                                  className="builder-link"
                                  onClick={() => setBuilderProcessorConfig((prev: any) => {
                                    const cases = Array.isArray(prev.cases)
                                      ? prev.cases
                                      : [];
                                    return {
                                      ...prev,
                                      cases: [
                                        ...cases,
                                        {
                                          id: nextSwitchCaseId(),
                                          match: '',
                                          operator: '',
                                          processors: [],
                                        },
                                      ],
                                    };
                                  })}
                                >
                                  Add case
                                </button>
                              </div>
                              <div className="builder-hint">
                                Drag processors to reorder cases or nested processors.
                              </div>
                              <label className="builder-label">Default processors</label>
                              <div className="builder-inline-actions">
                                <select
                                  className="builder-select"
                                  value={builderSwitchDefaultAddType}
                                  onChange={(e) => setBuilderSwitchDefaultAddType(e.target.value)}
                                >
                                  {builderPaletteItems.map((paletteItem) => (
                                    <option
                                      key={`${paletteItem.nodeKind}-${paletteItem.processorType || 'if'}`}
                                      value={paletteItem.nodeKind === 'if'
                                        ? 'if'
                                        : (paletteItem.processorType as string)}
                                    >
                                      {paletteItem.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="builder-card"
                                  onClick={() => {
                                    const node = createFlowNodeFromPaletteValue(builderSwitchDefaultAddType);
                                    setBuilderProcessorConfig((prev: any) => {
                                      const current = Array.isArray(prev.defaultProcessors)
                                        ? prev.defaultProcessors
                                        : [];
                                      return {
                                        ...prev,
                                        defaultProcessors: [...current, node],
                                      };
                                    });
                                  }}
                                >
                                  Add processor
                                </button>
                              </div>
                              {renderFlowList(
                                Array.isArray(builderProcessorConfig.defaultProcessors)
                                  ? (builderProcessorConfig.defaultProcessors as any[])
                                  : [],
                                { kind: 'root' },
                                (updater) => {
                                  setBuilderProcessorConfig((prev: any) => {
                                    const current = Array.isArray(prev.defaultProcessors)
                                      ? prev.defaultProcessors
                                      : [];
                                    const next = typeof updater === 'function'
                                      ? (updater as (items: any[]) => any[])(current)
                                      : updater;
                                    return {
                                      ...prev,
                                      defaultProcessors: next,
                                    };
                                  });
                                },
                                'object',
                                'object',
                              )}
                            </div>
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
                    <div className="processor-review">
                      <div className="builder-preview">
                        <div className="builder-preview-header">
                          <div className="builder-preview-label">Preview</div>
                          <button
                            type="button"
                            className="builder-link"
                            onClick={() => setShowProcessorJson((prev) => !prev)}
                          >
                            {showProcessorJson ? 'Hide JSON' : 'Show JSON'}
                          </button>
                        </div>
                        <div className="builder-preview-lines">
                          {(getProcessorSummaryLines(processorPayload) || []).map((line, idx) => (
                            <span key={`${line}-${idx}`}>{line}</span>
                          ))}
                        </div>
                        {showProcessorJson && (
                          <pre className="code-block">
                            {JSON.stringify(processorPayload, null, 2) || '—'}
                          </pre>
                        )}
                      </div>
                      <div className="processor-review-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setProcessorStep('configure')}
                        >
                          Back to Configure
                        </button>
                        <button
                          type="button"
                          className="builder-card builder-card-primary"
                          onClick={applyProcessor}
                          disabled={!processorPayload}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
