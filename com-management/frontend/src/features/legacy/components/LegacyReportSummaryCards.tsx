type LegacyReportSummaryCardsProps = {
  reportSummary: {
    totalFiles: number;
    totalLegacyObjects: number;
    totalOverrides: number;
    baselineMetrics?: {
      processorStubs?: {
        directRate?: number;
        conditionalRate?: number;
        manualRate?: number;
      };
      unresolvedMappings?: {
        total?: number;
        unique?: number;
      };
      matching?: {
        matchCoverageRate?: number;
        conflictRate?: number;
      };
    };
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

  const directRate = Number(reportSummary.baselineMetrics?.processorStubs?.directRate || 0);
  const conditionalRate = Number(reportSummary.baselineMetrics?.processorStubs?.conditionalRate || 0);
  const manualRate = Number(reportSummary.baselineMetrics?.processorStubs?.manualRate || 0);
  const unresolvedTotal = Number(reportSummary.baselineMetrics?.unresolvedMappings?.total || 0);
  const unresolvedUnique = Number(reportSummary.baselineMetrics?.unresolvedMappings?.unique || 0);
  const matchCoverageRate = Number(reportSummary.baselineMetrics?.matching?.matchCoverageRate || 0);
  const conflictRate = Number(reportSummary.baselineMetrics?.matching?.conflictRate || 0);
  const hasBaselineMetrics = Boolean(reportSummary.baselineMetrics);

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
        {hasBaselineMetrics && (
          <>
            <div className="legacy-report-line legacy-report-muted">
              Stub rates: direct {(directRate * 100).toFixed(1)}% · conditional {(conditionalRate * 100).toFixed(1)}%
              {' '}· manual {(manualRate * 100).toFixed(1)}%
            </div>
            <div className="legacy-report-line legacy-report-muted">
              Unresolved mappings: {unresolvedTotal} ({unresolvedUnique} unique)
            </div>
            <div className="legacy-report-line legacy-report-muted">
              Match coverage: {(matchCoverageRate * 100).toFixed(1)}% · Conflict rate: {(conflictRate * 100).toFixed(1)}%
            </div>
          </>
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
