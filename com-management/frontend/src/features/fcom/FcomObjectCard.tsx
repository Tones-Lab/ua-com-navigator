import React from 'react';
import FcomEventPrimaryRow from './FcomEventPrimaryRow';
import FcomEventSecondaryRow from './FcomEventSecondaryRow';
import FcomEventAdditionalFields from './FcomEventAdditionalFields';

type FcomObjectCardProps = {
  obj: any;
  idx: number;
  objectKey: string;
  highlightObjectKeys: string[];
  searchHighlightActive: boolean;
  getOverrideFlags: (obj: any) => any;
  getOverrideTargets: (obj: any) => Set<string>;
  getOverrideValueMap: (obj: any) => Map<string, any>;
  getEventOverrideFields: (obj: any) => string[];
  panelEditState: Record<string, boolean>;
  getPanelDirtyFields: (obj: any, panelKey: string) => string[];
  getBaseEventFields: (obj: any, panelKey: string) => string[];
  hasEditPermission: boolean;
  openTrapComposerFromTest: (obj: any) => void;
  getObjectDescription: (obj: any) => string;
  startEventEdit: (obj: any, panelKey: string) => void;
  openRemoveAllOverridesModal: (obj: any, panelKey: string) => void;
  openAddFieldModal: (panelKey: string, obj: any) => void;
  builderTarget: { panelKey: string; field: string } | null;
  saveEventEdit: (obj: any, panelKey: string) => void;
  requestCancelEventEdit: (obj: any, panelKey: string) => void;
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
  getAdditionalEventFields: (obj: any, panelKey: string) => string[];
  getEventFieldDescription: (field: string) => string;
  formatEventFieldLabel: (field: string) => string;
  getBaseEventDisplay: (obj: any, field: string) => string;
  renderTrapVariables: (vars: any) => React.ReactNode;
};

