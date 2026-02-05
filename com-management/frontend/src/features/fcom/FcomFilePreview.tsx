import type { ReactNode, RefObject } from 'react';
import FcomObjectCard from './FcomObjectCard';
import FcomRawPreview from './FcomRawPreview';
import FcomMatchBar from './FcomMatchBar';

type FcomFilePreviewProps = {
  selectedFile: any | null;
  fileLoading: boolean;
  viewMode: 'friendly' | 'preview';
  isAnyPanelEditing: boolean;
  friendlyViewRef: RefObject<HTMLDivElement>;
  friendlyMainRef: RefObject<HTMLDivElement>;
  handleFileScroll: () => void;
  searchHighlightActive: boolean;
  highlightObjectKeys: string[];
  currentMatchIndex: number;
  matchObjectOptions: Array<{ key: string; label: string }>;
  handleJumpToMatch: (key: string) => void;
  handlePrevMatch: () => void;
  handleNextMatch: () => void;
  overrideObjectKeys: string[];
  overrideMatchIndex: number;
  overrideObjectOptions: Array<{ key: string; label: string }>;
  handlePrevOverride: () => void;
  handleNextOverride: () => void;
  handleJumpToOverride: (key: string) => void;
  matchPingKey: string | null;
  getFriendlyObjects: (data: any) => any[];
  fileData: any;
  getOverrideFlags: (obj: any) => any;
  getOverrideTargets: (obj: any) => Set<string>;
  getProcessorTargets: (obj: any) => Set<string>;
  getProcessorFieldSummary: (obj: any, field: string) => string;
  getOverrideValueMap: (obj: any) => Map<string, any>;
  getObjectKey: (obj: any, idx: number) => string;
  registerObjectRowRef: (key: string, node: HTMLDivElement | null) => void;
  getEventOverrideFields: (obj: any) => string[];
  panelEditState: Record<string, boolean>;
  getPanelDirtyFields: (obj: any, panelKey: string) => string[];
  getBaseEventFields: (obj: any, panelKey: string) => string[];
  hasEditPermission: boolean;
  showTestControls: boolean;
  isTrapFileContext: boolean;
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
  builderSidebar: ReactNode;
  rawMatchPositions: number[];
  rawMatchIndex: number;
  handlePrevRawMatch: () => void;
  handleNextRawMatch: () => void;
  rawPreviewText: string;
  highlightQuery: string | null;
  renderRawHighlightedText: (text: string, query: string) => ReactNode;
};

