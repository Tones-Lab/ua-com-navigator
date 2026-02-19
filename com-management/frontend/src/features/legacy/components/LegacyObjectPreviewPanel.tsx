type LegacyObjectPreviewPanelProps = {
  visibleObjects: any[];
  filteredObjects: any[];
  showAllObjects: boolean;
  onToggleShowAllObjects: () => void;
  onExportCsv: () => void;
  objectTypeFilter: 'all' | 'fault' | 'performance' | 'unknown';
  onObjectTypeFilter: (value: 'all' | 'fault' | 'performance' | 'unknown') => void;
  filterHasCondition: boolean;
  onToggleFilterHasCondition: () => void;
  filterHasHelpKey: boolean;
  onToggleFilterHasHelpKey: () => void;
  filterHasPerfHints: boolean;
  onToggleFilterHasPerfHints: () => void;
  filterMissingLookups: boolean;
  onToggleFilterMissingLookups: () => void;
  filterWhy: string;
  onFilterWhy: (value: string) => void;
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
  onClearSelection: () => void;
  selectedObject: any | null;
  snippetPulse: boolean;
  snippetLines: string[];
  snippetStartLine: number;
};

export default function LegacyObjectPreviewPanel({
  visibleObjects,
  filteredObjects,
  showAllObjects,
  onToggleShowAllObjects,
  onExportCsv,
  objectTypeFilter,
  onObjectTypeFilter,
  filterHasCondition,
  onToggleFilterHasCondition,
  filterHasHelpKey,
  onToggleFilterHasHelpKey,
  filterHasPerfHints,
  onToggleFilterHasPerfHints,
  filterMissingLookups,
  onToggleFilterMissingLookups,
  filterWhy,
  onFilterWhy,
  selectedObjectId,
  onSelectObject,
  onClearSelection,
  selectedObject,
  snippetPulse,
  snippetLines,
  snippetStartLine,
}: LegacyObjectPreviewPanelProps) {
  if (filteredObjects.length === 0 && visibleObjects.length === 0) {
    return null;
  }

  return (
    <div className="legacy-object-panel">
      <div className="legacy-object-header">
        <div>
          <div className="legacy-report-title">Object preview</div>
          <div className="legacy-report-muted">
            Showing {visibleObjects.length} of {filteredObjects.length} filtered objects
          </div>
        </div>
        <div className="legacy-object-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onExportCsv}
            disabled={filteredObjects.length === 0}
          >
            Export CSV
          </button>
          <button type="button" className="ghost-button" onClick={onToggleShowAllObjects}>
            {showAllObjects ? 'Show fewer' : 'Show all'}
          </button>
        </div>
      </div>

      <div className="legacy-filter-row">
        <button
          type="button"
          className={`legacy-filter-chip ${objectTypeFilter === 'all' ? 'active' : ''}`}
          onClick={() => onObjectTypeFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${objectTypeFilter === 'fault' ? 'active' : ''}`}
          onClick={() => onObjectTypeFilter('fault')}
        >
          Fault
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${objectTypeFilter === 'performance' ? 'active' : ''}`}
          onClick={() => onObjectTypeFilter('performance')}
        >
          Performance
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${objectTypeFilter === 'unknown' ? 'active' : ''}`}
          onClick={() => onObjectTypeFilter('unknown')}
        >
          Unknown
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${filterHasCondition ? 'active' : ''}`}
          onClick={onToggleFilterHasCondition}
        >
          Has condition
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${filterHasHelpKey ? 'active' : ''}`}
          onClick={onToggleFilterHasHelpKey}
        >
          Has HelpKey
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${filterHasPerfHints ? 'active' : ''}`}
          onClick={onToggleFilterHasPerfHints}
        >
          Has perf hints
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${filterMissingLookups ? 'active' : ''}`}
          onClick={onToggleFilterMissingLookups}
        >
          Missing lookups (global)
        </button>
        <input
          className="legacy-filter-input"
          placeholder="Why filter (e.g., EventFields, MetricID)"
          value={filterWhy}
          onChange={(event) => onFilterWhy(event.target.value)}
        />
      </div>

      <div className="legacy-object-content">
        <div className="legacy-object-list">
          {filteredObjects.length === 0 ? (
            <div className="legacy-report-muted">No objects match the current filters.</div>
          ) : (
            <div className="legacy-object-table">
              <div className="legacy-object-row legacy-object-header-row">
                <div>Rule</div>
                <div>Type</div>
                <div>OIDs</div>
                <div>HelpKey</div>
                <div>Node/SubNode</div>
                <div>Traversal</div>
                <div>Perf hints</div>
                <div>Why</div>
              </div>
              {visibleObjects.map((obj: any) => (
                <div
                  key={obj.id}
                  className={`legacy-object-row legacy-object-button${selectedObjectId === obj.id ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectObject(obj.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectObject(obj.id);
                    }
                  }}
                >
                  <div>
                    <div className="legacy-object-name">{obj.ruleFunction}</div>
                    <div className="legacy-object-meta">{obj.sourceFile}</div>
                  </div>
                  <div className="legacy-object-pill">{obj.ruleType}</div>
                  <div className="legacy-object-meta">{(obj.oids || []).slice(0, 3).join(', ') || '—'}</div>
                  <div className="legacy-object-meta">{(obj.helpKeys || []).join(', ') || '—'}</div>
                  <div className="legacy-object-meta">
                    {(obj.nodeValues || []).join(', ') || '—'}
                    {obj.subNodeValues?.length ? ` / ${obj.subNodeValues.join(', ')}` : ''}
                  </div>
                  <div className="legacy-object-meta">
                    {obj?.traversal?.kind || '—'}
                    {obj?.traversal?.condition ? ` (${obj.traversal.condition})` : ''}
                  </div>
                  <div className="legacy-object-meta">{(obj.performanceHints || []).join(', ') || '—'}</div>
                  <div className="legacy-object-meta">{(obj.classificationHints || []).join(', ') || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="legacy-object-preview-panel">
          <div className="legacy-object-preview">
            <div className="legacy-object-header">
              <div>
                <div className="legacy-report-title">Snippet focus</div>
                <div className="legacy-report-muted">
                  {selectedObject
                    ? `${selectedObject.ruleFunction} · ${selectedObject.ruleType}`
                    : 'Select a row to highlight its code block'}
                </div>
              </div>
              <div className="legacy-object-actions">
                <button type="button" className="ghost-button" onClick={onClearSelection} disabled={!selectedObject}>
                  Clear selection
                </button>
              </div>
            </div>
            <div className="legacy-object-meta">{selectedObject ? selectedObject.sourceFile : '—'}</div>
            <div className={`code-block legacy-object-snippet${snippetPulse ? ' legacy-object-snippet-pulse' : ''}`}>
              {snippetLines.length === 0 ? (
                <div className="legacy-report-muted">Snippet unavailable for this object.</div>
              ) : (
                snippetLines.map((line: string, index: number) => (
                  <div key={`snippet-${snippetStartLine + index}`} className={`legacy-snippet-line${selectedObject ? ' highlight' : ''}`}>
                    <span className="legacy-snippet-gutter">{snippetStartLine + index}</span>
                    <span className="legacy-snippet-code">{line || ' '}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
