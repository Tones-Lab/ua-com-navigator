import {
  useFcomBuilderActionsContext,
  useFcomBuilderViewContext,
} from './FcomBuilderContext';

export default function FcomBuilderLiteralSection() {
  const { isBuilderTargetReady, builderLiteralText, literalDirty } = useFcomBuilderViewContext();
  const {
    handleLiteralInputChange,
    applyLiteralValue,
  } = useFcomBuilderActionsContext();
  return (
    <div className="builder-section">
      <div className="builder-section-title">Literal Editor</div>
      <div className="builder-regular-input">
        <textarea
          className="builder-textarea"
          placeholder="Enter literal value"
          value={builderLiteralText}
          onChange={(e) =>
            handleLiteralInputChange(
              e.target.value,
              e.target.selectionStart,
              (e.nativeEvent as InputEvent | undefined)?.inputType,
            )
          }
          disabled={!isBuilderTargetReady}
        />
      </div>
      <div className="builder-regular-actions">
        <button
          type="button"
          className="builder-card builder-card-primary"
          disabled={!isBuilderTargetReady || !literalDirty}
          onClick={applyLiteralValue}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
