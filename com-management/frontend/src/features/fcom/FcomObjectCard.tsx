import type { ReactNode } from 'react';
import FcomEventAdditionalFields from './FcomEventAdditionalFields';

type FcomObjectCardProps = {
  obj: any;
  idx: number;
  objectKey: string;
  highlightObjectKeys: string[];
  searchHighlightActive: boolean;
  registerObjectRowRef: (key: string, node: HTMLDivElement | null) => void;
  matchPingKey: string | null;
  getOverrideFlags: (obj: any) => any;
  getOverrideTargets: (obj: any) => Set<string>;
  getProcessorTargets: (obj: any) => Set<string>;
  getProcessorFieldSummary: (obj: any, field: string) => string;
  getOverrideValueMap: (obj: any) => Map<string, any>;
  getEventOverrideFields: (obj: any) => string[];
  panelEditState: Record<string, boolean>;
  getPanelDirtyFields: (obj: any, panelKey: string) => string[];
  getBaseEventFields: (obj: any, panelKey: string) => string[];
  hasEditPermission: boolean;
  showTestControls: boolean;
  openTrapComposerFromTest: (obj: any) => void;
  getObjectDescription: (obj: any) => string;
  isTestableObject: (obj: any) => boolean;
  startEventEdit: (obj: any, panelKey: string) => void;
  openRemoveAllOverridesModal: (obj: any, panelKey: string) => void;
  openAddFieldModal: (panelKey: string, obj: any) => void;
  builderTarget: { panelKey: string; field: string } | null;
  saveEventEdit: (obj: any, panelKey: string) => void;
  requestCancelEventEdit: (obj: any, panelKey: string) => void;
  isFieldHighlighted: (panelKey: string, field: string) => boolean;
  renderFieldBadges: (panelKey: string, field: string, obj: any, overrideTargets: Set<string>) => ReactNode;
  overrideTooltipHoverProps: any;
  openRemoveOverrideModal: (obj: any, field: string, panelKey: string) => void;
  renderOverrideSummaryCard: (obj: any, overrideValueMap: Map<string, any>, fields: string[], title: string) => ReactNode;
  isFieldDirty: (obj: any, panelKey: string, field: string) => boolean;
  isFieldPendingRemoval: (panelKey: string, field: string) => boolean;
  isFieldNew: (obj: any, field: string) => boolean;
  getStagedDirtyFields: (obj: any) => string[];
  isFieldStagedDirty: (obj: any, field: string) => boolean;
  isFieldStagedRemoved: (obj: any, field: string) => boolean;
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
  renderSummary: (value: any, trapVars?: any[]) => ReactNode;
  renderValue: (value: any, trapVars?: any[], options?: any) => ReactNode;
  getAdditionalEventFields: (obj: any, panelKey: string) => string[];
  getEventFieldDescription: (field: string) => string;
  formatEventFieldLabel: (field: string) => string;
  getBaseEventDisplay: (obj: any, field: string) => string;
  renderTrapVariables: (vars: any) => ReactNode;
};

