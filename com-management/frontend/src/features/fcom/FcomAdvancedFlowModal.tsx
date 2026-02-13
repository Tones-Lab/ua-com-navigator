import React from 'react';
import type { FlowBranchPath, FlowNode } from './flowUtils';

type FlowNodeErrorMap = Record<string, string[]>;

type FlowValidation = {
  pre: FlowNodeErrorMap;
  post: FlowNodeErrorMap;
  object: FlowNodeErrorMap;
};

type ProcessorHelpKey = keyof typeof import('./processorHelp').processorHelp;

type PaletteItem = {
  label: string;
  nodeKind: 'processor' | 'if';
  processorType?: string;
  status: 'working' | 'testing' | 'planned';
};

type PaletteSection = {
  title: string;
  status: 'working' | 'testing' | 'planned';
  items: PaletteItem[];
};

type FocusMatch = {
  lane: 'object' | 'pre' | 'post';
  processor: any;
};

type FcomAdvancedFlowModalProps = {
  showAdvancedProcessorModal: boolean;
  pendingAdvancedFlowClose: boolean;
  getModalOverlayStyle: (key: string, order: number) => React.CSSProperties | undefined;
  advancedFlowModalRef: React.RefObject<HTMLDivElement>;
  advancedProcessorScope: 'object' | 'global';
  requestCloseAdvancedFlowModal: () => void;
  advancedFlowDirty: boolean;
  flowErrorCount: number;
  advancedFlowRemovedTargets: string[];
  advancedFlowVersionInfo: {
    mode: 'none' | 'v2' | 'v3' | 'mixed';
    label: string;
    detail: string;
  } | null;
  advancedFlowNotice: string | null;
  advancedFlowPatchPreview: string | null;
  canConvertToV3: boolean;
  onConvertToV3: () => void;
  formatFlowTargetLabel: (target: string) => string;
  advancedProcessorSearch: string;
  onAdvancedProcessorSearchChange: (value: string) => void;
  paletteSections: PaletteSection[];
  renderProcessorHelp: (key: ProcessorHelpKey) => React.ReactNode;
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
  globalPreFlow: FlowNode[];
  setGlobalPreFlow: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  globalPostFlow: FlowNode[];
  setGlobalPostFlow: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  advancedFlow: FlowNode[];
  setAdvancedFlow: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  flowValidation: FlowValidation;
  renderFlowJsonPreview: (payload: string) => React.ReactNode;
  buildFlowProcessors: (nodes: FlowNode[], normalizeSourcePath: (value: string) => string) => any[];
  normalizeSourcePath: (value: string) => string;
  hasEditPermission: boolean;
  triggerFlowErrorPulse: (node: HTMLDivElement | null) => void;
  saveAdvancedFlow: () => void;
  onCancelAdvancedFlowClose: () => void;
  onConfirmAdvancedFlowClose: () => void;
  advancedFlowFocusTarget: string | null;
  advancedFlowFocusIndex: number;
  advancedFlowFocusOnly: boolean;
  focusedFlowMatch: boolean;
  focusedFlowMatches: FocusMatch[];
  focusedLaneLabel: string;
  setAdvancedFlowFocusTarget: (value: string | null) => void;
  setAdvancedFlowFocusIndex: React.Dispatch<React.SetStateAction<number>>;
  setAdvancedFlowFocusOnly: React.Dispatch<React.SetStateAction<boolean>>;
};

