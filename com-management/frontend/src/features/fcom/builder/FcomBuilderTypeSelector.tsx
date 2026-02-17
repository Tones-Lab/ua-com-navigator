import {
  useFcomBuilderActionsContext,
  useFcomBuilderViewContext,
} from './FcomBuilderContext';
import type { BuilderType } from './types';

export default function FcomBuilderTypeSelector() {
  const { builderFocus, builderTypeLocked, isBuilderTargetReady } = useFcomBuilderViewContext();
  const {
    setBuilderSwitchModal,
    applyBuilderTypeSwitch,
  } = useFcomBuilderActionsContext();
  return (
    <div className="builder-section">
      <div className="builder-section-title">
        Builder Type{builderFocus ? '' : ' (Select one)'}
      </div>
      {!isBuilderTargetReady && <div className="builder-hint">Select a field in Edit mode.</div>}
      {isBuilderTargetReady && !builderFocus && (
        <div className="builder-hint">Choose Eval or Processor to continue.</div>
      )}
      <div className="builder-focus-row">
        {(['literal', 'eval', 'processor'] as BuilderType[]).map((type) => {
          const isSelected = builderFocus === type;
          return (
            <button
              key={type}
              type="button"
              className={isSelected ? 'builder-card builder-card-selected' : 'builder-card'}
              disabled={!isBuilderTargetReady || builderTypeLocked === type}
              onClick={() => {
                if (builderTypeLocked && builderTypeLocked !== type) {
                  setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: type });
                  return;
                }
                applyBuilderTypeSwitch(type);
              }}
            >
              {type === 'literal' ? 'Literal' : type === 'eval' ? 'Eval' : 'Processor'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
