import { useFcomBuilderContext } from './FcomBuilderContext';
import type { ProcessorStep } from './types';

export default function FcomBuilderProcessorSection() {
  const {
    builderPatchMode,
    builderPatchPreview,
    isBuilderTargetReady,
    builderTarget,
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
  } = useFcomBuilderContext();
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
          <div className="builder-steps">
            {[
              { key: 'select', label: 'Select' },
              { key: 'configure', label: 'Configure' },
              { key: 'review', label: 'Review/Save' },
            ].map((stepItem, index) => {
              const isActive = processorStep === stepItem.key;
              const isConfigureReady = Boolean(processorType);
              const isReviewReady = builderPatchMode
                ? Boolean(builderPatchPreview)
                : Boolean(processorPayload);
              const isEnabled =
                stepItem.key === 'select' ||
                (stepItem.key === 'configure' && isConfigureReady) ||
                (stepItem.key === 'review' && isReviewReady);
              const isComplete =
                stepItem.key === 'select'
                  ? isConfigureReady
                  : stepItem.key === 'configure'
                    ? isReviewReady
                    : false;
              const title =
                stepItem.key === 'configure' && !isConfigureReady
                  ? 'Select a processor to enable.'
                  : stepItem.key === 'review' && !isReviewReady
                    ? 'Complete configuration to enable.'
                    : '';
              return (
                <button
                  key={stepItem.key}
                  type="button"
                  className={`builder-step${isActive ? ' builder-step-active' : ''}${isComplete ? ' builder-step-complete' : ''}`}
                  disabled={!isEnabled}
                  title={title}
                  onClick={() => {
                    if (!isEnabled) {
                      return;
                    }
                    setProcessorStep(stepItem.key as ProcessorStep);
                  }}
                >
                  <span className="builder-step-index">{isComplete ? '✓' : index + 1}</span>
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
                      className={
                        isSelected ? 'builder-card builder-card-selected' : 'builder-card'
                      }
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
                    (key, value) =>
                      setBuilderProcessorConfig((prev: any) => ({
                        ...prev,
                        [key]: value,
                      })),
                    'builder',
                  )}
                  {processorType === 'foreach' && (
                    <div className="processor-row">
                      <label className="builder-label">Per-item processors</label>
                      <div className="builder-hint">Add processors to run for each item.</div>
                      <div className="builder-inline-actions">
                        <select
                          className="builder-select"
                          value={builderNestedAddType}
                          onChange={(e) => setBuilderNestedAddType(e.target.value)}
                        >
                          {builderPaletteItems.map((item) => (
                            <option
                              key={`${item.nodeKind}-${item.processorType || 'if'}`}
                              value={
                                item.nodeKind === 'if' ? 'if' : (item.processorType as string)
                              }
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
                              const current = Array.isArray(prev.processors) ? prev.processors : [];
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
                            const current = Array.isArray(prev.processors) ? prev.processors : [];
                            const next =
                              typeof updater === 'function'
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
                          : []
                        ).map((item: any) => (
                          <div key={item.id} className="flow-switch-case">
                            <div className="flow-switch-case-row">
                              <label className="builder-label">Match</label>
                              <input
                                className="builder-input"
                                value={item.match ?? ''}
                                onChange={(e) =>
                                  setBuilderProcessorConfig((prev: any) => {
                                    const cases = Array.isArray(prev.cases) ? prev.cases : [];
                                    return {
                                      ...prev,
                                      cases: cases.map((entry: any) =>
                                        entry.id === item.id
                                          ? { ...entry, match: e.target.value }
                                          : entry,
                                      ),
                                    };
                                  })
                                }
                              />
                            </div>
                            <div className="flow-switch-case-row">
                              <label className="builder-label">Operator (optional)</label>
                              <input
                                className="builder-input"
                                value={item.operator ?? ''}
                                onChange={(e) =>
                                  setBuilderProcessorConfig((prev: any) => {
                                    const cases = Array.isArray(prev.cases) ? prev.cases : [];
                                    return {
                                      ...prev,
                                      cases: cases.map((entry: any) =>
                                        entry.id === item.id
                                          ? { ...entry, operator: e.target.value }
                                          : entry,
                                      ),
                                    };
                                  })
                                }
                              />
                            </div>
                            <div className="flow-switch-case-row">
                              <label className="builder-label">Processors</label>
                              <div className="builder-inline-actions">
                                <select
                                  className="builder-select"
                                  value={
                                    builderSwitchCaseAddType[item.id] || builderNestedAddType
                                  }
                                  onChange={(e) =>
                                    setBuilderSwitchCaseAddType((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                >
                                  {builderPaletteItems.map((paletteItem) => (
                                    <option
                                      key={`${paletteItem.nodeKind}-${paletteItem.processorType || 'if'}`}
                                      value={
                                        paletteItem.nodeKind === 'if'
                                          ? 'if'
                                          : (paletteItem.processorType as string)
                                      }
                                    >
                                      {paletteItem.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="builder-card"
                                  onClick={() => {
                                    const choice =
                                      builderSwitchCaseAddType[item.id] || builderNestedAddType;
                                    const node = createFlowNodeFromPaletteValue(choice);
                                    setBuilderProcessorConfig((prev: any) => {
                                      const cases = Array.isArray(prev.cases) ? prev.cases : [];
                                      return {
                                        ...prev,
                                        cases: cases.map((entry: any) =>
                                          entry.id === item.id
                                            ? {
                                                ...entry,
                                                processors: [
                                                  ...(Array.isArray(entry.processors)
                                                    ? entry.processors
                                                    : []),
                                                  node,
                                                ],
                                              }
                                            : entry,
                                        ),
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
                                    const cases = Array.isArray(prev.cases) ? prev.cases : [];
                                    return {
                                      ...prev,
                                      cases: cases.map((entry: any) => {
                                        if (entry.id !== item.id) {
                                          return entry;
                                        }
                                        const current = Array.isArray(entry.processors)
                                          ? entry.processors
                                          : [];
                                        const next =
                                          typeof updater === 'function'
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
                                    const cases = Array.isArray(prev.cases) ? prev.cases : [];
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
                          onClick={() =>
                            setBuilderProcessorConfig((prev: any) => {
                              const cases = Array.isArray(prev.cases) ? prev.cases : [];
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
                            })
                          }
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
                              value={
                                paletteItem.nodeKind === 'if'
                                  ? 'if'
                                  : (paletteItem.processorType as string)
                              }
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
                            const next =
                              typeof updater === 'function'
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
                  <div className="builder-preview-label">
                    {builderPatchMode ? 'Patch Preview' : 'Preview'}
                  </div>
                  <button
                    type="button"
                    className="builder-link"
                    onClick={() => setShowProcessorJson((prev) => !prev)}
                  >
                    {showProcessorJson ? 'Hide JSON' : 'Show JSON'}
                  </button>
                </div>
                {!builderPatchMode && (
                  <div className="builder-preview-lines">
                    {(getProcessorSummaryLines(processorPayload) || []).map((line, idx) => (
                      <span key={`${line}-${idx}`}>{line}</span>
                    ))}
                  </div>
                )}
                {showProcessorJson && (
                  <pre className="code-block">
                    {JSON.stringify(
                      builderPatchMode ? builderPatchPreview : processorPayload,
                      null,
                      2,
                    ) || '—'}
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
  );
}