export default function FcomFilePreview({
  selectedFile,
  fileLoading,
  viewMode,
  isAnyPanelEditing,
  friendlyViewRef,
  friendlyMainRef,
  handleFileScroll,
  searchHighlightActive,
  highlightObjectKeys,
  currentMatchIndex,
  matchObjectOptions,
  handleJumpToMatch,
  handlePrevMatch,
  handleNextMatch,
  overrideObjectKeys,
  overrideMatchIndex,
  overrideObjectOptions,
  handlePrevOverride,
  handleNextOverride,
  handleJumpToOverride,
  matchPingKey,
  getFriendlyObjects,
  fileData,
  getOverrideFlags,
  getOverrideTargets,
  getProcessorTargets,
  getProcessorFieldSummary,
  getOverrideValueMap,
  getObjectKey,
  registerObjectRowRef,
  getEventOverrideFields,
  panelEditState,
  getPanelDirtyFields,
  getBaseEventFields,
  hasEditPermission,
  showTestControls,
  isTrapFileContext,
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
  builderSidebar,
  rawMatchPositions,
  rawMatchIndex,
  handlePrevRawMatch,
  handleNextRawMatch,
  rawPreviewText,
  highlightQuery,
  renderRawHighlightedText,
}: FcomFilePreviewProps) {
  const friendlyObjects = getFriendlyObjects(fileData);
  return (
    <div className="file-preview">
      {!selectedFile ? (
        <div className="empty-state">Select a file on the left to view and edit.</div>
      ) : fileLoading ? (
        <div>Loading preview…</div>
      ) : viewMode === 'friendly' ? (
        <div
          className={isAnyPanelEditing ? 'friendly-layout' : 'friendly-view'}
          ref={friendlyViewRef}
          onScroll={handleFileScroll}
        >
          <div
            className={isAnyPanelEditing ? 'friendly-main' : ''}
            ref={friendlyMainRef}
            onScroll={handleFileScroll}
          >
            {searchHighlightActive && highlightObjectKeys.length > 0 && (
              <FcomMatchBar
                label={`Match ${currentMatchIndex + 1} of ${highlightObjectKeys.length}`}
                onPrev={handlePrevMatch}
                onNext={handleNextMatch}
              >
                {matchObjectOptions.length > 0 && (
                  <label className="match-jump">
                    <span className="match-jump-label">Jump to</span>
                    <select
                      value={highlightObjectKeys[currentMatchIndex] || ''}
                      onChange={(e) => handleJumpToMatch(e.target.value)}
                    >
                      {matchObjectOptions.map((option, index) => (
                        <option key={option.key} value={option.key}>
                          {index + 1}. {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </FcomMatchBar>
            )}
            {overrideObjectKeys.length > 0 && (
              <FcomMatchBar
                label={`Override ${overrideMatchIndex + 1} of ${overrideObjectKeys.length}`}
                onPrev={handlePrevOverride}
                onNext={handleNextOverride}
              >
                {overrideObjectOptions.length > 0 && (
                  <label className="match-jump">
                    <span className="match-jump-label">Jump to</span>
                    <select
                      value={overrideObjectKeys[overrideMatchIndex] || ''}
                      onChange={(e) => handleJumpToOverride(e.target.value)}
                    >
                      {overrideObjectOptions.map((option, index) => (
                        <option key={option.key} value={option.key}>
                          {index + 1}. {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </FcomMatchBar>
            )}
            {friendlyObjects.length === 0 ? (
              <div className="empty-state">No objects found.</div>
            ) : (
              friendlyObjects.map((obj: any, idx: number) => {
                const objectKey = getObjectKey(obj, idx);
                return (
                  <FcomObjectCard
                    key={obj?.['@objectName'] || idx}
                    registerObjectRowRef={registerObjectRowRef}
                    obj={obj}
                    idx={idx}
                    objectKey={objectKey}
                    matchPingKey={matchPingKey}
                    highlightObjectKeys={highlightObjectKeys}
                    searchHighlightActive={searchHighlightActive}
                    getOverrideFlags={getOverrideFlags}
                    getOverrideTargets={getOverrideTargets}
                    getProcessorTargets={getProcessorTargets}
                    getProcessorFieldSummary={getProcessorFieldSummary}
                    getOverrideValueMap={getOverrideValueMap}
                    getEventOverrideFields={getEventOverrideFields}
                    panelEditState={panelEditState}
                    getPanelDirtyFields={getPanelDirtyFields}
                    getBaseEventFields={getBaseEventFields}
                    hasEditPermission={hasEditPermission}
                    showTestControls={showTestControls}
                    isTrapFileContext={isTrapFileContext}
                    openTrapComposerFromTest={openTrapComposerFromTest}
                    getObjectDescription={getObjectDescription}
                    isTestableObject={isTestableObject}
                    startEventEdit={startEventEdit}
                    openRemoveAllOverridesModal={openRemoveAllOverridesModal}
                    openAddFieldModal={openAddFieldModal}
                    builderTarget={builderTarget}
                    saveEventEdit={saveEventEdit}
                    requestCancelEventEdit={requestCancelEventEdit}
                    isFieldHighlighted={isFieldHighlighted}
                    renderFieldBadges={renderFieldBadges}
                    overrideTooltipHoverProps={overrideTooltipHoverProps}
                    openRemoveOverrideModal={openRemoveOverrideModal}
                    renderOverrideSummaryCard={renderOverrideSummaryCard}
                    isFieldDirty={isFieldDirty}
                    isFieldPendingRemoval={isFieldPendingRemoval}
                    isFieldNew={isFieldNew}
                    getStagedDirtyFields={getStagedDirtyFields}
                    isFieldStagedDirty={isFieldStagedDirty}
                    isFieldStagedRemoved={isFieldStagedRemoved}
                    openBuilderForField={openBuilderForField}
                    isFieldLockedByBuilder={isFieldLockedByBuilder}
                    getEffectiveEventValue={getEffectiveEventValue}
                    getEditableValue={getEditableValue}
                    panelDrafts={panelDrafts}
                    handleEventInputChange={handleEventInputChange}
                    renderSummary={renderSummary}
                    renderValue={renderValue}
                    getAdditionalEventFields={getAdditionalEventFields}
                    getEventFieldDescription={getEventFieldDescription}
                    formatEventFieldLabel={formatEventFieldLabel}
                    getBaseEventDisplay={getBaseEventDisplay}
                    renderTrapVariables={renderTrapVariables}
                  />
                );
              })
            )}
          </div>
          {builderSidebar}
        </div>
      ) : (
        <FcomRawPreview
          searchHighlightActive={searchHighlightActive}
          highlightQuery={highlightQuery}
          rawMatchPositions={rawMatchPositions}
          rawMatchIndex={rawMatchIndex}
          handlePrevRawMatch={handlePrevRawMatch}
          handleNextRawMatch={handleNextRawMatch}
          rawPreviewText={rawPreviewText}
          renderRawHighlightedText={renderRawHighlightedText}
        />
      )}
    </div>
  );
}
