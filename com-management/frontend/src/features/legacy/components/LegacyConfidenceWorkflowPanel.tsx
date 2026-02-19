import { useMemo, useState } from 'react';
import type { LegacyConfidenceDrift, LegacyConfidenceLevel, LegacyConfidencePreview } from '../legacyConfidenceUtils';
import type { LegacyRunPipelineResponse } from '../../../types/api';

type LegacyConfidenceWorkflowPanelProps = {
  preview: LegacyConfidencePreview;
  minLevel: LegacyConfidenceLevel;
  strictMinLevel: boolean;
  maxItems: string;
  onMinLevelChange: (value: LegacyConfidenceLevel) => void;
  onStrictMinLevelChange: (value: boolean) => void;
  onMaxItemsChange: (value: string) => void;
  drift: LegacyConfidenceDrift | null;
  hasBaseline: boolean;
  baselineGeneratedAt: string | null;
  onSaveBaseline: () => void;
  onClearBaseline: () => void;
  driftSourceLabel: string;
  pipelineInputPath: string;
  pipelineRunName: string;
  pipelineOutputRoot: string;
  pipelineCompareMode: 'none' | 'latest' | 'before';
  pipelineCompareBeforePath: string;
  onPipelineInputPathChange: (value: string) => void;
  onPipelineRunNameChange: (value: string) => void;
  onPipelineOutputRootChange: (value: string) => void;
  onPipelineCompareModeChange: (value: 'none' | 'latest' | 'before') => void;
  onPipelineCompareBeforePathChange: (value: string) => void;
  pipelineCommand: string;
  pipelineLatestCommand: string;
  calibrationCommand: string;
  compareCommand: string;
  onCopyPipelineCommand: () => void;
  onCopyPipelineLatestCommand: () => void;
  onCopyCalibrationCommand: () => void;
  onCopyCompareCommand: () => void;
  onDownloadPipelineRecipe: () => void;
  pipelineRunning: boolean;
  pipelineRunError: string | null;
  pipelineRunResult: LegacyRunPipelineResponse | null;
  onRunPipeline: () => void;
  onDownloadPipelineManifest: () => void;
  onCopyPipelineOutputDir: () => void;
  showPipelineAssistant?: boolean;
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
  hasBaseline,
  baselineGeneratedAt,
  onSaveBaseline,
  onClearBaseline,
  driftSourceLabel,
  pipelineInputPath,
  pipelineRunName,
  pipelineOutputRoot,
  pipelineCompareMode,
  pipelineCompareBeforePath,
  onPipelineInputPathChange,
  onPipelineRunNameChange,
  onPipelineOutputRootChange,
  onPipelineCompareModeChange,
  onPipelineCompareBeforePathChange,
  pipelineCommand,
  pipelineLatestCommand,
  calibrationCommand,
  compareCommand,
  onCopyPipelineCommand,
  onCopyPipelineLatestCommand,
  onCopyCalibrationCommand,
  onCopyCompareCommand,
  onDownloadPipelineRecipe,
  pipelineRunning,
  pipelineRunError,
  pipelineRunResult,
  onRunPipeline,
  onDownloadPipelineManifest,
  onCopyPipelineOutputDir,
  showPipelineAssistant = true,
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
      return 'Recommended next action: review parser-derived variable lineage and explicit mappings first before bulk apply.';
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
          <button type="button" className="ghost-button" onClick={onSaveBaseline}>
            Save baseline
          </button>
          <button type="button" className="ghost-button" disabled={!hasBaseline} onClick={onClearBaseline}>
            Clear baseline
          </button>
        </div>
        {hasBaseline && (
          <div className="legacy-report-hint">
            Baseline saved{baselineGeneratedAt ? ` · ${new Date(baselineGeneratedAt).toLocaleString()}` : ''}
          </div>
        )}
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
            Drift source: {driftSourceLabel} ·
            {' '}
            Drift vs previous run · common {drift.selectionChange.common} · added {drift.selectionChange.added} ·
            removed {drift.selectionChange.removed} · improved {drift.scoreChange.improved} · regressed{' '}
            {drift.scoreChange.regressed}
          </div>
        )}
      </div>
      {showPipelineAssistant && (
      <div className="legacy-report-card">
        <div className="legacy-report-title">Pipeline Command Assistant</div>
        <div className="legacy-report-muted">
          GUI controls below map directly to CLI flags from the new confidence pipeline scripts.
        </div>
        <div className="legacy-confidence-controls legacy-command-assistant-grid">
          <label className="legacy-report-hint" htmlFor="legacy-pipeline-input-path">
            Input folder
            <input
              id="legacy-pipeline-input-path"
              className="legacy-filter-input"
              value={pipelineInputPath}
              onChange={(event) => onPipelineInputPathChange(event.target.value)}
              placeholder="/root/navigator/rules/legacy/uploads/NCE"
            />
          </label>
          <label className="legacy-report-hint" htmlFor="legacy-pipeline-run-name">
            Run name
            <input
              id="legacy-pipeline-run-name"
              className="legacy-filter-input"
              value={pipelineRunName}
              onChange={(event) => onPipelineRunNameChange(event.target.value)}
              placeholder="nce-iter-1"
            />
          </label>
          <label className="legacy-report-hint" htmlFor="legacy-pipeline-output-root">
            Output root
            <input
              id="legacy-pipeline-output-root"
              className="legacy-filter-input"
              value={pipelineOutputRoot}
              onChange={(event) => onPipelineOutputRootChange(event.target.value)}
              placeholder="/root/navigator/tmp/legacy-analysis/pipeline"
            />
          </label>
          <label className="legacy-report-hint" htmlFor="legacy-pipeline-compare-mode">
            Compare mode
            <select
              id="legacy-pipeline-compare-mode"
              className="legacy-filter-input"
              value={pipelineCompareMode}
              onChange={(event) => onPipelineCompareModeChange(event.target.value as 'none' | 'latest' | 'before')}
            >
              <option value="none">none</option>
              <option value="latest">latest prior run</option>
              <option value="before">explicit baseline path</option>
            </select>
          </label>
          {pipelineCompareMode === 'before' && (
            <label className="legacy-report-hint" htmlFor="legacy-pipeline-compare-before">
              Compare before path
              <input
                id="legacy-pipeline-compare-before"
                className="legacy-filter-input"
                value={pipelineCompareBeforePath}
                onChange={(event) => onPipelineCompareBeforePathChange(event.target.value)}
                placeholder="/root/navigator/tmp/legacy-analysis/pipeline/baseline/calibration/legacy-confidence-calibration.json"
              />
            </label>
          )}
        </div>
        <div className="legacy-confidence-presets">
          <button type="button" className="ghost-button" onClick={onCopyPipelineCommand}>
            Copy legacy:pipeline
          </button>
          <button type="button" className="ghost-button" onClick={onCopyPipelineLatestCommand}>
            Copy legacy:pipeline:latest
          </button>
          <button type="button" className="ghost-button" onClick={onCopyCalibrationCommand}>
            Copy confidence-calibrate
          </button>
          <button type="button" className="ghost-button" onClick={onCopyCompareCommand}>
            Copy confidence-compare
          </button>
          <button type="button" className="ghost-button" onClick={onDownloadPipelineRecipe}>
            Download pipeline recipe
          </button>
          <button type="button" className="ghost-button" onClick={onRunPipeline} disabled={pipelineRunning}>
            {pipelineRunning ? 'Running pipeline…' : 'Run pipeline in app'}
          </button>
        </div>
        {pipelineRunError && <div className="legacy-report-banner legacy-report-banner-warn">{pipelineRunError}</div>}
        {pipelineRunResult && (
          <div className="legacy-report-banner">
            Pipeline run complete · {pipelineRunResult.runName}
            <span className="legacy-confidence-run-actions">
              <button type="button" className="ghost-button" onClick={onCopyPipelineOutputDir}>
                Copy output path
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onDownloadPipelineManifest}
                disabled={!pipelineRunResult.manifest}
              >
                Download manifest
              </button>
            </span>
          </div>
        )}
        <div className="legacy-report-hint">Pipeline command</div>
        <pre className="legacy-command-preview">{pipelineCommand}</pre>
        <div className="legacy-report-hint">Pipeline latest shortcut</div>
        <pre className="legacy-command-preview">{pipelineLatestCommand}</pre>
        <div className="legacy-report-hint">Calibration command</div>
        <pre className="legacy-command-preview">{calibrationCommand}</pre>
        <div className="legacy-report-hint">Drift compare command</div>
        <pre className="legacy-command-preview">{compareCommand}</pre>
      </div>
      )}
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
