import type { ReactNode } from 'react';
import BuilderLink from '../../components/BuilderLink';
import Pill from '../../components/Pill';

type FcomEventSecondaryRowProps = {
  baseFields: string[];
  eventPanelKey: string;
  obj: any;
  overrideTargets: Set<string>;
  processorTargets: Set<string>;
  getProcessorFieldSummary: (obj: any, field: string) => string;
  overrideValueMap: Map<string, any>;
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
};

export default function FcomEventSecondaryRow({
  baseFields,
  eventPanelKey,
  obj,
  overrideTargets,
  processorTargets,
  getProcessorFieldSummary,
  overrideValueMap,
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
}: FcomEventSecondaryRowProps) {
  return (
    <div className="object-row object-row-secondary">
      {baseFields.includes('EventType') && (
        <div>
          <div className="field-header">
            <div className="field-header-main">
              {(() => {
                const stagedRemoved = isFieldStagedRemoved(obj, 'EventType');
                return (
                  <>
                    <span
                      className={
                        isFieldHighlighted(eventPanelKey, 'EventType')
                          ? 'label label-warning'
                          : 'label'
                      }
                    >
                      Event Type
                    </span>
                    {renderFieldBadges(eventPanelKey, 'EventType', obj, overrideTargets)}
                    {overrideTargets.has('$.event.EventType') && (
                      <div className="override-summary" tabIndex={0} {...overrideTooltipHoverProps}>
                        <Pill
                          className={`override-pill pill-inline pill-action${
                            (panelEditState[eventPanelKey] &&
                              isFieldPendingRemoval(eventPanelKey, 'EventType')) ||
                            stagedRemoved
                              ? ' pill-removed'
                              : ''
                          }`}
                          title={
                            panelEditState[eventPanelKey] &&
                            (isFieldPendingRemoval(eventPanelKey, 'EventType') || stagedRemoved) &&
                            !isFieldNew(obj, 'EventType')
                              ? 'Will revert to Original value'
                              : undefined
                          }
                        >
                          Override
                          {hasEditPermission &&
                            panelEditState[eventPanelKey] &&
                            overrideValueMap.has('$.event.EventType') && (
                              <button
                                type="button"
                                className="pill-close"
                                aria-label="Remove EventType override"
                                onClick={() =>
                                  openRemoveOverrideModal(obj, 'EventType', eventPanelKey)
                                }
                              >
                                ×
                              </button>
                            )}
                        </Pill>
                        {renderOverrideSummaryCard(
                          obj,
                          overrideValueMap,
                          ['EventType'],
                          'Override',
                        )}
                      </div>
                    )}
                    {((panelEditState[eventPanelKey] &&
                      (isFieldPendingRemoval(eventPanelKey, 'EventType') || stagedRemoved)) ||
                      (!panelEditState[eventPanelKey] && stagedRemoved)) && (
                      <Pill className="removed-pill">Removed</Pill>
                    )}
                    {(panelEditState[eventPanelKey]
                      ? isFieldDirty(obj, eventPanelKey, 'EventType') || stagedRemoved
                      : isFieldStagedDirty(obj, 'EventType')) && (
                      <span className="dirty-indicator" title="Unsaved change">
                        ✎
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
            {panelEditState[eventPanelKey] && (
              <BuilderLink
                className="builder-link-iconic"
                onClick={() => openBuilderForField(obj, eventPanelKey, 'EventType')}
                disabled={isFieldLockedByBuilder(eventPanelKey, 'EventType')}
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
              </BuilderLink>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            (() => {
              const isProcessorField = processorTargets.has('$.event.EventType');
              const processorSummary = getProcessorFieldSummary(obj, 'EventType');
              const processorTitle = processorSummary
                ? `Value set by processor • ${processorSummary}`
                : 'Value set by processor';
              const draftValue = panelDrafts?.[eventPanelKey]?.event?.EventType;
              const displayValue =
                draftValue ?? (overrideValueMap.get('$.event.EventType') ?? obj?.event?.EventType ?? '');
              return (
                <input
                  className={`${
                    isFieldHighlighted(eventPanelKey, 'EventType')
                      ? 'panel-input panel-input-warning'
                      : 'panel-input'
                  }${isProcessorField ? ' panel-input-processor' : ''}${
                    isFieldPendingRemoval(eventPanelKey, 'EventType') ||
                    isFieldStagedRemoved(obj, 'EventType')
                      ? ' panel-input-removed'
                      : ''
                  }`}
                  value={displayValue}
                  onChange={(e) =>
                    handleEventInputChange(
                      obj,
                      eventPanelKey,
                      'EventType',
                      e.target.value,
                      e.target.selectionStart,
                      (e.nativeEvent as InputEvent | undefined)?.inputType,
                    )
                  }
                  disabled={
                    isFieldLockedByBuilder(eventPanelKey, 'EventType') ||
                    (isFieldPendingRemoval(eventPanelKey, 'EventType') &&
                      isFieldNew(obj, 'EventType'))
                  }
                  title={
                    isFieldLockedByBuilder(eventPanelKey, 'EventType')
                      ? 'Finish or cancel the builder to edit other fields'
                      : isFieldPendingRemoval(eventPanelKey, 'EventType') ||
                          isFieldStagedRemoved(obj, 'EventType')
                        ? 'Marked for removal'
                        : isProcessorField
                          ? processorTitle
                          : ''
                  }
                />
              );
            })()
          ) : (
            <span className="value">
              {renderValue(
                overrideValueMap.get('$.event.EventType') ?? obj?.event?.EventType,
                obj?.trap?.variables,
              )}
            </span>
          )}
        </div>
      )}
      {baseFields.includes('ExpireTime') && (
        <div>
          <div className="field-header">
            <div className="field-header-main">
              {(() => {
                const stagedRemoved = isFieldStagedRemoved(obj, 'ExpireTime');
                return (
                  <>
                    <span
                      className={
                        isFieldHighlighted(eventPanelKey, 'ExpireTime')
                          ? 'label label-warning'
                          : 'label'
                      }
                    >
                      Expire Time
                    </span>
                    {renderFieldBadges(eventPanelKey, 'ExpireTime', obj, overrideTargets)}
                    {overrideTargets.has('$.event.ExpireTime') && (
                      <div className="override-summary" tabIndex={0} {...overrideTooltipHoverProps}>
                        <Pill
                          className={`override-pill pill-inline pill-action${
                            (panelEditState[eventPanelKey] &&
                              isFieldPendingRemoval(eventPanelKey, 'ExpireTime')) ||
                            stagedRemoved
                              ? ' pill-removed'
                              : ''
                          }`}
                          title={
                            panelEditState[eventPanelKey] &&
                            (isFieldPendingRemoval(eventPanelKey, 'ExpireTime') || stagedRemoved) &&
                            !isFieldNew(obj, 'ExpireTime')
                              ? 'Will revert to Original value'
                              : undefined
                          }
                        >
                          Override
                          {hasEditPermission &&
                            panelEditState[eventPanelKey] &&
                            overrideValueMap.has('$.event.ExpireTime') && (
                              <button
                                type="button"
                                className="pill-close"
                                aria-label="Remove ExpireTime override"
                                onClick={() =>
                                  openRemoveOverrideModal(obj, 'ExpireTime', eventPanelKey)
                                }
                              >
                                ×
                              </button>
                            )}
                        </Pill>
                        {renderOverrideSummaryCard(
                          obj,
                          overrideValueMap,
                          ['ExpireTime'],
                          'Override',
                        )}
                      </div>
                    )}
                    {((panelEditState[eventPanelKey] &&
                      (isFieldPendingRemoval(eventPanelKey, 'ExpireTime') || stagedRemoved)) ||
                      (!panelEditState[eventPanelKey] && stagedRemoved)) && (
                      <Pill className="removed-pill">Removed</Pill>
                    )}
                    {(panelEditState[eventPanelKey]
                      ? isFieldDirty(obj, eventPanelKey, 'ExpireTime') || stagedRemoved
                      : isFieldStagedDirty(obj, 'ExpireTime')) && (
                      <span className="dirty-indicator" title="Unsaved change">
                        ✎
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
            {panelEditState[eventPanelKey] && (
              <BuilderLink
                className="builder-link-iconic"
                onClick={() => openBuilderForField(obj, eventPanelKey, 'ExpireTime')}
                disabled={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')}
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
              </BuilderLink>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            (() => {
              const isProcessorField = processorTargets.has('$.event.ExpireTime');
              const processorSummary = getProcessorFieldSummary(obj, 'ExpireTime');
              const processorTitle = processorSummary
                ? `Value set by processor • ${processorSummary}`
                : 'Value set by processor';
              const draftValue = panelDrafts?.[eventPanelKey]?.event?.ExpireTime;
              const displayValue =
                draftValue ?? (overrideValueMap.get('$.event.ExpireTime') ?? obj?.event?.ExpireTime ?? '');
              return (
                <input
                  className={`${
                    isFieldHighlighted(eventPanelKey, 'ExpireTime')
                      ? 'panel-input panel-input-warning'
                      : 'panel-input'
                  }${isProcessorField ? ' panel-input-processor' : ''}${
                    isFieldPendingRemoval(eventPanelKey, 'ExpireTime') ||
                    isFieldStagedRemoved(obj, 'ExpireTime')
                      ? ' panel-input-removed'
                      : ''
                  }`}
                  value={displayValue}
                  onChange={(e) =>
                    handleEventInputChange(
                      obj,
                      eventPanelKey,
                      'ExpireTime',
                      e.target.value,
                      e.target.selectionStart,
                      (e.nativeEvent as InputEvent | undefined)?.inputType,
                    )
                  }
                  disabled={
                    isFieldLockedByBuilder(eventPanelKey, 'ExpireTime') ||
                    (isFieldPendingRemoval(eventPanelKey, 'ExpireTime') &&
                      isFieldNew(obj, 'ExpireTime'))
                  }
                  title={
                    isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')
                      ? 'Finish or cancel the builder to edit other fields'
                      : isFieldPendingRemoval(eventPanelKey, 'ExpireTime') ||
                          isFieldStagedRemoved(obj, 'ExpireTime')
                        ? 'Marked for removal'
                        : isProcessorField
                          ? processorTitle
                          : ''
                  }
                />
              );
            })()
          ) : (
            <span className="value">
              {renderValue(
                overrideValueMap.get('$.event.ExpireTime') ?? obj?.event?.ExpireTime,
                obj?.trap?.variables,
              )}
            </span>
          )}
        </div>
      )}
      {baseFields.includes('EventCategory') && (
        <div>
          <div className="field-header">
            <div className="field-header-main">
              {(() => {
                const stagedRemoved = isFieldStagedRemoved(obj, 'EventCategory');
                return (
                  <>
                    <span
                      className={
                        isFieldHighlighted(eventPanelKey, 'EventCategory')
                          ? 'label label-warning'
                          : 'label'
                      }
                    >
                      Event Category
                    </span>
                    {renderFieldBadges(eventPanelKey, 'EventCategory', obj, overrideTargets)}
                    {overrideTargets.has('$.event.EventCategory') && (
                      <div className="override-summary" tabIndex={0} {...overrideTooltipHoverProps}>
                        <Pill
                          className={`override-pill pill-inline pill-action${
                            (panelEditState[eventPanelKey] &&
                              isFieldPendingRemoval(eventPanelKey, 'EventCategory')) ||
                            stagedRemoved
                              ? ' pill-removed'
                              : ''
                          }`}
                          title={
                            panelEditState[eventPanelKey] &&
                            (isFieldPendingRemoval(eventPanelKey, 'EventCategory') ||
                              stagedRemoved) &&
                            !isFieldNew(obj, 'EventCategory')
                              ? 'Will revert to Original value'
                              : undefined
                          }
                        >
                          Override
                          {hasEditPermission &&
                            panelEditState[eventPanelKey] &&
                            overrideValueMap.has('$.event.EventCategory') && (
                              <button
                                type="button"
                                className="pill-close"
                                aria-label="Remove EventCategory override"
                                onClick={() =>
                                  openRemoveOverrideModal(obj, 'EventCategory', eventPanelKey)
                                }
                              >
                                ×
                              </button>
                            )}
                        </Pill>
                        {renderOverrideSummaryCard(
                          obj,
                          overrideValueMap,
                          ['EventCategory'],
                          'Override',
                        )}
                      </div>
                    )}
                    {((panelEditState[eventPanelKey] &&
                      (isFieldPendingRemoval(eventPanelKey, 'EventCategory') || stagedRemoved)) ||
                      (!panelEditState[eventPanelKey] && stagedRemoved)) && (
                      <Pill className="removed-pill">Removed</Pill>
                    )}
                    {(panelEditState[eventPanelKey]
                      ? isFieldDirty(obj, eventPanelKey, 'EventCategory') || stagedRemoved
                      : isFieldStagedDirty(obj, 'EventCategory')) && (
                      <span className="dirty-indicator" title="Unsaved change">
                        ✎
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
            {panelEditState[eventPanelKey] && (
              <BuilderLink
                className="builder-link-iconic"
                onClick={() => openBuilderForField(obj, eventPanelKey, 'EventCategory')}
                disabled={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')}
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
              </BuilderLink>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            (() => {
              const isProcessorField = processorTargets.has('$.event.EventCategory');
              const processorSummary = getProcessorFieldSummary(obj, 'EventCategory');
              const processorTitle = processorSummary
                ? `Value set by processor • ${processorSummary}`
                : 'Value set by processor';
              const draftValue = panelDrafts?.[eventPanelKey]?.event?.EventCategory;
              const displayValue =
                draftValue ?? (overrideValueMap.get('$.event.EventCategory') ?? obj?.event?.EventCategory ?? '');
              return (
                <input
                  className={`${
                    isFieldHighlighted(eventPanelKey, 'EventCategory')
                      ? 'panel-input panel-input-warning'
                      : 'panel-input'
                  }${isProcessorField ? ' panel-input-processor' : ''}${
                    isFieldPendingRemoval(eventPanelKey, 'EventCategory') ||
                    isFieldStagedRemoved(obj, 'EventCategory')
                      ? ' panel-input-removed'
                      : ''
                  }`}
                  value={displayValue}
                  onChange={(e) =>
                    handleEventInputChange(
                      obj,
                      eventPanelKey,
                      'EventCategory',
                      e.target.value,
                      e.target.selectionStart,
                      (e.nativeEvent as InputEvent | undefined)?.inputType,
                    )
                  }
                  disabled={
                    isFieldLockedByBuilder(eventPanelKey, 'EventCategory') ||
                    (isFieldPendingRemoval(eventPanelKey, 'EventCategory') &&
                      isFieldNew(obj, 'EventCategory'))
                  }
                  title={
                    isFieldLockedByBuilder(eventPanelKey, 'EventCategory')
                      ? 'Finish or cancel the builder to edit other fields'
                      : isFieldPendingRemoval(eventPanelKey, 'EventCategory') ||
                          isFieldStagedRemoved(obj, 'EventCategory')
                        ? 'Marked for removal'
                        : isProcessorField
                          ? processorTitle
                          : ''
                  }
                />
              );
            })()
          ) : (
            <span className="value">
              {renderValue(
                overrideValueMap.get('$.event.EventCategory') ?? obj?.event?.EventCategory,
                obj?.trap?.variables,
              )}
            </span>
          )}
        </div>
      )}
      {obj?.trap?.oid ? (
        <div>
          <span className="label">OID</span>
          <span className="value monospace">{renderValue(obj?.trap?.oid)}</span>
        </div>
      ) : null}
    </div>
  );
}
