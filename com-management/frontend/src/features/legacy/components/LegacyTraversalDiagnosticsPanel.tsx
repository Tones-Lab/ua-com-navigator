type LegacyTraversalDiagnosticsPanelProps = {
  expanded: boolean;
  onToggleExpanded: () => void;
  traversalLoadCalls: string[];
  traversalMissingLoadCalls: string[];
  traversalMissingIncludes: string[];
  traversalMissingLookups: string[];
  traversalMissing: string[];
  traversalFiles: string[];
  traversalEntries: any[];
  traversalCountText: string;
  showAllTraversalFiles: boolean;
  onToggleShowAllTraversalFiles: () => void;
  showAllTraversalEntries: boolean;
  onToggleShowAllTraversalEntries: () => void;
};

export default function LegacyTraversalDiagnosticsPanel({
  expanded,
  onToggleExpanded,
  traversalLoadCalls,
  traversalMissingLoadCalls,
  traversalMissingIncludes,
  traversalMissingLookups,
  traversalMissing,
  traversalFiles,
  traversalEntries,
  traversalCountText,
  showAllTraversalFiles,
  onToggleShowAllTraversalFiles,
  showAllTraversalEntries,
  onToggleShowAllTraversalEntries,
}: LegacyTraversalDiagnosticsPanelProps) {
  return (
    <>
      <div className="legacy-report-divider" aria-hidden="true" />
      <div className="legacy-match-header">
        <div>
          <div className="legacy-report-title">Traversal diagnostics</div>
          <div className="legacy-report-muted">
            {expanded ? 'Expanded detailed traversal diagnostics.' : 'Collapsed by default to reduce scroll.'}
          </div>
        </div>
        <div className="legacy-object-actions">
          <button type="button" className="ghost-button" onClick={onToggleExpanded}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {expanded && traversalLoadCalls.length > 0 && (
        <div className="legacy-traversal-section">
          <div className="legacy-traversal-label">Load calls</div>
          <ul className="legacy-traversal-list">
            {traversalLoadCalls.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {traversalLoadCalls.length > 10 && (
              <li className="legacy-traversal-muted">+{traversalLoadCalls.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {expanded && traversalMissingLoadCalls.length > 0 && (
        <div className="legacy-traversal-section">
          <div className="legacy-traversal-label">Missing load calls</div>
          <ul className="legacy-traversal-list">
            {traversalMissingLoadCalls.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {traversalMissingLoadCalls.length > 10 && (
              <li className="legacy-traversal-muted">+{traversalMissingLoadCalls.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {expanded && traversalMissingIncludes.length > 0 && (
        <div className="legacy-traversal-section">
          <div className="legacy-traversal-label">Missing include paths</div>
          <ul className="legacy-traversal-list">
            {traversalMissingIncludes.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {traversalMissingIncludes.length > 10 && (
              <li className="legacy-traversal-muted">+{traversalMissingIncludes.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {expanded && traversalMissingLookups.length > 0 && (
        <div className="legacy-traversal-section">
          <div className="legacy-traversal-label">Missing lookup files</div>
          <ul className="legacy-traversal-list">
            {traversalMissingLookups.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {traversalMissingLookups.length > 10 && (
              <li className="legacy-traversal-muted">+{traversalMissingLookups.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {expanded && traversalMissing.length > 0 && (
        <div className="legacy-traversal-section">
          <div className="legacy-traversal-label">Missing functions</div>
          <ul className="legacy-traversal-list">
            {traversalMissing.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {traversalMissing.length > 10 && (
              <li className="legacy-traversal-muted">+{traversalMissing.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {expanded && traversalFiles.length > 0 && (
        <>
          <div className="legacy-traversal-toggle">
            <button type="button" className="ghost-button" onClick={onToggleShowAllTraversalFiles}>
              {showAllTraversalFiles ? 'Show fewer files' : 'Show all files'}
            </button>
            <span className="muted">{traversalFiles.length} total</span>
          </div>
          <div className="legacy-traversal-section">
            <div className="legacy-traversal-label">Ordered files</div>
            <ul className="legacy-traversal-list">
              {(showAllTraversalFiles ? traversalFiles : traversalFiles.slice(0, 6)).map((filePath) => (
                <li key={filePath}>{filePath}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {expanded && traversalEntries.length > 0 && (
        <>
          <div className="legacy-traversal-toggle">
            <button type="button" className="ghost-button" onClick={onToggleShowAllTraversalEntries}>
              {showAllTraversalEntries ? 'Show fewer entries' : 'Show all entries'}
            </button>
            <span className="muted">{traversalEntries.length} total</span>
          </div>
          <div className="legacy-traversal-section">
            <div className="legacy-traversal-label">
              Traversal entries
              {traversalCountText && <span className="legacy-traversal-badge">{traversalCountText}</span>}
            </div>
            <ul className="legacy-traversal-list">
              {(showAllTraversalEntries ? traversalEntries : traversalEntries.slice(0, 6)).map(
                (entry: any, index: number) => (
                  <li key={`${entry.filePath || 'entry'}-${index}`}>
                    <div className="legacy-traversal-entry">
                      <span className="legacy-traversal-kind">{entry.kind}</span>
                      <span className="legacy-traversal-main">{entry.functionName || entry.filePath}</span>
                    </div>
                    {entry.condition && <div className="legacy-traversal-meta">{entry.condition}</div>}
                    {entry.functionName && entry.filePath && (
                      <div className="legacy-traversal-meta">{entry.filePath}</div>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
