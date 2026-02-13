import React from 'react';
import { processorHelp } from './processorHelp';
import { processorConfigSpecs } from './processorConfig';
import type { FlowBranchPath, FlowIfNode, FlowNode, FlowProcessorNode } from './flowUtils';

type FlowEditorState = {
  scope: 'object' | 'global';
  lane: 'object' | 'pre' | 'post';
  nodeId: string;
  setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>;
};

type FlowNodeErrorMap = Record<string, string[]>;

type FcomFlowEditorModalProps = {
  flowEditor: FlowEditorState | null;
  flowEditorDraft: FlowNode | null;
  flowEditorModalRef: React.RefObject<HTMLDivElement>;
  getModalOverlayStyle: (key: string, order: number) => React.CSSProperties | undefined;
  getFlowNodeLabel: (node: FlowNode) => string;
  onShowFieldReference: () => void;
  applyFlowEditorExample: () => void;
  renderProcessorConfigFields: (
    processorType: string,
    config: Record<string, any>,
    onConfigChange: (key: string, value: string | boolean) => void,
    context: 'flow' | 'builder',
    fieldErrors?: Record<string, string[]>,
  ) => React.ReactNode;
  flowEditorFieldErrors: Record<string, string[]>;
  handleFlowEditorInputChange: (
    fieldKey:
      | 'flowEditor.source'
      | 'flowEditor.targetField'
      | 'flowEditor.pattern'
      | 'flowEditor.condition.property'
      | 'flowEditor.condition.value',
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => void;
  setFlowEditorDraft: React.Dispatch<React.SetStateAction<FlowNode | null>>;
  renderFlowList: (
    nodes: FlowNode[],
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
    flowErrors: FlowNodeErrorMap,
    versionInfo?: {
      mode: 'none' | 'v2' | 'v3' | 'mixed';
      label: string;
      detail: string;
    } | null,
  ) => React.ReactNode;
  validateFlowNodes: (nodes: FlowNode[], lane: 'object' | 'pre' | 'post') => FlowNodeErrorMap;
  nextSwitchCaseId: () => string;
  flowEditorNodeErrors: string[];
  flowEditorHasErrors: boolean;
  triggerValidationPulse: (node: HTMLDivElement | null) => void;
  onCancelFlowEditor: () => void;
  onSaveFlowEditor: () => void;
};

const FcomFlowEditorModal = ({
  flowEditor,
  flowEditorDraft,
  flowEditorModalRef,
  getModalOverlayStyle,
  getFlowNodeLabel,
  onShowFieldReference,
  applyFlowEditorExample,
  renderProcessorConfigFields,
  flowEditorFieldErrors,
  handleFlowEditorInputChange,
  setFlowEditorDraft,
  renderFlowList,
  validateFlowNodes,
  nextSwitchCaseId,
  flowEditorNodeErrors,
  flowEditorHasErrors,
  triggerValidationPulse,
  onCancelFlowEditor,
  onSaveFlowEditor,
}: FcomFlowEditorModalProps) => {
  if (!flowEditor || !flowEditorDraft) {
    return null;
  }

  const helpKey = flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType;
  const help = processorHelp[helpKey as keyof typeof processorHelp];

  return (
    <div
      className="modal-overlay modal-overlay-top"
      style={getModalOverlayStyle('flowEditor', 1)}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal modal-wide" ref={flowEditorModalRef}>
        <div className="flow-editor-header">
          <h3>
            Configure Processor
            {flowEditorDraft ? ` \u2014 ${getFlowNodeLabel(flowEditorDraft)}` : ''}
          </h3>
          <button type="button" className="builder-link" onClick={onShowFieldReference}>
            Field reference
          </button>
        </div>
        {help && (
          <div className="builder-hint">
            <div>{help.description}</div>
            <div className="builder-example-row">
              <button type="button" className="builder-link" onClick={applyFlowEditorExample}>
                Apply example
              </button>
              <span className="builder-example-code">{help.example}</span>
            </div>
          </div>
        )}
        {flowEditorDraft.kind === 'processor' &&
          ['set', 'regex'].includes(flowEditorDraft.processorType) && (
            <div className="processor-form">
              {renderProcessorConfigFields(
                flowEditorDraft.processorType,
                flowEditorDraft.config || {},
                (key, value) =>
                  setFlowEditorDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          config: {
                            ...(prev as FlowProcessorNode).config,
                            [key]: value,
                          },
                        }
                      : prev,
                  ),
                'flow',
                flowEditorFieldErrors,
              )}
            </div>
          )}
        {flowEditorDraft.kind === 'if' && (
          <div className="processor-form">
            <div className="processor-row">
              <label className="builder-label">Property</label>
              <input
                className="builder-input"
                value={flowEditorDraft.condition.property}
                onChange={(e) =>
                  handleFlowEditorInputChange(
                    'flowEditor.condition.property',
                    e.target.value,
                    e.target.selectionStart,
                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                  )
                }
              />
            </div>
            <div className="processor-row">
              <label className="builder-label">Operator</label>
              <select
                className="builder-select"
                value={flowEditorDraft.condition.operator}
                onChange={(e) =>
                  setFlowEditorDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          condition: {
                            ...(prev as FlowIfNode).condition,
                            operator: e.target.value,
                          },
                        }
                      : prev,
                  )
                }
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="contains">contains</option>
                <option value="not contains">not contains</option>
                <option value="exists">exists</option>
                <option value="not exists">not exists</option>
                <option value="matches">matches</option>
                <option value="not matches">not matches</option>
              </select>
            </div>
            <div className="processor-row">
              <label className="builder-label">Value</label>
              <input
                className="builder-input"
                value={flowEditorDraft.condition.value}
                onChange={(e) =>
                  handleFlowEditorInputChange(
                    'flowEditor.condition.value',
                    e.target.value,
                    e.target.selectionStart,
                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                  )
                }
              />
            </div>
          </div>
        )}
        {flowEditorDraft.kind === 'processor' &&
          flowEditorDraft.processorType === 'foreach' && (
            <div className="processor-form">
              <div className="processor-row">
                <label className="builder-label">Source</label>
                <input
                  className="builder-input"
                  value={flowEditorDraft.config?.source || ''}
                  onChange={(e) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              source: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="processor-row">
                <label className="builder-label">Key field</label>
                <input
                  className="builder-input"
                  value={flowEditorDraft.config?.keyVal || ''}
                  onChange={(e) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              keyVal: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="processor-row">
                <label className="builder-label">Value</label>
                <input
                  className="builder-input"
                  value={flowEditorDraft.config?.valField || ''}
                  onChange={(e) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              valField: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="processor-row">
                <label className="builder-label">Processors</label>
                {renderFlowList(
                  Array.isArray(flowEditorDraft.config?.processors)
                    ? (flowEditorDraft.config?.processors as FlowNode[])
                    : [],
                  { kind: 'root' },
                  (updater) => {
                    setFlowEditorDraft((prev) => {
                      if (!prev || prev.kind !== 'processor') {
                        return prev;
                      }
                      const current = Array.isArray(prev.config?.processors)
                        ? prev.config.processors
                        : [];
                      const next =
                        typeof updater === 'function'
                          ? (updater as (items: FlowNode[]) => FlowNode[])(current)
                          : updater;
                      return {
                        ...prev,
                        config: {
                          ...(prev as FlowProcessorNode).config,
                          processors: next,
                        },
                      } as FlowNode;
                    });
                  },
                  flowEditor.scope || 'object',
                  flowEditor.lane || 'object',
                  validateFlowNodes(
                    Array.isArray(flowEditorDraft.config?.processors)
                      ? (flowEditorDraft.config?.processors as FlowNode[])
                      : [],
                    flowEditor.lane || 'object',
                  ),
                )}
              </div>
            </div>
          )}
        {flowEditorDraft.kind === 'processor' &&
          flowEditorDraft.processorType === 'switch' && (
            <div className="processor-form">
              <div className="processor-row">
                <label className="builder-label">Source</label>
                <input
                  className="builder-input"
                  value={flowEditorDraft.config?.source || ''}
                  onChange={(e) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              source: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="processor-row">
                <label className="builder-label">Operator</label>
                <input
                  className="builder-input"
                  value={flowEditorDraft.config?.operator || ''}
                  onChange={(e) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              operator: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="processor-row">
                <label className="builder-label">Cases</label>
                <div className="flow-switch-cases">
                  {(Array.isArray(flowEditorDraft.config?.cases)
                    ? flowEditorDraft.config?.cases
                    : []
                  ).map((item: any) => (
                    <div key={item.id} className="flow-switch-case">
                      <div className="flow-switch-case-row">
                        <label className="builder-label">Match</label>
                        <input
                          className="builder-input"
                          value={item.match ?? ''}
                          onChange={(e) =>
                            setFlowEditorDraft((prev) => {
                              if (!prev || prev.kind !== 'processor') {
                                return prev;
                              }
                              const cases = Array.isArray(prev.config?.cases)
                                ? prev.config.cases
                                : [];
                              return {
                                ...prev,
                                config: {
                                  ...(prev as FlowProcessorNode).config,
                                  cases: cases.map((entry: any) =>
                                    entry.id === item.id
                                      ? { ...entry, match: e.target.value }
                                      : entry,
                                  ),
                                },
                              } as FlowNode;
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
                            setFlowEditorDraft((prev) => {
                              if (!prev || prev.kind !== 'processor') {
                                return prev;
                              }
                              const cases = Array.isArray(prev.config?.cases)
                                ? prev.config.cases
                                : [];
                              return {
                                ...prev,
                                config: {
                                  ...(prev as FlowProcessorNode).config,
                                  cases: cases.map((entry: any) =>
                                    entry.id === item.id
                                      ? { ...entry, operator: e.target.value }
                                      : entry,
                                  ),
                                },
                              } as FlowNode;
                            })
                          }
                        />
                      </div>
                      <div className="flow-switch-case-row">
                        <button
                          type="button"
                          className="builder-link"
                          onClick={() =>
                            setFlowEditorDraft((prev) => {
                              if (!prev || prev.kind !== 'processor') {
                                return prev;
                              }
                              const cases = Array.isArray(prev.config?.cases)
                                ? prev.config.cases
                                : [];
                              return {
                                ...prev,
                                config: {
                                  ...(prev as FlowProcessorNode).config,
                                  cases: cases.filter((entry: any) => entry.id !== item.id),
                                },
                              } as FlowNode;
                            })
                          }
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
                      setFlowEditorDraft((prev) => {
                        if (!prev || prev.kind !== 'processor') {
                          return prev;
                        }
                        const cases = Array.isArray(prev.config?.cases) ? prev.config.cases : [];
                        return {
                          ...prev,
                          config: {
                            ...(prev as FlowProcessorNode).config,
                            cases: [
                              ...cases,
                              {
                                id: nextSwitchCaseId(),
                                match: '',
                                operator: '',
                                processors: [],
                              },
                            ],
                          },
                        } as FlowNode;
                      })
                    }
                  >
                    Add case
                  </button>
                </div>
              </div>
              <div className="builder-hint">
                Drag processors into each case or the Default lane on the canvas.
              </div>
            </div>
          )}
        {flowEditorDraft.kind === 'processor' &&
          !['set', 'regex', 'foreach', 'switch'].includes(flowEditorDraft.processorType) && (
            <div className="processor-form">
              {(processorConfigSpecs[flowEditorDraft.processorType] || []).length === 0 ? (
                <div className="builder-hint">No configuration required for this processor.</div>
              ) : (
                renderProcessorConfigFields(
                  flowEditorDraft.processorType,
                  flowEditorDraft.config || {},
                  (key, value) =>
                    setFlowEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...(prev as FlowProcessorNode).config,
                              [key]: value,
                            },
                          }
                        : prev,
                    ),
                  'flow',
                )
              )}
            </div>
          )}
        {flowEditorNodeErrors.length > 0 && (
          <div className="builder-hint builder-hint-warning">
            {flowEditorNodeErrors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancelFlowEditor}>
            Cancel
          </button>
          <button
            type="button"
            aria-disabled={flowEditorHasErrors}
            className={`builder-card builder-card-primary${
              flowEditorHasErrors ? ' button-disabled' : ''
            }`}
            onClick={() => {
              if (flowEditorHasErrors) {
                triggerValidationPulse(flowEditorModalRef.current);
                return;
              }
              onSaveFlowEditor();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default FcomFlowEditorModal;
