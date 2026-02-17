import BuilderLink from '../../../components/BuilderLink';

type FcomProcessorReviewStepProps = {
  builderPatchMode: boolean;
  builderPatchPreview: Record<string, unknown> | null;
  processorPayload: Record<string, unknown> | null;
  showProcessorJson: boolean;
  setShowProcessorJson: (updater: (prev: boolean) => boolean) => void;
  getProcessorSummaryLines: (payload: unknown) => string[];
  setProcessorStep: (step: 'select' | 'configure' | 'review') => void;
  applyProcessor: () => void;
};

export default function FcomProcessorReviewStep({
  builderPatchMode,
  builderPatchPreview,
  processorPayload,
  showProcessorJson,
  setShowProcessorJson,
  getProcessorSummaryLines,
  setProcessorStep,
  applyProcessor,
}: FcomProcessorReviewStepProps) {
  return (
    <div className="processor-review">
      <div className="builder-preview">
        <div className="builder-preview-header">
          <div className="builder-preview-label">{builderPatchMode ? 'Patch Preview' : 'Preview'}</div>
          <BuilderLink onClick={() => setShowProcessorJson((prev) => !prev)}>
            {showProcessorJson ? 'Hide JSON' : 'Show JSON'}
          </BuilderLink>
        </div>
        {!builderPatchMode && (
          <div className="builder-preview-lines">
            {(getProcessorSummaryLines(processorPayload) || []).map((line, idx) => (
              <span key={`${line}-${idx}`}>{line}</span>
            ))}
          </div>
        )}
        {showProcessorJson && (
          <pre className="code-block">
            {JSON.stringify(builderPatchMode ? builderPatchPreview : processorPayload, null, 2) || '—'}
          </pre>
        )}
      </div>
      <div className="processor-review-actions">
        <button type="button" className="ghost-button" onClick={() => setProcessorStep('configure')}>
          Back to Configure
        </button>
        <button
          type="button"
          className="builder-card builder-card-primary"
          onClick={applyProcessor}
          disabled={!processorPayload}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
