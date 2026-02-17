import Modal from '../../components/Modal';

type FcomBuilderHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function FcomBuilderHelpModal({ open, onClose }: FcomBuilderHelpModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal className="modal-wide" ariaLabel="Builder Help">
      <h3>Builder Help</h3>
      <div className="builder-help-section">
        <h4>Processor Builder</h4>
        <p>
          Use processors to transform or set event fields after a match. Select a processor,
          configure inputs, and review the generated JSON before applying.
        </p>
        <ul>
          <li>
            <strong>Set</strong>: assign a literal or copy from a field path.
          </li>
          <li>
            <strong>Regex</strong>: extract a value using a capture group.
          </li>
        </ul>
      </div>
      <div className="builder-help-section">
        <h4>Eval Builder</h4>
        <p>
          Use Friendly for guided conditions or Regular for raw expressions. Click $v tokens to see
          trap variable details.
        </p>
      </div>
      <div className="builder-help-section">
        <h4>References</h4>
        <p>Docs: architecture/FCOM_Curation_UI_Plan.md</p>
        <p>UA REST/processor docs (internal UA documentation).</p>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
