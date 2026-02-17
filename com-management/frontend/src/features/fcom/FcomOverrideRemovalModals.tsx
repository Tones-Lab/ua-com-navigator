import Modal from '../../components/Modal';

type RemoveOverrideModalState = {
  open: boolean;
  objectName?: string;
  field?: string;
  baseValue?: string;
  panelKey?: string;
  isNewField?: boolean;
};

type RemoveAllOverridesModalState = {
  open: boolean;
  panelKey?: string;
  fields?: string[];
  baseValues?: Record<string, string>;
  objectName?: string;
  hasAdvancedFlow?: boolean;
};

type FcomOverrideRemovalModalsProps = {
  removeOverrideModal: RemoveOverrideModalState;
  onCloseRemoveOverride: () => void;
  onConfirmRemoveOverride: () => void;
  removeAllOverridesModal: RemoveAllOverridesModalState;
  onCloseRemoveAllOverrides: () => void;
  onConfirmRemoveAllOverrides: () => void;
  onOpenAdvancedFlow: (objectName: string) => void;
};

export default function FcomOverrideRemovalModals({
  removeOverrideModal,
  onCloseRemoveOverride,
  onConfirmRemoveOverride,
  removeAllOverridesModal,
  onCloseRemoveAllOverrides,
  onConfirmRemoveAllOverrides,
  onOpenAdvancedFlow,
}: FcomOverrideRemovalModalsProps) {
  return (
    <>
      {removeOverrideModal.open && (
        <Modal ariaLabel={removeOverrideModal.isNewField ? 'Remove field' : 'Remove override'}>
          <h3>{removeOverrideModal.isNewField ? 'Remove field' : 'Remove override'}</h3>
          <p>
            {removeOverrideModal.isNewField
              ? 'Removing this field will discard it on save.'
              : 'Removing this override will default to original value:'}
          </p>
          {!removeOverrideModal.isNewField && (
            <pre className="code-block">{removeOverrideModal.baseValue ?? '—'}</pre>
          )}
          <p>Are you sure?</p>
          <div className="modal-actions">
            <button type="button" onClick={onCloseRemoveOverride}>
              No
            </button>
            <button type="button" onClick={onConfirmRemoveOverride}>
              Yes
            </button>
          </div>
        </Modal>
      )}

      {removeAllOverridesModal.open && (
        <Modal ariaLabel="Remove all overrides">
          <h3>Remove all overrides</h3>
          {(removeAllOverridesModal.fields?.length || 0) > 0 ? (
            <>
              <p>The below listed fields will be reset to original values:</p>
              <pre className="code-block">
                {JSON.stringify(removeAllOverridesModal.baseValues ?? {}, null, 2)}
              </pre>
              <p>Are you sure?</p>
            </>
          ) : (
            <p>No direct overrides can be removed here.</p>
          )}
          {removeAllOverridesModal.hasAdvancedFlow && (
            <>
              <p className="modal-warning">Advanced Flow processors won’t be removed here.</p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  const objectName = removeAllOverridesModal.objectName;
                  if (objectName) {
                    onOpenAdvancedFlow(objectName);
                  }
                }}
              >
                Open Advanced Flow
              </button>
            </>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onCloseRemoveAllOverrides}>
              {(removeAllOverridesModal.fields?.length || 0) > 0 ? 'No' : 'Close'}
            </button>
            {(removeAllOverridesModal.fields?.length || 0) > 0 && (
              <button type="button" onClick={onConfirmRemoveAllOverrides}>
                Yes
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
