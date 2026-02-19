type LegacyReportSummaryCardsProps = {
  reportSummary: {
    totalFiles: number;
    totalLegacyObjects: number;
    totalOverrides: number;
  } | null;
  helpKeyCount: number;
  nodeCount: number;
  subNodeCount: number;
  performanceHintCount: number;
  hasTraversal: boolean;
  traversalFilesCount: number;
  traversalEntriesCount: number;
  traversalMissingCount: number;
  traversalLoadCallsCount: number;
  traversalMissingLoadCallsCount: number;
  traversalMissingIncludesCount: number;
  traversalMissingLookupsCount: number;
  traversalCountText: string;
};

export default function LegacyReportSummaryCards({
  reportSummary,
  helpKeyCount,
  nodeCount,
  subNodeCount,
  performanceHintCount,
  hasTraversal,
  traversalFilesCount,
  traversalEntriesCount,
  traversalMissingCount,
  traversalLoadCallsCount,
  traversalMissingLoadCallsCount,
  traversalMissingIncludesCount,
  traversalMissingLookupsCount,
  traversalCountText,
}: LegacyReportSummaryCardsProps) {
  if (!reportSummary) {
    return null;
  }

  return (
    <div className="legacy-report-grid">
      <div className="legacy-report-card">
        <div className="legacy-report-title">Summary</div>
        <div className="legacy-report-line">
          {reportSummary.totalFiles} file(s) · {reportSummary.totalLegacyObjects} object(s)
        </div>
        <div className="legacy-report-line">Overrides proposed: {reportSummary.totalOverrides}</div>
        {(helpKeyCount > 0 || nodeCount > 0 || subNodeCount > 0) && (
          <div className="legacy-report-line legacy-report-muted">
            HelpKeys: {helpKeyCount} · Nodes: {nodeCount} · SubNodes: {subNodeCount}
          </div>
        )}
        {performanceHintCount > 0 && (
          <div className="legacy-report-line legacy-report-muted">
            Performance hints: {performanceHintCount}
          </div>
        )}
      </div>
      {hasTraversal && (
        <div className="legacy-report-card">
          <div className="legacy-report-title">Traversal</div>
          <div className="legacy-report-line">
            Ordered files: {traversalFilesCount} · Entries: {traversalEntriesCount}
          </div>
          <div className="legacy-report-line">Missing functions: {traversalMissingCount}</div>
          <div className="legacy-report-line">
            Load calls: {traversalLoadCallsCount} · Missing loads: {traversalMissingLoadCallsCount}
          </div>
          <div className="legacy-report-line">
            Missing includes: {traversalMissingIncludesCount} · Missing lookups: {traversalMissingLookupsCount}
          </div>
          {traversalCountText && (
            <div className="legacy-report-line legacy-traversal-counts">{traversalCountText}</div>
          )}
        </div>
      )}
    </div>
  );
}
