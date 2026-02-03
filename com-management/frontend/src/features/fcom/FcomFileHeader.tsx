type FcomFileHeaderProps = {
  selectedFile: any | null;
  browseNode: string | null;
  isFavorite: (type: 'file' | 'folder', pathId: string) => boolean;
  toggleFavorite: (favorite: { type: 'file' | 'folder'; pathId: string; label: string; node?: string }) => void;
  formatDisplayPath: (pathId?: string | null) => string;
  schemaLoading: boolean;
  schemaError: string | null;
  validator: any;
  jsonParseError: string | null;
  validationErrors: Array<{ path: string; message: string }>;
  setShowSchemaModal: (open: boolean) => void;
  overrideInfo: any | null;
  viewMode: 'friendly' | 'preview';
  setViewMode: (mode: 'friendly' | 'preview') => void;
  openAdvancedFlowModal: (scope: 'global' | 'object', objectName?: string, focusTarget?: string | null) => void;
  hasEditPermission: boolean;
  onTestFile: () => void;
  fileTestLoading: boolean;
  fileTestLabel: string;
  reviewCtaPulse: boolean;
  setReviewStep: (step: 'review' | 'commit') => void;
  setShowReviewModal: (open: boolean) => void;
  hasStagedChanges: boolean;
  stagedDiff: { totalChanges: number; editedObjects: string[] };
  hasGlobalAdvancedFlow: boolean;
  fileError: string | null;
  saveError: string | null;
  saveSuccess: string | null;
  stagedToast: string | null;
};

export default function FcomFileHeader({
  selectedFile,
  browseNode,
  isFavorite,
  toggleFavorite,
  formatDisplayPath,
  schemaLoading,
  schemaError,
  validator,
  jsonParseError,
  validationErrors,
  setShowSchemaModal,
  overrideInfo,
  viewMode,
  setViewMode,
  openAdvancedFlowModal,
  hasEditPermission,
  onTestFile,
  fileTestLoading,
  fileTestLabel,
  reviewCtaPulse,
  setReviewStep,
  setShowReviewModal,
  hasStagedChanges,
  stagedDiff,
  hasGlobalAdvancedFlow,
  fileError,
  saveError,
  saveSuccess,
  stagedToast,
}: FcomFileHeaderProps) {
  return (
    <>
      <div className="file-title">
        <strong>
          {selectedFile?.PathName || 'Select a file'}
          {selectedFile && (
            <button
              type="button"
              className={isFavorite(selectedFile.PathID, 'file')
                ? 'star-button star-active'
                : 'star-button'}
              onClick={() => toggleFavorite({
                type: 'file',
                pathId: selectedFile.PathID,
                label: selectedFile.PathName,
                node: browseNode || undefined,
              })}
              aria-label="Toggle favorite file"
              title="Toggle favorite file"
            >
              ★
            </button>
          )}
        </strong>
        {selectedFile?.PathID && (
          <span className="file-path">{formatDisplayPath(selectedFile.PathID)}</span>
        )}
      </div>
      <div className="file-meta-row">
        <span className="schema-status">
          {schemaLoading && <span>Schema: Loading…</span>}
          {schemaError && (
            <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
              Schema: Error
            </button>
          )}
          {!schemaLoading && !schemaError && !validator && (
            <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
              Schema: Not available
            </button>
          )}
          {!schemaLoading && !schemaError && validator && !jsonParseError && validationErrors.length === 0 && (
            <span className="schema-valid" aria-label="Schema validated">
              Schema: ✓
            </span>
          )}
          {!schemaLoading && !schemaError && validator && (jsonParseError || validationErrors.length > 0) && (
            <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
              Schema: {jsonParseError ? 'JSON error' : `${validationErrors.length} issue(s)`}
            </button>
          )}
        </span>
      </div>
      {overrideInfo?.overrideMeta?.pathName
        && Array.isArray(overrideInfo?.overrides)
        && overrideInfo.overrides.length > 0 && (
        <div className="override-meta-row">
          <span>
            Override file: {overrideInfo?.overrideMeta?.pathName || overrideInfo?.overrideFileName || '—'}
          </span>
          <span>
            Revision:{' '}
            {overrideInfo?.overrideMeta?.revision && /^[0-9]+$/.test(String(overrideInfo.overrideMeta.revision))
              ? `r${overrideInfo.overrideMeta.revision}`
              : overrideInfo?.overrideMeta?.revision || '—'}
          </span>
          <span>Modified: {overrideInfo?.overrideMeta?.modified || '—'}</span>
          <span>Modified by: {overrideInfo?.overrideMeta?.modifiedBy || '—'}</span>
        </div>
      )}
      <div className="action-row">
        {selectedFile ? (
          <>
            <div className="view-toggle">
              <span className={viewMode === 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                Friendly
              </span>
              <label className="switch" aria-label="Toggle friendly/raw view">
                <input
                  type="checkbox"
                  checked={viewMode !== 'friendly'}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setViewMode('preview');
                    } else {
                      setViewMode('friendly');
                    }
                  }}
                />
                <span className="slider" />
              </label>
              <span className={viewMode !== 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                Raw
              </span>
            </div>
            <button
              type="button"
              className="action-link"
              onClick={onTestFile}
              disabled={!hasEditPermission || fileTestLoading}
              title={hasEditPermission
                ? ''
                : 'Read-only access'}
            >
              {fileTestLoading
                ? 'Testing…'
                : fileTestLabel
                  ? `Test All ${fileTestLabel} SNMP Traps`
                  : 'Test SNMP File'}
            </button>
            <button
              type="button"
              className="action-link"
              onClick={() => {
                openAdvancedFlowModal('global');
              }}
              disabled={!hasEditPermission}
              title={hasEditPermission ? '' : 'Read-only access'}
            >
              Advanced Processors (Global)
            </button>
            <button
              type="button"
              className={`action-link${reviewCtaPulse ? ' action-link-pulse' : ''}`}
              onClick={() => {
                setReviewStep('review');
                setShowReviewModal(true);
              }}
              disabled={!hasStagedChanges || !hasEditPermission}
              title={hasStagedChanges
                ? `${stagedDiff.totalChanges} staged change(s)`
                : hasEditPermission
                  ? 'No staged changes'
                  : 'Read-only access'}
            >
              Review & Save{hasStagedChanges ? ` (${stagedDiff.totalChanges})` : ''}
            </button>
            {hasGlobalAdvancedFlow && (
              <span className="pill" title="Global Advanced Flow configured">
                Advanced Flow
              </span>
            )}
            {stagedDiff.editedObjects.length > 0 && (
              <span
                className="pill"
                title={`Edited objects: ${stagedDiff.editedObjects.slice(0, 6).join(', ')}${
                  stagedDiff.editedObjects.length > 6 ? '…' : ''
                }`}
              >
                Edited objects: {stagedDiff.editedObjects.length}
              </span>
            )}
          </>
        ) : (
          <span className="muted">Select a file on the left to view and edit.</span>
        )}
      </div>
      {fileError && <div className="error">{fileError}</div>}
      {saveError && <div className="error">{saveError}</div>}
      {saveSuccess && <div className="success">{saveSuccess}</div>}
      {stagedToast && <div className="staged-toast">{stagedToast}</div>}
    </>
  );
}
