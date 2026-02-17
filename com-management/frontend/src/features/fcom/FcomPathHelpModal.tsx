import Modal from '../../components/Modal';

type FcomPathHelpModalProps = {
  open: boolean;
  currentPath: string;
  onClose: () => void;
};

export default function FcomPathHelpModal({ open, currentPath, onClose }: FcomPathHelpModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal ariaLabel="Tool Overview">
      <h3>Tool Overview</h3>
      <div className="help-section">
        <h4>Current Path</h4>
        <div className="path-row">
          <div className="path-value monospace">{currentPath}</div>
          <button
            type="button"
            className="copy-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(currentPath);
              } catch {
                // ignore
              }
            }}
          >
            Copy
          </button>
        </div>
        <p className="path-note">
          UA internal paths use an <span className="code-pill">id-core</span> prefix. The UI displays
          the cleaned path for readability.
        </p>
      </div>
      <div className="help-section">
        <h4>Search modes</h4>
        <ul>
          <li>
            <strong>Names</strong>: searches file and folder names (and paths).
          </li>
          <li>
            <strong>Content</strong>: searches inside file contents only.
          </li>
          <li>
            <strong>All</strong>: searches both names and contents.
          </li>
        </ul>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
