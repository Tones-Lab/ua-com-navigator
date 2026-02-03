import React from 'react';

type FcomEventSecondaryRowProps = {
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
  panelDrafts: Record<string, any>;
  handleEventInputChange: (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  renderValue: (value: any, trapVars?: any[], options?: any) => React.ReactNode;
};

export default function FcomEventSecondaryRow({
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
              <span className={isFieldHighlighted(eventPanelKey, 'EventType')
                ? 'label label-warning'
                : 'label'}>
                Event Type
              </span>
              {renderFieldBadges(eventPanelKey, 'EventType', obj, overrideTargets)}
              {overrideTargets.has('$.event.EventType') && (
                <div
                  className="override-summary"
                  tabIndex={0}
                  {...overrideTooltipHoverProps}
                >
                  <span
                    className="pill override-pill pill-inline pill-action"
                  >
                    Override
                    {hasEditPermission && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.EventType') && (
                      <button
                        type="button"
                        className="pill-close"
                        aria-label="Remove EventType override"
                        onClick={() => openRemoveOverrideModal(obj, 'EventType', eventPanelKey)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  {renderOverrideSummaryCard(
                    obj,
                    overrideValueMap,
                    ['EventType'],
                    'Override',
                  )}
                </div>
              )}
              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'EventType') && (
                <span className="dirty-indicator" title="Unsaved change">✎</span>
              )}
            </div>
            {panelEditState[eventPanelKey] && (
              <button
                type="button"
                className="builder-link builder-link-iconic"
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
              </button>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            <input
              className={isFieldHighlighted(eventPanelKey, 'EventType')
                ? 'panel-input panel-input-warning'
                : 'panel-input'}
              value={panelDrafts?.[eventPanelKey]?.event?.EventType ?? ''}
              onChange={(e) => handleEventInputChange(
                obj,
                eventPanelKey,
                'EventType',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
              disabled={isFieldLockedByBuilder(eventPanelKey, 'EventType')}
              title={isFieldLockedByBuilder(eventPanelKey, 'EventType')
                ? 'Finish or cancel the builder to edit other fields'
                : ''}
            />
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
              <span className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                ? 'label label-warning'
                : 'label'}>
                Expire Time
              </span>
              {renderFieldBadges(eventPanelKey, 'ExpireTime', obj, overrideTargets)}
              {overrideTargets.has('$.event.ExpireTime') && (
                <div
                  className="override-summary"
                  tabIndex={0}
                  {...overrideTooltipHoverProps}
                >
                  <span
                    className="pill override-pill pill-inline pill-action"
                  >
                    Override
                    {hasEditPermission && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.ExpireTime') && (
                      <button
                        type="button"
                        className="pill-close"
                        aria-label="Remove ExpireTime override"
                        onClick={() => openRemoveOverrideModal(obj, 'ExpireTime', eventPanelKey)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  {renderOverrideSummaryCard(
                    obj,
                    overrideValueMap,
                    ['ExpireTime'],
                    'Override',
                  )}
                </div>
              )}
              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'ExpireTime') && (
                <span className="dirty-indicator" title="Unsaved change">✎</span>
              )}
            </div>
            {panelEditState[eventPanelKey] && (
              <button
                type="button"
                className="builder-link builder-link-iconic"
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
              </button>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            <input
              className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                ? 'panel-input panel-input-warning'
                : 'panel-input'}
              value={panelDrafts?.[eventPanelKey]?.event?.ExpireTime ?? ''}
              onChange={(e) => handleEventInputChange(
                obj,
                eventPanelKey,
                'ExpireTime',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
              disabled={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')}
              title={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')
                ? 'Finish or cancel the builder to edit other fields'
                : ''}
            />
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
              <span className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                ? 'label label-warning'
                : 'label'}>
                Event Category
              </span>
              {renderFieldBadges(eventPanelKey, 'EventCategory', obj, overrideTargets)}
              {overrideTargets.has('$.event.EventCategory') && (
                <div
                  className="override-summary"
                  tabIndex={0}
                  {...overrideTooltipHoverProps}
                >
                  <span
                    className="pill override-pill pill-inline pill-action"
                  >
                    Override
                    {hasEditPermission && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.EventCategory') && (
                      <button
                        type="button"
                        className="pill-close"
                        aria-label="Remove EventCategory override"
                        onClick={() => openRemoveOverrideModal(obj, 'EventCategory', eventPanelKey)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  {renderOverrideSummaryCard(
                    obj,
                    overrideValueMap,
                    ['EventCategory'],
                    'Override',
                  )}
                </div>
              )}
              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'EventCategory') && (
                <span className="dirty-indicator" title="Unsaved change">✎</span>
              )}
            </div>
            {panelEditState[eventPanelKey] && (
              <button
                type="button"
                className="builder-link builder-link-iconic"
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
              </button>
            )}
          </div>
          {panelEditState[eventPanelKey] ? (
            <input
              className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                ? 'panel-input panel-input-warning'
                : 'panel-input'}
              value={panelDrafts?.[eventPanelKey]?.event?.EventCategory ?? ''}
              onChange={(e) => handleEventInputChange(
                obj,
                eventPanelKey,
                'EventCategory',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
              disabled={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')}
              title={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')
                ? 'Finish or cancel the builder to edit other fields'
                : ''}
            />
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
      <div>
        <span className="label">OID</span>
        <span className="value monospace">{renderValue(obj?.trap?.oid)}</span>
      </div>
    </div>
  );
}
