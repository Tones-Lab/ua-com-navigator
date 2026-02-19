import { useMemo, useState } from 'react';
import type { LegacyConfidenceDrift, LegacyConfidenceLevel, LegacyConfidencePreview } from '../legacyConfidenceUtils';

type LegacyConfidenceWorkflowPanelProps = {
  preview: LegacyConfidencePreview;
  minLevel: LegacyConfidenceLevel;
  strictMinLevel: boolean;
  maxItems: string;
  onMinLevelChange: (value: LegacyConfidenceLevel) => void;
  onStrictMinLevelChange: (value: boolean) => void;
  onMaxItemsChange: (value: string) => void;
  drift: LegacyConfidenceDrift | null;
};

export default function LegacyConfidenceWorkflowPanel({
  preview,
  minLevel,
  strictMinLevel,
  maxItems,
  onMinLevelChange,
  onStrictMinLevelChange,
  onMaxItemsChange,
  drift,
}: LegacyConfidenceWorkflowPanelProps) {
  const [causeFilter, setCauseFilter] = useState<'all' | string>('all');
  const [searchValue, setSearchValue] = useState('');

  const causeEntries = Object.entries(preview.rootCauseCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const filteredCandidates = useMemo(() => {
    const search = searchValue.trim().toLowerCase();
    return preview.candidates.filter((entry) => {
      if (causeFilter !== 'all' && !entry.causes.includes(causeFilter as any)) {
        return false;
      }
      if (!search) {
        return true;
      }
      const sourceText = `${entry.objectName} ${entry.targetField} ${entry.sourceFile} ${entry.causes.join(' ')}`.toLowerCase();
      return sourceText.includes(search);
    });
  }, [preview.candidates, causeFilter, searchValue]);

  const recommendedAction = (() => {
    if (preview.selection.fallbackUsed) {
      return 'Recommended next action: switch min-level to high or disable strict mode only when you need a full ranked review.';
    }
    if (preview.rootCauseCounts['heuristic-alias-mapping'] > 0) {
      return 'Recommended next action: review heuristic alias mappings first (for example HelpKey/generic cases) before bulk apply.';
    }
    if (preview.rootCauseCounts['unresolved-variable-mappings'] > 0) {
      return 'Recommended next action: resolve required variable mappings and rerun conversion to move conditional stubs toward direct.';
    }
    if (preview.rootCauseCounts['regex-branch-complexity'] > 0) {
      return 'Recommended next action: validate regex branch candidates with sample payloads to confirm capture and fallback behavior.';
    }
    if (preview.rootCauseCounts['manual-expression-shape'] > 0) {
      return 'Recommended next action: handle manual-expression candidates first and capture any reusable parser pattern.';
    }
    return 'Recommended next action: rerun after new rule examples and track drift to confirm confidence is improving.';
  })();

  return (
    <>
      <div className="legacy-report-divider" aria-hidden="true" />
      <div className="legacy-report-card">
        <div className="legacy-report-title">Confidence Workflow</div>
        <div className="legacy-report-muted">
          Triage uses confidence scoring from conversion stubs and mirrors calibration behavior (min-level + strict fallback).
        </div>
        <div className="legacy-confidence-presets">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onMinLevelChange('low');
              onStrictMinLevelChange(true);
            }}
          >
            Risk only
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onMinLevelChange('medium');
              onStrictMinLevelChange(false);
            }}
          >
            Balanced
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onMinLevelChange('high');
              onStrictMinLevelChange(false);
            }}
          >
            Full review
          </button>
        </div>
        <div className="legacy-confidence-controls">
          <label className="legacy-report-hint" htmlFor="legacy-confidence-min-level">
            Min level
            <select
              id="legacy-confidence-min-level"
              className="legacy-filter-input"
              value={minLevel}
              onChange={(event) => onMinLevelChange(event.target.value as LegacyConfidenceLevel)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
          <label className="legacy-report-hint" htmlFor="legacy-confidence-max-items">
            Max items
            <input
              id="legacy-confidence-max-items"
              className="legacy-filter-input"
              value={maxItems}
              onChange={(event) => onMaxItemsChange(event.target.value)}
              inputMode="numeric"
              placeholder="10"
            />
          </label>
          <label className="legacy-report-hint legacy-inline-check" htmlFor="legacy-confidence-strict">
            <input
              id="legacy-confidence-strict"
              type="checkbox"
              checked={strictMinLevel}
              onChange={(event) => onStrictMinLevelChange(event.target.checked)}
            />
            Strict min-level
          </label>
        </div>
        <div className="legacy-report-line legacy-report-muted">
          Stub totals: {preview.totals.stubs} · high {preview.totals.high} · medium {preview.totals.medium} · low{' '}
          {preview.totals.low}
        </div>
        <div className="legacy-report-line legacy-report-muted">
          Conversion statuses: direct {preview.totals.direct} · conditional {preview.totals.conditional} · manual{' '}
          {preview.totals.manual}
        </div>
        <div className="legacy-report-line legacy-report-muted">
          Eligible: {preview.selection.eligibleByMinLevel} · Selected: {preview.selection.selectedCount}
          {preview.selection.fallbackUsed ? ' · Fallback used (lowest global risk set)' : ''}
        </div>
        <div className="legacy-report-banner legacy-confidence-next-action">{recommendedAction}</div>
        {causeEntries.length > 0 && (
          <div className="legacy-report-line legacy-report-muted">
            Root causes: {causeEntries.map(([cause, count]) => `${cause} (${count})`).join(' · ')}
          </div>
        )}
        {drift && (
          <div className="legacy-report-banner">
            Drift vs previous run · common {drift.selectionChange.common} · added {drift.selectionChange.added} ·
            removed {drift.selectionChange.removed} · improved {drift.scoreChange.improved} · regressed{' '}
            {drift.scoreChange.regressed}
          </div>
        )}
      </div>
      <div className="legacy-report-card">
        <div className="legacy-report-title">Top Risk Candidates</div>
        <div className="legacy-confidence-controls">
          <label className="legacy-report-hint" htmlFor="legacy-confidence-cause-filter">
            Cause filter
            <select
              id="legacy-confidence-cause-filter"
              className="legacy-filter-input"
              value={causeFilter}
              onChange={(event) => setCauseFilter(event.target.value)}
            >
              <option value="all">all</option>
              {causeEntries.map(([cause]) => (
                <option key={cause} value={cause}>
                  {cause}
                </option>
              ))}
            </select>
          </label>
          <label className="legacy-report-hint" htmlFor="legacy-confidence-search">
            Search
            <input
              id="legacy-confidence-search"
              className="legacy-filter-input"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Object, field, source..."
            />
          </label>
          <div className="legacy-report-hint">Showing {filteredCandidates.length} / {preview.candidates.length}</div>
        </div>
        {filteredCandidates.length === 0 ? (
          <div className="legacy-report-muted">No candidates for current filter mode.</div>
        ) : (
          <div className="legacy-confidence-list">
            {filteredCandidates.map((entry, index) => (
              <div key={entry.key} className="legacy-confidence-item">
                <div className="legacy-report-line">
                  <strong>
                    {index + 1}. {entry.objectName}
                  </strong>
                  <span className="legacy-report-hint">
                    {entry.targetField} · score {entry.confidenceScore.toFixed(2)} · {entry.confidenceLevel}
                  </span>
                </div>
                <div className="legacy-report-muted">
                  {entry.status} · {entry.recommendedProcessor}
                  {entry.requiredMappings.length > 0
                    ? ` · required mappings: ${entry.requiredMappings.join('|')}`
                    : ''}
                </div>
                <div className="legacy-report-muted">Causes: {entry.causes.join(' · ') || 'none'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
