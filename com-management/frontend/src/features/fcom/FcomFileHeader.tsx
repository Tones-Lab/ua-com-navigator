import ActionRow from '../../components/ActionRow';
import { FileTitleRow, ViewToggle } from '../../components/FileHeaderCommon';
import Pill from '../../components/Pill';
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
  overrideSaveStatus: Array<{
    objectName: string;
    fileName: string;
    status: 'queued' | 'saving' | 'retrying' | 'done' | 'failed';
  }>;
  saveLoading: boolean;
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
  overrideInfo: _overrideInfo,
  overrideError,
  hasLocalOverrides: _hasLocalOverrides,
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
  overrideSaveStatus,
  saveLoading,
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
      <FileTitleRow
        title={selectedFile?.PathName ? renderHighlightedText(selectedFile.PathName) : 'Select a file'}
        path={selectedFile?.PathID ? formatDisplayPath(selectedFile.PathID) : null}
        favorite={
          selectedFile
            ? {
                active: isFavorite('file', selectedFile.PathID),
                onToggle: () =>
                  toggleFavorite({
                    type: 'file',
                    pathId: selectedFile.PathID,
                    label: selectedFile.PathName,
                    node: browseNode || undefined,
                  }),
              }
            : null
        }
      />
      {(fileMethod || fileSubMethod) && (
        <div className="file-meta-row">
          {fileMethod && <span>Method: {fileMethod}</span>}
          {fileSubMethod && <span>SubMethod: {fileSubMethod}</span>}
        </div>
      )}
      {overrideError && <div className="error">{overrideError}</div>}
      <ActionRow>
        {selectedFile ? (
          <>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            {showTestControls && (
              <button
                type="button"
                className="action-link"
                onClick={onTestFile}
                disabled={!hasEditPermission || fileTestLoading}
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
              <Pill title="Global Advanced Flow configured">
                Advanced Flow
              </Pill>
            )}
            {stagedDiff.editedObjects.length > 0 && (
              <Pill
                title={`Edited objects: ${stagedDiff.editedObjects.slice(0, 6).join(', ')}${
                  stagedDiff.editedObjects.length > 6 ? '…' : ''
                }`}
              >
                Edited objects: {stagedDiff.editedObjects.length}
              </Pill>
            )}
          </>
        ) : (
          <span className="muted">Select a file on the left to view and edit.</span>
        )}
      </ActionRow>
      {fileError && <div className="error">{fileError}</div>}
      {saveError && <div className="error">{saveError}</div>}
      {saveSuccess && <div className="success">{saveSuccess}</div>}
      {!saveLoading && overrideSaveStatus.length > 0 && (
        <div className="override-save-status">
          <div className="override-save-status-header">
            <span>Override files</span>
            <span>
              {overrideSaveStatus.filter((entry) => entry.status === 'done').length}/
              {overrideSaveStatus.length} complete
            </span>
          </div>
          <div className="override-save-status-list">
            {overrideSaveStatus.map((entry) => {
              const label =
                entry.status === 'done'
                  ? 'Done'
                  : entry.status === 'failed'
                    ? 'Failed'
                    : entry.status === 'retrying'
                      ? 'Retrying'
                      : entry.status === 'saving'
                        ? 'Saving'
                        : 'Queued';
              return (
                <div
                  key={`${entry.objectName}-${entry.fileName}`}
                  className="override-save-status-item"
                >
                  <span className="override-save-status-name">{entry.fileName}</span>
                  <span
                    className={`override-save-status-pill override-save-status-pill-${entry.status}`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {stagedToast && <div className="staged-toast">{stagedToast}</div>}
    </>
  );
}