export default function FcomObjectCard({
  obj,
  idx,
  objectKey,
  highlightObjectKeys,
  searchHighlightActive,
  registerObjectRowRef,
  matchPingKey,
  getOverrideFlags,
  getOverrideTargets,
  getProcessorTargets,
  getProcessorFieldSummary,
  getOverrideValueMap,
  getEventOverrideFields,
  panelEditState,
  getPanelDirtyFields,
  getBaseEventFields,
  hasEditPermission,
  showTestControls,
  openTrapComposerFromTest,
  getObjectDescription,
  isTestableObject,
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
  isFieldPendingRemoval,
  isFieldNew,
  getStagedDirtyFields,
  isFieldStagedDirty,
  isFieldStagedRemoved,
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
  const processorFieldKeys = (() => {
    if (!obj || typeof obj !== 'object') {
      return [] as string[];
    }
    const keys = Object.keys(obj).filter((key) => /processor/i.test(key));
    if (keys.length === 0) {
      return [] as string[];
    }
    const preferredOrder = [
      'preProcessors',
      'preprocessors',
      'postProcessors',
      'postprocessors',
      'processors',
      'processor',
    ];
    const ordered: string[] = [];
    preferredOrder.forEach((key) => {
      if (keys.includes(key)) {
        ordered.push(key);
      }
    });
    keys.forEach((key) => {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    });
    return ordered;
  })();

  const overrideFlags = getOverrideFlags(obj);
  const overrideTargets = getOverrideTargets(obj);
  const processorTargets = getProcessorTargets(obj);
  const overrideValueMap = getOverrideValueMap(obj);
  const eventPanelKey = `${objectKey}:event`;
  const eventOverrideFields = getEventOverrideFields(obj);
  const panelDirtyFields = panelEditState[eventPanelKey]
    ? getPanelDirtyFields(obj, eventPanelKey)
    : [];
  const stagedDirtyFields = panelEditState[eventPanelKey]
    ? []
    : getStagedDirtyFields(obj);
  const unsavedCount = panelEditState[eventPanelKey]
    ? panelDirtyFields.length
    : stagedDirtyFields.length;
  const baseFields = getBaseEventFields(obj, eventPanelKey);
  const additionalFields = getAdditionalEventFields(obj, eventPanelKey);
  const eventFields = [...baseFields, ...additionalFields];
  const objectDescription = getObjectDescription(obj);

  return (
    <div
      ref={(node) => registerObjectRowRef(objectKey, node)}
      className={`object-card${highlightObjectKeys.includes(objectKey)
        ? ' object-card-highlight'
        : ''}${searchHighlightActive && highlightObjectKeys.length > 0 &&
          !highlightObjectKeys.includes(objectKey)
          ? ' object-card-dim'
          : ''}${matchPingKey === objectKey ? ' object-card-ping' : ''}`}
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
          {objectDescription && (
            <div className="object-description">{objectDescription}</div>
          )}
        </div>
        <div className="object-actions">
          {showTestControls && (
            <button
              type="button"
              className="panel-edit-button"
              onClick={() => openTrapComposerFromTest(obj)}
              disabled={!isTestableObject(obj)}
              title={isTestableObject(obj)
                ? 'Send a test trap for this object'
                : 'No test command found in this object'}
            >
              Test trap
            </button>
          )}
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
            {unsavedCount > 0 && (
              <span className="pill unsaved-pill">
                Unsaved ({unsavedCount})
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
          <FcomEventAdditionalFields
            additionalFields={eventFields}
            eventPanelKey={eventPanelKey}
            obj={obj}
            overrideTargets={overrideTargets}
            processorTargets={processorTargets}
            getProcessorFieldSummary={getProcessorFieldSummary}
            overrideValueMap={overrideValueMap}
            panelEditState={panelEditState}
            hasEditPermission={hasEditPermission}
            isFieldHighlighted={isFieldHighlighted}
            renderFieldBadges={renderFieldBadges}
            overrideTooltipHoverProps={overrideTooltipHoverProps}
            openRemoveOverrideModal={openRemoveOverrideModal}
            renderOverrideSummaryCard={renderOverrideSummaryCard}
            isFieldDirty={isFieldDirty}
            isFieldPendingRemoval={isFieldPendingRemoval}
            isFieldNew={isFieldNew}
            isFieldStagedDirty={isFieldStagedDirty}
            isFieldStagedRemoved={isFieldStagedRemoved}
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
      {processorFieldKeys.map((key) => (
        <div
          key={`${objectKey}:${key}`}
          className={`object-panel${panelEditState[`${objectKey}:${key}`]
            ? ' object-panel-editing'
            : ''}`}
        >
          <div className="object-panel-header">
            <span className="object-panel-title">{key}</span>
          </div>
          <div className="object-panel-body">
            {renderValue((obj as any)?.[key])}
          </div>
        </div>
      ))}
      {Array.isArray(obj?.trap?.variables) && obj.trap.variables.length > 0 ? (
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
      ) : null}
    </div>
  );
}
