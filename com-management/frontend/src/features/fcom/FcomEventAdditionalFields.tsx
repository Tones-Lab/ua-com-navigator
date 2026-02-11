import type { ReactNode } from 'react';

type FcomEventAdditionalFieldsProps = {
  additionalFields: string[];
  eventPanelKey: string;
  obj: any;
  overrideTargets: Set<string>;
  processorTargets: Set<string>;
  getProcessorFieldSummary: (obj: any, field: string) => string;
  overrideValueMap: Map<string, any>;
  isOverrideEditLocked: boolean;
  overrideEditLockReason: string;
  panelEditState: Record<string, boolean>;
  hasEditPermission: boolean;
  isFieldHighlighted: (panelKey: string, field: string) => boolean;
  renderFieldBadges: (
    panelKey: string,
    field: string,
    obj: any,
    overrideTargets: Set<string>,
  ) => ReactNode;
  overrideTooltipHoverProps: any;
  openRemoveOverrideModal: (obj: any, field: string, panelKey: string) => void;
  renderOverrideSummaryCard: (
    obj: any,
    overrideValueMap: Map<string, any>,
    fields: string[],
    title: string,
  ) => ReactNode;
  isFieldDirty: (obj: any, panelKey: string, field: string) => boolean;
  isFieldPendingRemoval: (panelKey: string, field: string) => boolean;
  isFieldNew: (obj: any, field: string) => boolean;
  isFieldStagedDirty: (obj: any, field: string) => boolean;
  isFieldStagedRemoved: (obj: any, field: string) => boolean;
  openBuilderForField: (obj: any, panelKey: string, field: string) => void;
  isFieldLockedByBuilder: (panelKey: string, field: string) => boolean;
  panelDrafts: Record<string, any>;
  handleEventInputChange: (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  renderValue: (value: any, trapVars?: any[], options?: any) => ReactNode;
  getEventFieldDescription: (field: string) => string;
  formatEventFieldLabel: (field: string) => string;
  getBaseEventDisplay: (obj: any, field: string) => string;
};

export default function FcomEventAdditionalFields({
  additionalFields,
  eventPanelKey,
  obj,
  overrideTargets,
  processorTargets,
  getProcessorFieldSummary,
  overrideValueMap,
  isOverrideEditLocked,
  overrideEditLockReason,
  panelEditState,
  hasEditPermission,
  isFieldHighlighted,
  renderFieldBadges,
  overrideTooltipHoverProps,
  openRemoveOverrideModal,
  renderOverrideSummaryCard,
  isFieldDirty,
  isFieldPendingRemoval,
  isFieldNew,
  isFieldStagedDirty,
  isFieldStagedRemoved,
  openBuilderForField,
  isFieldLockedByBuilder,
  panelDrafts,
  handleEventInputChange,
  renderValue,
  getEventFieldDescription,
  formatEventFieldLabel,
  getBaseEventDisplay,
}: FcomEventAdditionalFieldsProps) {
  if (additionalFields.length === 0) {
    return null;
  }

  return (
    <div className="object-row object-row-additional">
      {additionalFields.map((field) => {
        const isTrapOidField = field === 'OID';
        const trapOidValue = obj?.trap?.oid;
        return (
          <div key={`${eventPanelKey}-${field}`}>
            <div className="field-header">
              <div className="field-header-main">
                {(() => {
                  const stagedRemoved = isFieldStagedRemoved(obj, field);
                  return (
                    <>
                      <span
                        className={
                          isFieldHighlighted(eventPanelKey, field) ? 'label label-warning' : 'label'
                        }
                      >
                        <span title={getEventFieldDescription(field)}>
                          {formatEventFieldLabel(field)}
                        </span>
                      </span>
                      {!isTrapOidField && renderFieldBadges(eventPanelKey, field, obj, overrideTargets)}
                      {!isTrapOidField && overrideTargets.has(`$.event.${field}`) && (
                        <div
                          className="override-summary"
                          tabIndex={0}
                          {...overrideTooltipHoverProps}
                        >
                          <span
                            className={`pill override-pill pill-inline pill-action${
                              (panelEditState[eventPanelKey] &&
                                isFieldPendingRemoval(eventPanelKey, field)) ||
                              stagedRemoved
                                ? ' pill-removed'
                                : ''
                            }`}
                          >
                            Override
                            {hasEditPermission &&
                              panelEditState[eventPanelKey] &&
                              overrideValueMap.has(`$.event.${field}`) && (
                                <button
                                  type="button"
                                  className="pill-close"
                                  aria-label={`Remove ${field} override`}
                                  onClick={() => openRemoveOverrideModal(obj, field, eventPanelKey)}
                                >
                                  ×
                                </button>
                              )}
                          </span>
                          {renderOverrideSummaryCard(obj, overrideValueMap, [field], 'Override')}
                        </div>
                      )}
                      {!isTrapOidField &&
                        ((panelEditState[eventPanelKey] &&
                          (isFieldPendingRemoval(eventPanelKey, field) || stagedRemoved)) ||
                          (!panelEditState[eventPanelKey] && stagedRemoved)) && (
                          <span className="pill removed-pill">Removed</span>
                        )}
                      {!isTrapOidField &&
                        (panelEditState[eventPanelKey]
                          ? isFieldDirty(obj, eventPanelKey, field) || stagedRemoved
                          : isFieldStagedDirty(obj, field)) && (
                          <span className="dirty-indicator" title="Unsaved change">
                            ✎
                          </span>
                        )}
                    </>
                  );
                })()}
              </div>
              {panelEditState[eventPanelKey] && !isTrapOidField && (
                <button
                  type="button"
                  className="builder-link builder-link-iconic"
                  onClick={() => openBuilderForField(obj, eventPanelKey, field)}
                  disabled={isFieldLockedByBuilder(eventPanelKey, field) || isOverrideEditLocked}
                  title={
                    isOverrideEditLocked
                      ? overrideEditLockReason
                      : isFieldLockedByBuilder(eventPanelKey, field)
                        ? 'Finish or cancel the builder to edit other fields'
                        : ''
                  }
                  aria-label="Open Builder"
                >
                  <span className="builder-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                      <path
                        d="M22.7 19.3 13.7 10.3a6 6 0 0 1-7.6-7.6l3.2 3.2 2.5-2.5L8.6.2a6 6 0 0 1 7.6 7.6l9 9-2.5 2.5zM2 22l6.3-1.3 6.6-6.6-2.5-2.5-6.6 6.6L2 22z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span className="builder-link-text">Builder</span>
                </button>
              )}
            </div>
            {isTrapOidField ? (
              <span className="value">
                {renderValue(trapOidValue, obj?.trap?.variables)}
              </span>
            ) : panelEditState[eventPanelKey] ? (
              (() => {
                const stagedRemoved = isFieldStagedRemoved(obj, field);
                const isProcessorField = processorTargets.has(`$.event.${field}`);
                const processorSummary = getProcessorFieldSummary(obj, field);
                const processorTitle = processorSummary
                  ? `Value set by processor • ${processorSummary}`
                  : 'Value set by processor';
                const draftValue = panelDrafts?.[eventPanelKey]?.event?.[field];
                const effectiveValue =
                  overrideValueMap.get(`$.event.${field}`) ?? obj?.event?.[field];
                const displayValue = draftValue ?? (() => {
                  if (effectiveValue === undefined || effectiveValue === null) {
                    return '';
                  }
                  if (
                    typeof effectiveValue === 'string' ||
                    typeof effectiveValue === 'number' ||
                    typeof effectiveValue === 'boolean'
                  ) {
                    return String(effectiveValue);
                  }
                  try {
                    return JSON.stringify(effectiveValue);
                  } catch {
                    return String(effectiveValue);
                  }
                })();
                return (
                  <input
                    className={`${
                      isFieldHighlighted(eventPanelKey, field)
                        ? 'panel-input panel-input-warning'
                        : 'panel-input'
                    }${isProcessorField ? ' panel-input-processor' : ''}${
                      isFieldPendingRemoval(eventPanelKey, field) || stagedRemoved
                        ? ' panel-input-removed'
                        : ''
                    }`}
                    value={displayValue}
                    onChange={(e) =>
                      handleEventInputChange(
                        obj,
                        eventPanelKey,
                        field,
                        e.target.value,
                        e.target.selectionStart,
                        (e.nativeEvent as InputEvent | undefined)?.inputType,
                      )
                    }
                    disabled={
                      isFieldLockedByBuilder(eventPanelKey, field) ||
                      (isFieldPendingRemoval(eventPanelKey, field) && isFieldNew(obj, field))
                    }
                    title={
                      isFieldLockedByBuilder(eventPanelKey, field)
                        ? 'Finish or cancel the builder to edit other fields'
                        : isFieldPendingRemoval(eventPanelKey, field) || stagedRemoved
                          ? 'Marked for removal'
                          : isProcessorField
                            ? processorTitle
                            : ''
                    }
                  />
                );
              })()
            ) : isFieldStagedRemoved(obj, field) && isFieldNew(obj, field) ? (
              <span className="value value-removed">Will be removed</span>
            ) : (
              <span className="value">
                {renderValue(
                  overrideValueMap.get(`$.event.${field}`) ?? obj?.event?.[field],
                  obj?.trap?.variables,
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
