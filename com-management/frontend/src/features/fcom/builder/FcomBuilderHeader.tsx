import {
  useFcomBuilderActionsContext,
  useFcomBuilderViewContext,
} from './FcomBuilderContext';
import BuilderLink from '../../../components/BuilderLink';
import Pill from '../../../components/Pill';

export default function FcomBuilderHeader() {
  const { builderTarget, builderOverrideVersion, builderDirty, canUndoBuilder, canRedoBuilder, builderOpen } =
    useFcomBuilderViewContext();
  const {
    handleBuilderUndo,
    handleBuilderRedo,
    setShowBuilderHelpModal,
    requestCancelBuilder,
  } = useFcomBuilderActionsContext();
  return (
    <div className="builder-header">
      <div>
        <h3>Builder</h3>
        <div className="builder-target">
          {builderTarget ? (
            <div className="builder-target-row">
              <span className="builder-target-badge">Editing: {builderTarget.field}</span>
              {(builderOverrideVersion?.mode === 'v2' ||
                builderOverrideVersion?.mode === 'mixed') && (
                <Pill
                  className="override-pill"
                  title="We recommend moving to v3. Click Convert from the main edit panel."
                  aria-label="V2 override warning"
                >
                  !
                </Pill>
              )}
              {builderDirty && <Pill className="unsaved-pill">Unsaved</Pill>}
            </div>
          ) : (
            <span className="builder-target-empty">Select a field to begin</span>
          )}
        </div>
      </div>
      <div className="builder-header-actions">
        {(canUndoBuilder || canRedoBuilder) && (
          <div className="builder-history-actions">
            <BuilderLink
              onClick={handleBuilderUndo}
              disabled={!canUndoBuilder}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </BuilderLink>
            <BuilderLink
              onClick={handleBuilderRedo}
              disabled={!canRedoBuilder}
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </BuilderLink>
          </div>
        )}
        {builderOpen && (
          <button
            type="button"
            className="builder-help-button"
            onClick={() => setShowBuilderHelpModal(true)}
          >
            Help
          </button>
        )}
        {builderTarget && (
          <button type="button" className="builder-cancel-button" onClick={requestCancelBuilder}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
