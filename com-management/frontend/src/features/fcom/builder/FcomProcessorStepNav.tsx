import type { ProcessorStep } from './types';

const PROCESSOR_STEPS: Array<{ key: ProcessorStep; label: string }> = [
  { key: 'select', label: 'Select' },
  { key: 'configure', label: 'Configure' },
  { key: 'review', label: 'Review/Save' },
];

type FcomProcessorStepNavProps = {
  processorStep: ProcessorStep;
  setProcessorStep: (step: ProcessorStep) => void;
  processorType: string | null;
  builderPatchMode: boolean;
  builderPatchPreview: unknown;
  processorPayload: unknown;
};

export default function FcomProcessorStepNav({
  processorStep,
  setProcessorStep,
  processorType,
  builderPatchMode,
  builderPatchPreview,
  processorPayload,
}: FcomProcessorStepNavProps) {
  const isConfigureReady = Boolean(processorType);
  const isReviewReady = builderPatchMode
    ? Boolean(builderPatchPreview)
    : Boolean(processorPayload);

  return (
    <div className="builder-steps">
      {PROCESSOR_STEPS.map((stepItem, index) => {
        const isActive = processorStep === stepItem.key;
        const isEnabled =
          stepItem.key === 'select' ||
          (stepItem.key === 'configure' && isConfigureReady) ||
          (stepItem.key === 'review' && isReviewReady);
        const isComplete =
          stepItem.key === 'select'
            ? isConfigureReady
            : stepItem.key === 'configure'
              ? isReviewReady
              : false;
        const title =
          stepItem.key === 'configure' && !isConfigureReady
            ? 'Select a processor to enable.'
            : stepItem.key === 'review' && !isReviewReady
              ? 'Complete configuration to enable.'
              : '';

        return (
          <button
            key={stepItem.key}
            type="button"
            className={`builder-step${isActive ? ' builder-step-active' : ''}${isComplete ? ' builder-step-complete' : ''}`}
            disabled={!isEnabled}
            title={title}
            onClick={() => {
              if (!isEnabled) {
                return;
              }
              setProcessorStep(stepItem.key);
            }}
          >
            <span className="builder-step-index">{isComplete ? '✓' : index + 1}</span>
            {stepItem.label}
          </button>
        );
      })}
    </div>
  );
}