import { useEffect, useMemo } from 'react';
import type { SuggestedEntry } from '../legacySuggestedUtils';
import {
  getReferenceOnlyFieldRows,
  getSuggestedDirtyMeta,
  getSuggestedFieldDependencies,
} from '../legacySuggestedUtils';

type LegacySuggestedReviewPanelProps = {
  hasEditPermission: boolean;
  legacyObjects: any[];
  entries: SuggestedEntry[];
  selectedKey: string | null;
  onSelectEntry: (key: string) => void;
  rawMode: boolean;
  onRawModeChange: (value: boolean) => void;
  onFieldChange: (key: string, field: string, value: string) => void;
  onRawChange: (key: string, rawText: string) => void;
  conflictCountsByObject: Record<string, number>;
  dirtyOnly: boolean;
  onDirtyOnlyChange: (value: boolean) => void;
  matchedOnly: boolean;
  onMatchedOnlyChange: (value: boolean) => void;
  generatedOnly: boolean;
  onGeneratedOnlyChange: (value: boolean) => void;
  conflictOnly: boolean;
  onConflictOnlyChange: (value: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export default function LegacySuggestedReviewPanel({
  hasEditPermission,
  legacyObjects,
  entries,
  selectedKey,
  onSelectEntry,
  rawMode,
  onRawModeChange,
  onFieldChange,
  onRawChange,
  conflictCountsByObject,
  dirtyOnly,
  onDirtyOnlyChange,
  matchedOnly,
  onMatchedOnlyChange,
  generatedOnly,
  onGeneratedOnlyChange,
  conflictOnly,
  onConflictOnlyChange,
  searchValue,
  onSearchChange,
}: LegacySuggestedReviewPanelProps) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      const dirtyMeta = getSuggestedDirtyMeta(entry);
      const hasConflict = Number(conflictCountsByObject[entry.objectName] || 0) > 0;
      if (dirtyOnly && !dirtyMeta.dirty) {
        return false;
      }
      if (matchedOnly && entry.sourceType !== 'matched') {
        return false;
      }
      if (generatedOnly && entry.sourceType !== 'generated') {
        return false;
      }
      if (conflictOnly && !hasConflict) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        entry.objectName.toLowerCase().includes(normalizedSearch) ||
        entry.sourceLabel.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [
    conflictCountsByObject,
    conflictOnly,
    dirtyOnly,
    entries,
    generatedOnly,
    matchedOnly,
    normalizedSearch,
  ]);

  useEffect(() => {
    if (visibleEntries.length === 0) {
      return;
    }
    const exists = visibleEntries.some((entry) => entry.key === selectedKey);
    if (!exists) {
      onSelectEntry(visibleEntries[0].key);
    }
  }, [visibleEntries, selectedKey, onSelectEntry]);

  const selectedEntry = visibleEntries.find((entry) => entry.key === selectedKey) || null;

  return (
    <div className="legacy-object-panel">
      <div className="legacy-object-header">
        <div>
          <div className="legacy-report-title">Suggested COM definitions</div>
          <div className="legacy-report-muted">
            Split-pane review with sticky controls. {hasEditPermission ? 'Editable.' : 'Read-only access.'}
          </div>
        </div>
        <div className="legacy-object-actions">
          <div className="legacy-filter-row" role="tablist" aria-label="Suggested definition mode">
            <button
              type="button"
              className={`legacy-filter-chip ${!rawMode ? 'active' : ''}`}
              role="tab"
              aria-selected={!rawMode}
              onClick={() => onRawModeChange(false)}
            >
              Friendly
            </button>
            <button
              type="button"
              className={`legacy-filter-chip ${rawMode ? 'active' : ''}`}
              role="tab"
              aria-selected={rawMode}
              onClick={() => onRawModeChange(true)}
            >
              Raw JSON
            </button>
          </div>
        </div>
      </div>

      <div className="legacy-filter-row">
        <button
          type="button"
          className={`legacy-filter-chip ${dirtyOnly ? 'active' : ''}`}
          onClick={() => onDirtyOnlyChange(!dirtyOnly)}
        >
          Dirty
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${matchedOnly ? 'active' : ''}`}
          onClick={() => onMatchedOnlyChange(!matchedOnly)}
        >
          Matched
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${generatedOnly ? 'active' : ''}`}
          onClick={() => onGeneratedOnlyChange(!generatedOnly)}
        >
          Generated
        </button>
        <button
          type="button"
          className={`legacy-filter-chip ${conflictOnly ? 'active' : ''}`}
          onClick={() => onConflictOnlyChange(!conflictOnly)}
        >
          Conflict
        </button>
        <input
          className="legacy-filter-input"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search object/source"
        />
      </div>

      <div className="legacy-suggested-split">
        <div className="legacy-suggested-list" role="listbox" aria-label="Suggested COM entries">
          {visibleEntries.length === 0 ? (
            <div className="legacy-report-muted">No suggested entries match current filters.</div>
          ) : (
            visibleEntries.map((entry, index) => {
              const dirtyMeta = getSuggestedDirtyMeta(entry);
              const isSelected = entry.key === selectedEntry?.key;
              const conflictCount = Number(conflictCountsByObject[entry.objectName] || 0);
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`legacy-suggested-list-item${isSelected ? ' selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelectEntry(entry.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      const next = Math.min(visibleEntries.length - 1, index + 1);
                      onSelectEntry(visibleEntries[next].key);
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      const prev = Math.max(0, index - 1);
                      onSelectEntry(visibleEntries[prev].key);
                    }
                  }}
                >
                  <div className="legacy-suggested-item-title">{entry.objectName}</div>
                  <div className="legacy-match-subtle">{entry.sourceLabel || 'legacy conversion'}</div>
                  <div className="legacy-filter-row">
                    <span className="legacy-match-pill">
                      {entry.sourceType === 'matched' ? 'matched' : 'generated'}
                    </span>
                    {dirtyMeta.dirty && (
                      <span className="legacy-match-pill">Dirty ({dirtyMeta.changedFields.length})</span>
                    )}
                    {conflictCount > 0 && <span className="legacy-match-pill">Conflict ({conflictCount})</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="legacy-suggested-detail">
          {!selectedEntry ? (
            <div className="legacy-report-muted">Select an entry to review details.</div>
          ) : (
            <>
              <div className="legacy-object-header">
                <div>
                  <div className="legacy-summary-path">{selectedEntry.objectName}</div>
                  <div className="legacy-match-subtle">{selectedEntry.sourceLabel || 'legacy conversion'}</div>
                  <div className="legacy-report-muted">
                    {selectedEntry.sourceType === 'matched'
                      ? 'Will emit as COM override (matched existing FCOM object).'
                      : 'Will emit as generated COM definition (no existing FCOM match).'}
                  </div>
                </div>
              </div>

              {(() => {
                const dependencyFields = getSuggestedFieldDependencies(selectedEntry, legacyObjects);
                const referenceOnlyFields = getReferenceOnlyFieldRows(selectedEntry, dependencyFields);
                const selectedDirtyMeta = getSuggestedDirtyMeta(selectedEntry);

                return (
                  <>
                    <div className="legacy-report-muted">
                      Field dependencies:{' '}
                      {dependencyFields.length > 0
                        ? dependencyFields.map((field) => `$Event->{${field}}`).join(', ')
                        : 'Dependency mapping unavailable for this item (conversion still included).'}
                    </div>

                    {referenceOnlyFields.length > 0 && (
                      <div className="legacy-summary-table">
                        <div className="legacy-summary-row legacy-summary-header">
                          <div>Referenced only</div>
                          <div>Why not mapped</div>
                          <div>Suggested COM pattern</div>
                        </div>
                        {referenceOnlyFields.map((row) => (
                          <div key={`${selectedEntry.key}-ref-${row.field}`} className="legacy-summary-row">
                            <div className="legacy-summary-path">{`$Event->{${row.field}}`}</div>
                            <div>{row.reason}</div>
                            <div>{row.pattern}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!rawMode ? (
                      selectedEntry.fields.length === 0 ? (
                        <div className="legacy-report-muted">No event fields detected for this suggestion.</div>
                      ) : (
                        <div className="legacy-summary-table">
                          {selectedEntry.fields.map((fieldEntry) => {
                            const fieldDirty =
                              (selectedEntry.initialFieldValues[fieldEntry.field] ?? '') !==
                              fieldEntry.value;
                            return (
                              <div key={`${selectedEntry.key}:${fieldEntry.field}`} className="legacy-summary-row">
                                <div className="legacy-summary-path">
                                  {fieldEntry.field}
                                  {fieldDirty && (
                                    <span className="legacy-match-pill" style={{ marginLeft: 8 }}>
                                      Changed
                                    </span>
                                  )}
                                </div>
                                {hasEditPermission ? (
                                  <input
                                    className="legacy-filter-input"
                                    value={fieldEntry.value}
                                    onChange={(event) =>
                                      onFieldChange(selectedEntry.key, fieldEntry.field, event.target.value)
                                    }
                                  />
                                ) : (
                                  <div className="legacy-report-line">{fieldEntry.value || '—'}</div>
                                )}
                                <div>{selectedDirtyMeta.dirty ? 'Modified' : 'Baseline'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <>
                        <textarea
                          className="code-block"
                          value={selectedEntry.rawText}
                          onChange={(event) => onRawChange(selectedEntry.key, event.target.value)}
                          rows={Math.max(12, selectedEntry.rawText.split('\n').length)}
                          readOnly={!hasEditPermission}
                        />
                        {selectedEntry.rawError && <div className="error">{selectedEntry.rawError}</div>}
                      </>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
