import type { ReactNode } from 'react';
import InlineMessage from '../../../components/InlineMessage';
import type { LegacyApplyFcomOverridesResponse } from '../../../types/api';
import LegacyReportCommandBar from './LegacyReportCommandBar';
import LegacySuggestedReviewPanel from './LegacySuggestedReviewPanel';
import type { SuggestedEntry } from '../legacySuggestedUtils';

type LegacyReportPreviewPanelProps = {
  reportError: string | null;
  lastRunLabel: string | null;
  reportText: string;
  reportJson: any | null;
  reviewHintText: string;
  cloudyMatchThreshold: string;
  onCloudyMatchThresholdChange: (value: string) => void;
  onDownloadText: () => void;
  onDownloadJson: () => void;
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
  applyOverridesError: string | null;
  applyOverridesResult: LegacyApplyFcomOverridesResponse | null;
  hasEditPermission: boolean;
  legacyObjects: any[];
  suggestedEntries: SuggestedEntry[];
  selectedSuggestedKey: string | null;
  onSelectSuggestedKey: (value: string | null) => void;
  suggestedRawMode: boolean;
  onSuggestedRawModeChange: (value: boolean) => void;
  onSuggestedFieldChange: (key: string, field: string, value: string) => void;
  onSuggestedRawChange: (key: string, rawText: string) => void;
  conflictCountsByObject: Record<string, number>;
  suggestedDirtyOnly: boolean;
  onSuggestedDirtyOnlyChange: (value: boolean) => void;
  suggestedMatchedOnly: boolean;
  onSuggestedMatchedOnlyChange: (value: boolean) => void;
  suggestedGeneratedOnly: boolean;
  onSuggestedGeneratedOnlyChange: (value: boolean) => void;
  suggestedConflictOnly: boolean;
  onSuggestedConflictOnlyChange: (value: boolean) => void;
  suggestedSearch: string;
  onSuggestedSearchChange: (value: string) => void;
  suggestedDensityMode: 'compact' | 'comfortable';
  onSuggestedDensityModeChange: (value: 'compact' | 'comfortable') => void;
  suggestedSortMode: 'default' | 'dirty-first' | 'generated-first' | 'name-asc';
  onSuggestedSortModeChange: (value: 'default' | 'dirty-first' | 'generated-first' | 'name-asc') => void;
  children: ReactNode;
};

export default function LegacyReportPreviewPanel({
  reportError,
  lastRunLabel,
  reportText,
  reportJson,
  reviewHintText,
  cloudyMatchThreshold,
  onCloudyMatchThresholdChange,
  onDownloadText,
  onDownloadJson,
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
  applyOverridesError,
  applyOverridesResult,
  hasEditPermission,
  legacyObjects,
  suggestedEntries,
  selectedSuggestedKey,
  onSelectSuggestedKey,
  suggestedRawMode,
  onSuggestedRawModeChange,
  onSuggestedFieldChange,
  onSuggestedRawChange,
  conflictCountsByObject,
  suggestedDirtyOnly,
  onSuggestedDirtyOnlyChange,
  suggestedMatchedOnly,
  onSuggestedMatchedOnlyChange,
  suggestedGeneratedOnly,
  onSuggestedGeneratedOnlyChange,
  suggestedConflictOnly,
  onSuggestedConflictOnlyChange,
  suggestedSearch,
  onSuggestedSearchChange,
  suggestedDensityMode,
  onSuggestedDensityModeChange,
  suggestedSortMode,
  onSuggestedSortModeChange,
  children,
}: LegacyReportPreviewPanelProps) {
  return (
    <div className="panel-section">
      <div className="panel-section-title">Report Preview (Text-Only)</div>
      <div className="legacy-report-preview">
        {reportError && <InlineMessage tone="error">{reportError}</InlineMessage>}
        {lastRunLabel && !reportError && <div className="legacy-report-banner">{lastRunLabel}</div>}
        {(reportText || reportJson) && (
          <LegacyReportCommandBar
            reportJson={reportJson}
            reportText={reportText}
            reviewHintText={reviewHintText}
            cloudyMatchThreshold={cloudyMatchThreshold}
            onCloudyMatchThresholdChange={onCloudyMatchThresholdChange}
            onDownloadText={onDownloadText}
            onDownloadJson={onDownloadJson}
            traversalFilesCount={traversalFilesCount}
            traversalMissingCount={traversalMissingCount}
            onCopyTraversalOrder={onCopyTraversalOrder}
            onCopyMissingFunctions={onCopyMissingFunctions}
            applyingOverrides={applyingOverrides}
            hasSuggestedRawErrors={hasSuggestedRawErrors}
            onPreviewConfirmed={onPreviewConfirmed}
            onCreateConfirmed={onCreateConfirmed}
            sectionVisibility={sectionVisibility}
            hasTraversal={hasTraversal}
            onToggleMatchDiffs={onToggleMatchDiffs}
            onToggleTraversal={onToggleTraversal}
            onToggleRawReport={onToggleRawReport}
            downloadHint={downloadHint}
          />
        )}
        {applyOverridesError && <InlineMessage tone="error">{applyOverridesError}</InlineMessage>}
        {applyOverridesResult && (
          <InlineMessage tone="success">
            Existing FCOM matches: {applyOverridesResult.summary.matchedExistingFcomObjects} · Confirmed overrides:{' '}
            {applyOverridesResult.summary.confirmedObjects} · Generated COM definitions:{' '}
            {applyOverridesResult.summary.generatedDefinitions} · Conflict objects:{' '}
            {applyOverridesResult.summary.conflictObjects}
            {applyOverridesResult.outputPath ? ` · Saved: ${applyOverridesResult.outputPath}` : ''}
          </InlineMessage>
        )}
        {suggestedEntries.length > 0 && (
          <LegacySuggestedReviewPanel
            hasEditPermission={hasEditPermission}
            legacyObjects={legacyObjects}
            entries={suggestedEntries}
            selectedKey={selectedSuggestedKey}
            onSelectEntry={onSelectSuggestedKey}
            rawMode={suggestedRawMode}
            onRawModeChange={onSuggestedRawModeChange}
            onFieldChange={onSuggestedFieldChange}
            onRawChange={onSuggestedRawChange}
            conflictCountsByObject={conflictCountsByObject}
            dirtyOnly={suggestedDirtyOnly}
            onDirtyOnlyChange={onSuggestedDirtyOnlyChange}
            matchedOnly={suggestedMatchedOnly}
            onMatchedOnlyChange={onSuggestedMatchedOnlyChange}
            generatedOnly={suggestedGeneratedOnly}
            onGeneratedOnlyChange={onSuggestedGeneratedOnlyChange}
            conflictOnly={suggestedConflictOnly}
            onConflictOnlyChange={onSuggestedConflictOnlyChange}
            searchValue={suggestedSearch}
            onSearchChange={onSuggestedSearchChange}
            densityMode={suggestedDensityMode}
            onDensityModeChange={onSuggestedDensityModeChange}
            sortMode={suggestedSortMode}
            onSortModeChange={onSuggestedSortModeChange}
          />
        )}
        {children}
        {reportText && sectionVisibility.rawReport && (
          <pre className="code-block legacy-report-raw">{reportText}</pre>
        )}
        {reportText && !sectionVisibility.rawReport && (
          <div className="legacy-report-muted">Raw report hidden. Use “Show raw report” to expand.</div>
        )}
      </div>
    </div>
  );
}
