type FcomFileHeaderProps = {
  selectedFile: any | null;
  browseNode: string | null;
  isFavorite: (type: 'file' | 'folder', pathId: string) => boolean;
  toggleFavorite: (favorite: {
    type: 'file' | 'folder';
    pathId: string;
    label: string;
    node?: string;
  }) => void;
  formatDisplayPath: (pathId?: string | null) => string;
  fileMethod: string | null;
  fileSubMethod: string | null;
  overrideInfo: any | null;
  overrideError: string | null;
  hasLocalOverrides: boolean;
  viewMode: 'friendly' | 'preview';
  setViewMode: (mode: 'friendly' | 'preview') => void;
  openAdvancedFlowModal: (
    scope: 'global' | 'object',
    objectName?: string,
    focusTarget?: string | null,
  ) => void;
  hasEditPermission: boolean;
  showTestControls: boolean;
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
  highlightQuery: string | null;
  highlightFileName: boolean;
  fileNamePingActive: boolean;
};

export default function FcomFileHeader({
  selectedFile,
  browseNode,
  isFavorite,
  toggleFavorite,
  formatDisplayPath,
  fileMethod,
  fileSubMethod,
  overrideInfo,
  overrideError,
  hasLocalOverrides,
  viewMode,
  setViewMode,
  openAdvancedFlowModal,
  hasEditPermission,
  showTestControls,
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
  highlightQuery,
  highlightFileName,
  fileNamePingActive,
}: FcomFileHeaderProps) {
  const renderHighlightedText = (text: string) => {
    if (!highlightQuery || !highlightFileName) {
      return text;
    }
    const query = highlightQuery.trim();
    if (!query) {
      return text;
    }
    const lower = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lower.includes(lowerQuery)) {
      return text;
    }
    const parts: JSX.Element[] = [];
    let start = 0;
    while (true) {
      const idx = lower.indexOf(lowerQuery, start);
      if (idx === -1) {
        break;
      }
      if (idx > start) {
        parts.push(<span key={`text-${idx}`}>{text.slice(start, idx)}</span>);
      }
      parts.push(
        <span
          key={`match-${idx}`}
          className={`match-highlight${fileNamePingActive ? ' match-highlight-ping' : ''}`}
        >
          {text.slice(idx, idx + query.length)}
        </span>,
      );
      start = idx + query.length;
    }
    if (start < text.length) {
      parts.push(<span key="text-end">{text.slice(start)}</span>);
    }
    return parts;
  };
  return (
    <>
      <div className="file-title">
        <strong>
          {selectedFile?.PathName ? renderHighlightedText(selectedFile.PathName) : 'Select a file'}
          {selectedFile && (
            <button
              type="button"
              className={
                isFavorite(selectedFile.PathID, 'file') ? 'star-button star-active' : 'star-button'
              }
              onClick={() =>
                toggleFavorite({
                  type: 'file',
                  pathId: selectedFile.PathID,
                  label: selectedFile.PathName,
                  node: browseNode || undefined,
                })
              }
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
      {(fileMethod || fileSubMethod) && (
        <div className="file-meta-row">
          {fileMethod && <span>Method: {fileMethod}</span>}
          {fileSubMethod && <span>SubMethod: {fileSubMethod}</span>}
        </div>
      )}
      {overrideInfo?.overrideMeta?.pathName && hasLocalOverrides && (
        <div className="override-meta-row">
          <span>
            Override file:{' '}
            {overrideInfo?.overrideMeta?.pathName || overrideInfo?.overrideFileName || '—'}
          </span>
          <span>
            Revision:{' '}
            {overrideInfo?.overrideMeta?.revision &&
            /^[0-9]+$/.test(String(overrideInfo.overrideMeta.revision))
              ? `r${overrideInfo.overrideMeta.revision}`
              : overrideInfo?.overrideMeta?.revision || '—'}
          </span>
          <span>Modified: {overrideInfo?.overrideMeta?.modified || '—'}</span>
          <span>Modified by: {overrideInfo?.overrideMeta?.modifiedBy || '—'}</span>
        </div>
      )}
      {overrideError && <div className="error">{overrideError}</div>}
      <div className="action-row">
        {selectedFile ? (
          <>
            <div className="view-toggle">
              <span
                className={
                  viewMode === 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'
                }
              >
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
              <span
                className={
                  viewMode !== 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'
                }
              >
                Raw
              </span>
            </div>
            {showTestControls && (
              <button
                type="button"
                className="action-link"
                onClick={onTestFile}
                disabled={!hasEditPermission || fileTestLoading}
                title={hasEditPermission ? '' : 'Read-only access'}
              >
                {fileTestLoading
                  ? 'Testing…'
                  : fileTestLabel
                    ? `Test All ${fileTestLabel} SNMP Traps`
                    : 'Test SNMP File'}
              </button>
            )}
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
              title={
                hasStagedChanges
                  ? `${stagedDiff.totalChanges} staged change(s)`
                  : hasEditPermission
                    ? 'No staged changes'
                    : 'Read-only access'
              }
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