const FcomAdvancedFlowModal = ({
  showAdvancedProcessorModal,
  pendingAdvancedFlowClose,
  getModalOverlayStyle,
  advancedFlowModalRef,
  advancedProcessorScope,
  requestCloseAdvancedFlowModal,
  advancedFlowDirty,
  flowErrorCount,
  advancedFlowRemovedTargets,
  advancedFlowVersionInfo,
  advancedFlowNotice,
  advancedFlowPatchPreview,
  canConvertToV3,
  onConvertToV3,
  formatFlowTargetLabel,
  advancedProcessorSearch,
  onAdvancedProcessorSearchChange,
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
  advancedFlowFocusTarget,
  advancedFlowFocusIndex,
  advancedFlowFocusOnly,
  focusedFlowMatch,
  focusedFlowMatches,
  focusedLaneLabel,
  setAdvancedFlowFocusTarget,
  setAdvancedFlowFocusIndex,
  setAdvancedFlowFocusOnly,
}: FcomAdvancedFlowModalProps) => (
  <>
    {showAdvancedProcessorModal && (
      <div
        className="modal-overlay modal-overlay-top"
        style={getModalOverlayStyle('advancedFlow', 0)}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal modal-flow" ref={advancedFlowModalRef}>
          <div className="flow-modal-header">
            <h3>
              {advancedProcessorScope === 'global'
                ? 'Advanced Processors (Global)'
                : 'Advanced Processors (Object)'}
            </h3>
          </div>
          <div className="flow-modal-subtitle">
            {advancedProcessorScope === 'global'
              ? 'Wireframe: configure global pre/post processors for the file. Drag from the palette into the lanes.'
              : 'Wireframe: configure object processors. Drag from the palette into the flow lanes.'}
          </div>
          {advancedFlowNotice && (
            <div className="builder-hint flow-convert-note">{advancedFlowNotice}</div>
          )}
          {advancedProcessorScope === 'object' &&
            (() => {
              const mode = advancedFlowVersionInfo?.mode;
              if (!mode || mode === 'none') {
                return null;
              }
              const isV2 = mode === 'v2';
              const isMixed = mode === 'mixed';
              const statusText = isMixed
                ? 'Mixed processors (v2 + v3). See inline badges.'
                : isV2
                  ? 'All processors are v2 (legacy).'
                  : 'All processors are v3 (patch).';
              const helperText = isV2
                ? 'Convert to v3 to edit in the standard builder.'
                : '';
              return (
                <div
                  className={`builder-hint flow-version-note${
                    isV2 || isMixed ? ' builder-hint-warning' : ''
                  }`}
                >
                  {(isV2 || isMixed) && (
                    <span
                      className="pill override-pill"
                      title="We recommend moving to v3. Click Convert from the main edit panel."
                      aria-label="V2 override warning"
                    >
                      !
                    </span>
                  )}
                  <span>{statusText}</span>
                  {helperText && <span className="flow-version-helper">{helperText}</span>}
                  {(isV2 || isMixed) && canConvertToV3 && (
                    <button
                      type="button"
                      className="builder-link"
                      onClick={onConvertToV3}
                      title="Converts all processors in this object."
                    >
                      Convert entire override to v3
                    </button>
                  )}
                </div>
              );
            })()}
          {(advancedFlowDirty || flowErrorCount > 0) && (
            <div className="builder-hint builder-hint-warning">
              {flowErrorCount > 0
                ? `Resolve ${flowErrorCount} validation issue(s) before saving.`
                : 'Pending Advanced Flow changes. Save to stage.'}
            </div>
          )}
          {advancedFlowRemovedTargets.length > 0 && (
            <div className="flow-removed-card">
              <div className="flow-removed-title">Marked for deletion on save</div>
              <div className="flow-removed-list">
                {advancedFlowRemovedTargets.map((target) => (
                  <div key={target} className="flow-removed-item">
                    <span className="flow-removed-label">{formatFlowTargetLabel(target)}</span>
                    <span className="pill removed-pill">To be deleted</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flow-modal-body">
            <div className="flow-palette">
              <div className="flow-palette-title">Palette</div>
              <input
                className="flow-palette-search"
                placeholder="Search processors"
                value={advancedProcessorSearch}
                onChange={(event) => onAdvancedProcessorSearchChange(event.target.value)}
              />
              <div className="flow-palette-list">
                {paletteSections.map((section) => (
                  <div key={section.status} className="flow-palette-section">
                    <div className="flow-palette-section-title">{section.title}</div>
                    {section.items.length === 0 ? (
                      <div className="flow-palette-empty">None</div>
                    ) : (
                      <div className="flow-palette-section-grid">
                        {section.items.map((item) => {
                          const isEnabled = item.status !== 'planned';
                          const helpKey = item.nodeKind === 'if' ? 'if' : item.processorType;
                          return (
                            <div
                              key={`${item.label}-${item.nodeKind}`}
                              className={
                                isEnabled
                                  ? 'flow-palette-item'
                                  : 'flow-palette-item flow-palette-item-disabled'
                              }
                              draggable={isEnabled}
                              onDragStart={(event) => {
                                if (!isEnabled) {
                                  return;
                                }
                                const payload = JSON.stringify({
                                  source: 'palette',
                                  nodeKind: item.nodeKind,
                                  processorType: item.processorType,
                                });
                                event.dataTransfer.setData('application/json', payload);
                                event.dataTransfer.setData('text/plain', payload);
                                event.dataTransfer.effectAllowed = 'copyMove';
                              }}
                            >
                              <span>{item.label}</span>
                              {helpKey ? renderProcessorHelp(helpKey as ProcessorHelpKey) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flow-canvas">
              {advancedFlowFocusTarget && (
                <div className="flow-focus-card">
                  <div className="flow-focus-row">
                    <div className="flow-focus-title">
                      Focused target: <span className="monospace">{advancedFlowFocusTarget}</span>
                    </div>
                    <div className="flow-focus-count">
                      {focusedFlowMatches.length > 0
                        ? `Match ${advancedFlowFocusIndex + 1} of ${focusedFlowMatches.length} (${focusedLaneLabel})`
                        : 'No matching processors found'}
                    </div>
                  </div>
                  <div className="flow-focus-actions">
                    <button
                      type="button"
                      className="builder-link"
                      onClick={() => setAdvancedFlowFocusOnly((prev) => !prev)}
                      disabled={!focusedFlowMatch}
                    >
                      {advancedFlowFocusOnly ? 'Show full JSON' : 'Focus only'}
                    </button>
                    <button
                      type="button"
                      className="builder-link"
                      onClick={() => {
                        setAdvancedFlowFocusTarget(null);
                        setAdvancedFlowFocusIndex(0);
                        setAdvancedFlowFocusOnly(false);
                      }}
                    >
                      Clear focus
                    </button>
                  </div>
                  {focusedFlowMatches.length > 1 && (
                    <div className="flow-focus-controls">
                      <button
                        type="button"
                        className="builder-link"
                        onClick={() =>
                          setAdvancedFlowFocusIndex((prev) =>
                            prev <= 0 ? focusedFlowMatches.length - 1 : prev - 1,
                          )
                        }
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="builder-link"
                        onClick={() =>
                          setAdvancedFlowFocusIndex((prev) =>
                            prev >= focusedFlowMatches.length - 1 ? 0 : prev + 1,
                          )
                        }
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
              {advancedProcessorScope === 'global' ? (
                <>
                  <div className="flow-canvas-title">Global Flow</div>
                  <div className="flow-global-sections">
                    <div className="flow-global-section">
                      <div className="flow-global-title">Pre</div>
                      {renderFlowList(
                        globalPreFlow,
                        { kind: 'root' },
                        setGlobalPreFlow,
                        'global',
                        'pre',
                        flowValidation.pre,
                        null,
                      )}
                    </div>
                    <div className="flow-global-section">
                      <div className="flow-global-title">Post</div>
                      {renderFlowList(
                        globalPostFlow,
                        { kind: 'root' },
                        setGlobalPostFlow,
                        'global',
                        'post',
                        flowValidation.post,
                        null,
                      )}
                    </div>
                  </div>
                  {renderFlowJsonPreview(
                    JSON.stringify(
                      {
                        pre: buildFlowProcessors(globalPreFlow, normalizeSourcePath),
                        post: buildFlowProcessors(globalPostFlow, normalizeSourcePath),
                      },
                      null,
                      2,
                    ),
                  )}
                </>
              ) : advancedFlowVersionInfo?.mode === 'v3' && advancedFlowPatchPreview ? (
                <>
                  <div className="flow-canvas-title">v3 Patch Preview</div>
                  {renderFlowJsonPreview(advancedFlowPatchPreview)}
                </>
              ) : (
                <>
                  <div className="flow-canvas-title">Flow</div>
                  {renderFlowList(
                    advancedFlow,
                    { kind: 'root' },
                    setAdvancedFlow,
                    'object',
                    'object',
                    flowValidation.object,
                    advancedFlowVersionInfo,
                  )}
                  {renderFlowJsonPreview(
                    JSON.stringify(buildFlowProcessors(advancedFlow, normalizeSourcePath), null, 2),
                  )}
                </>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={requestCloseAdvancedFlowModal}>
              Close
            </button>
            {advancedFlowVersionInfo?.mode === 'v3' ? (
              <span className="flow-readonly-note">
                v3 patch preview (read-only). Save from main panel.
              </span>
            ) : (
              <button
                type="button"
                aria-disabled={!advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission}
                className={`builder-card builder-card-primary${
                  !advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission
                    ? ' button-disabled'
                    : ''
                }`}
                onClick={() => {
                  if (!advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission) {
                    if (flowErrorCount > 0) {
                      triggerFlowErrorPulse(advancedFlowModalRef.current);
                    }
                    return;
                  }
                  saveAdvancedFlow();
                }}
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    {pendingAdvancedFlowClose && (
      <div
        className="modal-overlay modal-overlay-top"
        style={getModalOverlayStyle('advancedFlowConfirm', 3)}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal">
          <h3>Discard Advanced Flow changes?</h3>
          <p>You have unsaved Advanced Flow edits. Discard them?</p>
          <div className="modal-actions">
            <button type="button" onClick={onCancelAdvancedFlowClose}>
              Cancel
            </button>
            <button type="button" onClick={onConfirmAdvancedFlowClose}>
              Discard
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default FcomAdvancedFlowModal;
