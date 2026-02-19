type LegacyReportCommandBarProps = {
  reportJson: any | null;
  reportText: string;
  reviewHintText: string;
  cloudyMatchThreshold: string;
  onCloudyMatchThresholdChange: (value: string) => void;
  onDownloadText: () => void;
  onDownloadJson: () => void;
  onDownloadConfidenceCalibrationJson: () => void;
  onDownloadConfidenceCalibrationText: () => void;
  onDownloadConfidenceDriftJson: () => void;
  onDownloadConfidenceDriftText: () => void;
  hasConfidenceDrift: boolean;
  traversalFilesCount: number;
  traversalMissingCount: number;
  onCopyTraversalOrder: () => void;
  onCopyMissingFunctions: () => void;
  applyingOverrides: boolean;
  hasSuggestedRawErrors: boolean;
  onPreviewConfirmed: () => void;
  onCreateConfirmed: () => void;
  sectionVisibility: {
    traversal: boolean;
    matchDiffs: boolean;
    rawReport: boolean;
  };
  hasTraversal: boolean;
  onToggleMatchDiffs: () => void;
  onToggleTraversal: () => void;
  onToggleRawReport: () => void;
  downloadHint: string;
};

export default function LegacyReportCommandBar({
  reportJson,
  reportText,
  reviewHintText,
  cloudyMatchThreshold,
  onCloudyMatchThresholdChange,
  onDownloadText,
  onDownloadJson,
  onDownloadConfidenceCalibrationJson,
  onDownloadConfidenceCalibrationText,
  onDownloadConfidenceDriftJson,
  onDownloadConfidenceDriftText,
  hasConfidenceDrift,
  traversalFilesCount,
  traversalMissingCount,
  onCopyTraversalOrder,
  onCopyMissingFunctions,
  applyingOverrides,
  hasSuggestedRawErrors,
  onPreviewConfirmed,
  onCreateConfirmed,
  sectionVisibility,
  hasTraversal,
  onToggleMatchDiffs,
  onToggleTraversal,
  onToggleRawReport,
  downloadHint,
}: LegacyReportCommandBarProps) {
  return (
    <div className="legacy-report-actions legacy-command-bar" role="region" aria-label="Legacy command bar">
      {reportJson && <div className="legacy-report-muted">{reviewHintText}</div>}
      {reportJson && (
        <label className="legacy-report-hint" htmlFor="cloudy-match-threshold">
          Cloudy match threshold
          <input
            id="cloudy-match-threshold"
            className="legacy-filter-input"
            value={cloudyMatchThreshold}
            onChange={(event) => onCloudyMatchThresholdChange(event.target.value)}
            placeholder="10"
            inputMode="numeric"
          />
        </label>
      )}
      {reportText && (
        <button type="button" className="ghost-button" onClick={onDownloadText}>
          Download text
        </button>
      )}
      {reportJson && (
        <button type="button" className="ghost-button" onClick={onDownloadJson}>
          Download JSON
        </button>
      )}
      {reportJson && (
        <button type="button" className="ghost-button" onClick={onDownloadConfidenceCalibrationJson}>
          Download confidence JSON
        </button>
      )}
      {reportJson && (
        <button type="button" className="ghost-button" onClick={onDownloadConfidenceCalibrationText}>
          Download confidence text
        </button>
      )}
      {reportJson && hasConfidenceDrift && (
        <button type="button" className="ghost-button" onClick={onDownloadConfidenceDriftJson}>
          Download drift JSON
        </button>
      )}
      {reportJson && hasConfidenceDrift && (
        <button type="button" className="ghost-button" onClick={onDownloadConfidenceDriftText}>
          Download drift text
        </button>
      )}
      {traversalFilesCount > 0 && (
        <button type="button" className="ghost-button" onClick={onCopyTraversalOrder}>
          Copy traversal order
        </button>
      )}
      {traversalMissingCount > 0 && (
        <button type="button" className="ghost-button" onClick={onCopyMissingFunctions}>
          Copy missing functions
        </button>
      )}
      {reportJson && (
        <button
          type="button"
          className="ghost-button"
          disabled={applyingOverrides}
          onClick={onPreviewConfirmed}
        >
          {applyingOverrides ? 'Preparing…' : 'Preview confirmed FCOM overrides'}
        </button>
      )}
      {reportJson && (
        <button
          type="button"
          className="ghost-button"
          disabled={applyingOverrides || hasSuggestedRawErrors}
          title={hasSuggestedRawErrors ? 'Fix invalid JSON in suggested COM drafts first.' : ''}
          onClick={onCreateConfirmed}
        >
          {applyingOverrides ? 'Creating…' : 'Create confirmed FCOM override bundle'}
        </button>
      )}
      {reportJson && (
        <button
          type="button"
          className={`ghost-button ${sectionVisibility.matchDiffs ? 'active' : ''}`}
          onClick={onToggleMatchDiffs}
        >
          {sectionVisibility.matchDiffs ? 'Hide match diffs' : 'Show match diffs'}
        </button>
      )}
      {hasTraversal && (
        <button
          type="button"
          className={`ghost-button ${sectionVisibility.traversal ? 'active' : ''}`}
          onClick={onToggleTraversal}
        >
          {sectionVisibility.traversal ? 'Hide traversal' : 'Show traversal'}
        </button>
      )}
      {reportText && (
        <button
          type="button"
          className={`ghost-button ${sectionVisibility.rawReport ? 'active' : ''}`}
          onClick={onToggleRawReport}
        >
          {sectionVisibility.rawReport ? 'Hide raw report' : 'Show raw report'}
        </button>
      )}
      {downloadHint && <div className="legacy-report-hint">Downloads: {downloadHint}</div>}
    </div>
  );
}
