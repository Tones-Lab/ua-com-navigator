import Modal from '../../components/Modal';

type FcomFieldReferenceModalProps = {
  open: boolean;
  hasModalOnTop: boolean;
  availableEventFields: string[];
  getEventFieldDescription: (field: string) => string;
  getModalOverlayStyle: (id: string, fallbackLevel?: number) => { zIndex: number };
  onClose: () => void;
};

export default function FcomFieldReferenceModal({
  open,
  hasModalOnTop,
  availableEventFields,
  getEventFieldDescription,
  getModalOverlayStyle,
  onClose,
}: FcomFieldReferenceModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal
      className="modal-wide"
      overlayClassName={hasModalOnTop ? 'modal-overlay-top' : undefined}
      style={getModalOverlayStyle('fieldReference', 2)}
      ariaLabel="Field Reference"
    >
      <h3>Field Reference</h3>
      <div className="field-reference">
        <div className="field-reference-section">
          <div className="field-reference-title">Common JSON paths</div>
          <ul>
            <li>$.event.* (post scope event fields)</li>
            <li>$.trap.*, $.syslog.* (method-specific inputs)</li>
            <li>$.localmem.* (per-event memory)</li>
            <li>$.globalmem.* (requires Coherence)</li>
            <li>$.lookups.&lt;lookup&gt;.&lt;key&gt;</li>
            <li>$.foreach.&lt;keyField|valField&gt;</li>
            <li>$.error.message</li>
          </ul>
        </div>
        <div className="field-reference-section">
          <div className="field-reference-title">Event fields (from this file)</div>
          {availableEventFields.length === 0 ? (
            <div className="field-reference-empty">No event fields found in this file.</div>
          ) : (
            <div className="field-reference-grid">
              {availableEventFields.map((field) => (
                <span
                  key={field}
                  className="field-reference-chip"
                  title={getEventFieldDescription(field)}
                >
                  $.event.{field}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
