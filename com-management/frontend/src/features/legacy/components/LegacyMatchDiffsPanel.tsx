import type { RefObject } from 'react';

type LegacyMatchDiffsPanelProps = {
  panelRef?: RefObject<HTMLDivElement>;
  expanded: boolean;
  onToggleExpanded: () => void;
  showAllMatches: boolean;
  onToggleShowAllMatches: () => void;
  filteredMatchDiffs: any[];
  visibleMatches: any[];
  matchStats: any;
  matchOpenError: string | null;
  matchSourceFilter: 'all' | 'fcom' | 'pcom' | 'mib';
  onMatchSourceFilter: (value: 'all' | 'fcom' | 'pcom' | 'mib') => void;
  matchMethodFilter: 'all' | 'oid' | 'name' | 'heuristic';
  onMatchMethodFilter: (value: 'all' | 'oid' | 'name' | 'heuristic') => void;
  matchOnlyDiffs: boolean;
  onToggleMatchOnlyDiffs: () => void;
  matchMinScore: string;
  onMatchMinScore: (value: string) => void;
  matchSearch: string;
  onMatchSearch: (value: string) => void;
  expandedMatches: Record<string, boolean>;
  onToggleMatchRow: (legacyObjectId: string) => void;
  onOpenMatchFile: (entry: any) => void;
};

export default function LegacyMatchDiffsPanel({
  panelRef,
  expanded,
  onToggleExpanded,
  showAllMatches,
  onToggleShowAllMatches,
  filteredMatchDiffs,
  visibleMatches,
  matchStats,
  matchOpenError,
  matchSourceFilter,
  onMatchSourceFilter,
  matchMethodFilter,
  onMatchMethodFilter,
  matchOnlyDiffs,
  onToggleMatchOnlyDiffs,
  matchMinScore,
  onMatchMinScore,
  matchSearch,
  onMatchSearch,
  expandedMatches,
  onToggleMatchRow,
  onOpenMatchFile,
}: LegacyMatchDiffsPanelProps) {
  return (
    <div className="legacy-match-panel" tabIndex={-1} ref={panelRef}>
      <div className="legacy-match-header">
        <div>
          <div className="legacy-report-title">Match diffs</div>
          <div className="legacy-report-muted">
            {expanded
              ? `Showing ${visibleMatches.length} of ${filteredMatchDiffs.length} filtered matches`
              : 'Collapsed by default to reduce scroll. Expand to inspect match diagnostics.'}
          </div>
          {matchStats && expanded && (
            <div className="legacy-match-meta">
              Index: {matchStats.indexEntries} objects · {matchStats.indexFiles} files ·
              cache {matchStats.cacheHit ? 'hit' : 'miss'}
            </div>
          )}
        </div>
        <div className="legacy-object-actions">
          <button type="button" className="ghost-button" onClick={onToggleExpanded}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          {expanded && (
            <button
              type="button"
              className="ghost-button"
              onClick={onToggleShowAllMatches}
              disabled={filteredMatchDiffs.length === 0}
            >
              {showAllMatches ? 'Show fewer' : 'Show all'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <div className="legacy-match-controls">
            <div className="legacy-filter-row">
              <button
                type="button"
                className={`legacy-filter-chip ${matchSourceFilter === 'all' ? 'active' : ''}`}
                onClick={() => onMatchSourceFilter('all')}
              >
                All sources
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchSourceFilter === 'fcom' ? 'active' : ''}`}
                onClick={() => onMatchSourceFilter('fcom')}
              >
                FCOM
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchSourceFilter === 'pcom' ? 'active' : ''}`}
                onClick={() => onMatchSourceFilter('pcom')}
              >
                PCOM
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchSourceFilter === 'mib' ? 'active' : ''}`}
                onClick={() => onMatchSourceFilter('mib')}
              >
                MIB
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchOnlyDiffs ? 'active' : ''}`}
                onClick={onToggleMatchOnlyDiffs}
              >
                Only diffs
              </button>
            </div>
            <div className="legacy-filter-row">
              <button
                type="button"
                className={`legacy-filter-chip ${matchMethodFilter === 'all' ? 'active' : ''}`}
                onClick={() => onMatchMethodFilter('all')}
              >
                All methods
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchMethodFilter === 'oid' ? 'active' : ''}`}
                onClick={() => onMatchMethodFilter('oid')}
              >
                OID only
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchMethodFilter === 'name' ? 'active' : ''}`}
                onClick={() => onMatchMethodFilter('name')}
              >
                Name match
              </button>
              <button
                type="button"
                className={`legacy-filter-chip ${matchMethodFilter === 'heuristic' ? 'active' : ''}`}
                onClick={() => onMatchMethodFilter('heuristic')}
              >
                Heuristic
              </button>
            </div>
            <div className="legacy-filter-row">
              <input
                className="legacy-filter-input"
                type="number"
                min="0"
                placeholder="Min score"
                value={matchMinScore}
                onChange={(event) => onMatchMinScore(event.target.value)}
              />
              <input
                className="legacy-filter-input"
                placeholder="Search legacy/matched/path"
                value={matchSearch}
                onChange={(event) => onMatchSearch(event.target.value)}
              />
            </div>
            {matchOpenError && <div className="legacy-report-banner legacy-report-banner-warn">{matchOpenError}</div>}
          </div>

          {filteredMatchDiffs.length === 0 ? (
            <div className="legacy-report-muted">No FCOM/PCOM/MIB matches computed yet.</div>
          ) : (
            <div className="legacy-match-table">
              <div className="legacy-match-row legacy-match-header-row">
                <div>Legacy object</div>
                <div>Matched</div>
                <div>Method</div>
                <div>Score</div>
                <div>Diffs</div>
                <div>Actions</div>
              </div>
              {visibleMatches.map((entry: any) => {
                const isExpanded = Boolean(expandedMatches[entry.legacyObjectId]);
                return (
                  <div key={entry.legacyObjectId} className="legacy-match-group">
                    <div className="legacy-match-row">
                      <div>
                        <div className="legacy-summary-path">{entry.legacyObjectName}</div>
                        <div className="legacy-match-subtle">{entry.sourceFile}</div>
                      </div>
                      <div>
                        {entry.matchedObject
                          ? `${entry.matchedObject.source}:${entry.matchedObject.name}`
                          : '—'}
                      </div>
                      <div>
                        <span className="legacy-match-pill">{entry.matchMethod || 'unknown'}</span>
                      </div>
                      <div>{entry.matchScore ?? '—'}</div>
                      <div>{entry.diffs?.length || 0}</div>
                      <div className="legacy-match-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onToggleMatchRow(entry.legacyObjectId)}
                        >
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                        {entry?.matchedObject?.path && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => onOpenMatchFile(entry)}
                          >
                            Open file
                          </button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="legacy-match-details">
                        <div className="legacy-match-detail-row">
                          <span className="legacy-match-label">Matched path</span>
                          <span className="legacy-match-path">{entry?.matchedObject?.path || '—'}</span>
                        </div>
                        {Array.isArray(entry?.diffs) && entry.diffs.length > 0 ? (
                          <div className="legacy-match-diffs">
                            {entry.diffs.map((diff: any, index: number) => (
                              <div key={`${entry.legacyObjectId}-diff-${index}`} className="legacy-match-diff">
                                <span className="legacy-match-field">{diff.field}</span>
                                <span className="legacy-match-value">Legacy: {diff.legacyValue ?? '—'}</span>
                                <span className="legacy-match-value">Existing: {diff.existingValue ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="legacy-report-muted">No field diffs for this match.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
