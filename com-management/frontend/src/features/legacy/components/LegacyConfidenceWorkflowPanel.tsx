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
  const causeEntries = Object.entries(preview.rootCauseCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

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
        {preview.candidates.length === 0 ? (
          <div className="legacy-report-muted">No candidates for current filter mode.</div>
        ) : (
          <div className="legacy-confidence-list">
            {preview.candidates.map((entry, index) => (
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
