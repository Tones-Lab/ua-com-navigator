import React from 'react';

type FcomEventPrimaryRowProps = {
  baseFields: string[];
  eventPanelKey: string;
  obj: any;
  overrideTargets: Set<string>;
  overrideValueMap: Map<string, any>;
  panelEditState: Record<string, boolean>;
  hasEditPermission: boolean;
  isFieldHighlighted: (panelKey: string, field: string) => boolean;
  renderFieldBadges: (panelKey: string, field: string, obj: any, overrideTargets: Set<string>) => React.ReactNode;
  overrideTooltipHoverProps: any;
  openRemoveOverrideModal: (obj: any, field: string, panelKey: string) => void;
  renderOverrideSummaryCard: (obj: any, overrideValueMap: Map<string, any>, fields: string[], title: string) => React.ReactNode;
  isFieldDirty: (obj: any, panelKey: string, field: string) => boolean;
  openBuilderForField: (obj: any, panelKey: string, field: string) => void;
  isFieldLockedByBuilder: (panelKey: string, field: string) => boolean;
  getEffectiveEventValue: (obj: any, field: string) => any;
  getEditableValue: (value: any) => { editable: boolean; display: any };
  panelDrafts: Record<string, any>;
  handleEventInputChange: (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  renderSummary: (value: any, trapVars?: any[]) => React.ReactNode;
  renderValue: (value: any, trapVars?: any[], options?: any) => React.ReactNode;
};

export default function FcomEventPrimaryRow({
  baseFields,
  eventPanelKey,
  obj,
  overrideTargets,
  overrideValueMap,
  panelEditState,
  hasEditPermission,
  isFieldHighlighted,
  renderFieldBadges,
  overrideTooltipHoverProps,
  openRemoveOverrideModal,
  renderOverrideSummaryCard,
  isFieldDirty,
  openBuilderForField,
  isFieldLockedByBuilder,
  getEffectiveEventValue,
  getEditableValue,
  panelDrafts,
  handleEventInputChange,
  renderSummary,
  renderValue,
}: FcomEventPrimaryRowProps) {
  return (
    <div className="object-row object-row-primary">
      {baseFields.includes('Node') && (
        <div>
          <span className="label">Node</span>
          <span className="value">{renderValue(obj?.event?.Node, obj?.trap?.variables)}</span>
        </div>
      )}
      {baseFields.includes('Summary') && (
        <div>
          <div className="field-header">
            <div className="field-header-main">
              <span className={isFieldHighlighted(eventPanelKey, 'Summary')
                ? 'label label-warning'
                : 'label'}>
                Summary
              </span>
              {renderFieldBadges(eventPanelKey, 'Summary', obj, overrideTargets)}
              {overrideTargets.has('$.event.Summary') && (
                <div
                  className="override-summary"
                  tabIndex={0}
                  {...overrideTooltipHoverProps}
                >
                  <span
                    className="pill override-pill pill-inline pill-action"
                  >
                    Override
                    {hasEditPermission && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.Summary') && (
                      <button
                        type="button"
                        className="pill-close"
                        aria-label="Remove Summary override"
                        onClick={() => openRemoveOverrideModal(obj, 'Summary', eventPanelKey)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  {renderOverrideSummaryCard(
                    obj,
                    overrideValueMap,
                    ['Summary'],
                    'Override',
                  )}
                </div>
              )}
              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'Summary') && (
                <span className="dirty-indicator" title="Unsaved change">✎</span>
              )}
            </div>
            {panelEditState[eventPanelKey] && (
              <button
                type="button"
                className="builder-link builder-link-iconic"
                onClick={() => openBuilderForField(obj, eventPanelKey, 'Summary')}
                disabled={isFieldLockedByBuilder(eventPanelKey, 'Summary')}
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
          {panelEditState[eventPanelKey] ? (
            (() => {
              const value = getEffectiveEventValue(obj, 'Summary');
              const editable = getEditableValue(value);
              return (
                <input
                  className={isFieldHighlighted(eventPanelKey, 'Summary')
                    ? 'panel-input panel-input-warning'
                    : 'panel-input'}
                  value={panelDrafts?.[eventPanelKey]?.event?.Summary ?? ''}
                  onChange={(e) => handleEventInputChange(
                    obj,
                    eventPanelKey,
                    'Summary',
                    e.target.value,
                    e.target.selectionStart,
                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                  )}
                  disabled={!editable.editable || isFieldLockedByBuilder(eventPanelKey, 'Summary')}
                  title={
                    !editable.editable
                      ? 'Eval values cannot be edited yet'
                      : isFieldLockedByBuilder(eventPanelKey, 'Summary')
                        ? 'Finish or cancel the builder to edit other fields'
                        : ''
                  }
                />
              );
            })()
          ) : (
            <span className="value">
              {renderSummary(
                overrideValueMap.get('$.event.Summary') ?? obj?.event?.Summary,
                obj?.trap?.variables,
              )}
            </span>
          )}
        </div>
      )}
      {baseFields.includes('Severity') && (
        <div>
          <div className="field-header">
            <div className="field-header-main">
              <span className={isFieldHighlighted(eventPanelKey, 'Severity')
                ? 'label label-warning'
                : 'label'}>
                Severity
              </span>
              {renderFieldBadges(eventPanelKey, 'Severity', obj, overrideTargets)}
              {overrideTargets.has('$.event.Severity') && (
                <div
                  className="override-summary"
                  tabIndex={0}
                  {...overrideTooltipHoverProps}
                >
                  <span
                    className="pill override-pill pill-inline pill-action"
                  >
                    Override
                    {hasEditPermission && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.Severity') && (
                      <button
                        type="button"
                        className="pill-close"
                        aria-label="Remove Severity override"
                        onClick={() => openRemoveOverrideModal(obj, 'Severity', eventPanelKey)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  {renderOverrideSummaryCard(
                    obj,
                    overrideValueMap,
                    ['Severity'],
                    'Override',
                  )}
                </div>
              )}
              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'Severity') && (
                <span className="dirty-indicator" title="Unsaved change">✎</span>
              )}
            </div>
            {panelEditState[eventPanelKey] && (
              <button
                type="button"
                className="builder-link builder-link-iconic"
                onClick={() => openBuilderForField(obj, eventPanelKey, 'Severity')}
                disabled={isFieldLockedByBuilder(eventPanelKey, 'Severity')}
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
          {panelEditState[eventPanelKey] ? (
            <input
              className={isFieldHighlighted(eventPanelKey, 'Severity')
                ? 'panel-input panel-input-warning'
                : 'panel-input'}
              value={panelDrafts?.[eventPanelKey]?.event?.Severity ?? ''}
              onChange={(e) => handleEventInputChange(
                obj,
                eventPanelKey,
                'Severity',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
              disabled={isFieldLockedByBuilder(eventPanelKey, 'Severity')}
              title={isFieldLockedByBuilder(eventPanelKey, 'Severity')
                ? 'Finish or cancel the builder to edit other fields'
                : ''}
            />
          ) : (
            <span className="value">
              {renderValue(
                overrideValueMap.get('$.event.Severity') ?? obj?.event?.Severity,
                obj?.trap?.variables,
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