export default function FcomObjectCard({
  obj,
  idx,
  objectKey,
  highlightObjectKeys,
  searchHighlightActive,
  getOverrideFlags,
  getOverrideTargets,
  getOverrideValueMap,
  getEventOverrideFields,
  panelEditState,
  getPanelDirtyFields,
  getBaseEventFields,
  hasEditPermission,
  openTrapComposerFromTest,
  getObjectDescription,
  startEventEdit,
  openRemoveAllOverridesModal,
  openAddFieldModal,
  builderTarget,
  saveEventEdit,
  requestCancelEventEdit,
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
  getAdditionalEventFields,
  getEventFieldDescription,
  formatEventFieldLabel,
  getBaseEventDisplay,
  renderTrapVariables,
}: FcomObjectCardProps) {
  const overrideFlags = getOverrideFlags(obj);
  const overrideTargets = getOverrideTargets(obj);
  const overrideValueMap = getOverrideValueMap(obj);
  const eventPanelKey = `${objectKey}:event`;
  const eventOverrideFields = getEventOverrideFields(obj);
  const panelDirtyFields = panelEditState[eventPanelKey]
    ? getPanelDirtyFields(obj, eventPanelKey)
    : [];
  const baseFields = getBaseEventFields(obj, eventPanelKey);

  return (
    <div
      className={`object-card${highlightObjectKeys.includes(objectKey)
        ? ' object-card-highlight'
        : ''}${searchHighlightActive && highlightObjectKeys.length > 0 &&
          !highlightObjectKeys.includes(objectKey)
          ? ' object-card-dim'
          : ''}`}
      key={obj?.['@objectName'] || idx}
    >
      <div className="object-header">
        <div className="object-header-main">
          <div className="object-title">
            <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
            {obj?.certification && <span className="pill">{obj.certification}</span>}
            {overrideFlags.any && <span className="pill override-pill">Override</span>}
            {overrideFlags.advancedFlow && (
              <span className="pill" title="Advanced Flow configured for this object">
                Advanced Flow
              </span>
            )}
            {highlightObjectKeys.includes(objectKey) && (
              <span className="pill match-pill">Match</span>
            )}
          </div>
          {getObjectDescription(obj) && (
            <div className="object-description">{getObjectDescription(obj)}</div>
          )}
        </div>
        <div className="object-actions">
          <button
            type="button"
            className="panel-edit-button"
            onClick={() => openTrapComposerFromTest(obj)}
          >
            Test trap
          </button>
        </div>
      </div>
      <div
        className={`object-panel${panelEditState[eventPanelKey]
          ? ' object-panel-editing'
          : ''}`}
      >
        <div className="object-panel-header">
          <div className="panel-title-group">
            <span className="object-panel-title">Event</span>
            {eventOverrideFields.length > 0 && (
              <span className="pill override-pill">
                Overrides ({eventOverrideFields.length})
              </span>
            )}
            {panelDirtyFields.length > 0 && (
              <span className="pill unsaved-pill">
                Unsaved ({panelDirtyFields.length})
              </span>
            )}
          </div>
          {hasEditPermission && !panelEditState[eventPanelKey] && (
            <button
              type="button"
              className="panel-edit-button"
              onClick={() => startEventEdit(obj, eventPanelKey)}
            >
              Edit
            </button>
          )}
          {hasEditPermission && panelEditState[eventPanelKey] && (
            <div className="panel-edit-actions">
              {eventOverrideFields.length > 1 && (
                <button
                  type="button"
                  className="override-remove-all-button"
                  onClick={() => openRemoveAllOverridesModal(obj, eventPanelKey)}
                >
                  Remove All Overrides
                </button>
              )}
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => openAddFieldModal(eventPanelKey, obj)}
                disabled={builderTarget?.panelKey === eventPanelKey}
                title={builderTarget?.panelKey === eventPanelKey
                  ? 'Finish or cancel the builder to add fields'
                  : ''}
              >
                Add Field
              </button>
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => saveEventEdit(obj, eventPanelKey)}
                disabled={panelDirtyFields.length === 0}
                title={panelDirtyFields.length === 0
                  ? 'No changes to save'
                  : ''}
              >
                Save
              </button>
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => requestCancelEventEdit(obj, eventPanelKey)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="object-grid">
          <FcomEventPrimaryRow
            baseFields={baseFields}
            eventPanelKey={eventPanelKey}
            obj={obj}
            overrideTargets={overrideTargets}
            overrideValueMap={overrideValueMap}
            panelEditState={panelEditState}
            hasEditPermission={hasEditPermission}
            isFieldHighlighted={isFieldHighlighted}
            renderFieldBadges={renderFieldBadges}
            overrideTooltipHoverProps={overrideTooltipHoverProps}
            openRemoveOverrideModal={openRemoveOverrideModal}
            renderOverrideSummaryCard={renderOverrideSummaryCard}
            isFieldDirty={isFieldDirty}
            openBuilderForField={openBuilderForField}
            isFieldLockedByBuilder={isFieldLockedByBuilder}
            getEffectiveEventValue={getEffectiveEventValue}
            getEditableValue={getEditableValue}
            panelDrafts={panelDrafts}
            handleEventInputChange={handleEventInputChange}
            renderSummary={renderSummary}
            renderValue={renderValue}
          />
          <FcomEventSecondaryRow
            baseFields={baseFields}
            eventPanelKey={eventPanelKey}
            obj={obj}
            overrideTargets={overrideTargets}
            overrideValueMap={overrideValueMap}
            panelEditState={panelEditState}
            hasEditPermission={hasEditPermission}
            isFieldHighlighted={isFieldHighlighted}
            renderFieldBadges={renderFieldBadges}
            overrideTooltipHoverProps={overrideTooltipHoverProps}
            openRemoveOverrideModal={openRemoveOverrideModal}
            renderOverrideSummaryCard={renderOverrideSummaryCard}
            isFieldDirty={isFieldDirty}
            openBuilderForField={openBuilderForField}
            isFieldLockedByBuilder={isFieldLockedByBuilder}
            panelDrafts={panelDrafts}
            handleEventInputChange={handleEventInputChange}
            renderValue={renderValue}
          />
          <FcomEventAdditionalFields
            additionalFields={getAdditionalEventFields(obj, eventPanelKey)}
            eventPanelKey={eventPanelKey}
            obj={obj}
            overrideTargets={overrideTargets}
            overrideValueMap={overrideValueMap}
            panelEditState={panelEditState}
            hasEditPermission={hasEditPermission}
            isFieldHighlighted={isFieldHighlighted}
            renderFieldBadges={renderFieldBadges}
            overrideTooltipHoverProps={overrideTooltipHoverProps}
            openRemoveOverrideModal={openRemoveOverrideModal}
            renderOverrideSummaryCard={renderOverrideSummaryCard}
            isFieldDirty={isFieldDirty}
            openBuilderForField={openBuilderForField}
            isFieldLockedByBuilder={isFieldLockedByBuilder}
            panelDrafts={panelDrafts}
            handleEventInputChange={handleEventInputChange}
            renderValue={renderValue}
            getEventFieldDescription={getEventFieldDescription}
            formatEventFieldLabel={formatEventFieldLabel}
            getBaseEventDisplay={getBaseEventDisplay}
          />
        </div>
      </div>
      <div
        className={`object-panel${panelEditState[`${objectKey}:pre`]
          ? ' object-panel-editing'
          : ''}`}
      >
        <div className="object-panel-header">
          <span className="object-panel-title">PreProcessors</span>
        </div>
        <div className="object-panel-body">
          {renderValue(obj?.preProcessors)}
        </div>
      </div>
      <div
        className={`object-panel${panelEditState[`${objectKey}:trap`]
          ? ' object-panel-editing'
          : ''}`}
      >
        <div className="object-panel-header">
          <span className="object-panel-title">Trap Variables</span>
        </div>
        <div className="object-panel-body">
          {renderTrapVariables(obj?.trap?.variables)}
        </div>
      </div>
    </div>
  );
}
