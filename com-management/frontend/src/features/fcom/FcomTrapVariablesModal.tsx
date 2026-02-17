import type { MutableRefObject, ReactNode } from 'react';
import Modal from '../../components/Modal';
import Pill from '../../components/Pill';

type FcomTrapVariablesModalProps = {
  open: boolean;
  mode: 'view' | 'insert';
  variables: any[];
  selectedToken: string | null;
  varListRef: MutableRefObject<HTMLDivElement | null>;
  varRowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  renderValue: (value: any, trapVars?: any[]) => ReactNode;
  formatDescription: (value: any) => ReactNode;
  renderEnums: (enums: any) => ReactNode;
  getModalOverlayStyle: (id: string, fallbackLevel?: number) => { zIndex: number };
  onInsertSelect: (token: string) => void;
  onClose: () => void;
};

export default function FcomTrapVariablesModal({
  open,
  mode,
  variables,
  selectedToken,
  varListRef,
  varRowRefs,
  renderValue,
  formatDescription,
  renderEnums,
  getModalOverlayStyle,
  onInsertSelect,
  onClose,
}: FcomTrapVariablesModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal
      className="modal-wide"
      style={getModalOverlayStyle('varModal', 2)}
      ariaLabel="Trap variables"
    >
      <h3>
        Trap variables ({variables.length})
        {selectedToken ? ` for ${selectedToken}` : ''}
      </h3>
      {mode === 'insert' && <p className="muted">Select a variable to insert.</p>}
      {variables.length === 0 ? (
        <div className="empty-state">No trap variables available.</div>
      ) : (
        <div className="var-list" ref={varListRef}>
          {variables.map((variable: any, index: number) => {
            const token = `$v${index + 1}`;
            const isSelected = token === selectedToken;
            return (
              <div
                className={`trap-var${isSelected ? ' trap-var-selected' : ''}${mode === 'insert' ? ' trap-var-clickable' : ''}`}
                key={variable?.name || variable?.oid || index}
                ref={(el) => {
                  varRowRefs.current[token] = el;
                }}
                role={mode === 'insert' ? 'button' : undefined}
                tabIndex={mode === 'insert' ? 0 : undefined}
                onClick={() => {
                  if (mode === 'insert') {
                    onInsertSelect(token);
                  }
                }}
                onKeyDown={(e) => {
                  if (mode === 'insert' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onInsertSelect(token);
                  }
                }}
              >
                <div className="trap-var-title">
                  <span className="trap-var-name">{renderValue(variable?.name)}</span>
                  <Pill className={isSelected ? 'pill-selected' : ''}>{token}</Pill>
                  {variable?.valueType && <Pill>{variable.valueType}</Pill>}
                </div>
                <div className="trap-var-grid">
                  <div className="trap-var-col">
                    <div className="trap-var-row">
                      <span className="label">OID</span>
                      <span className="value monospace">{renderValue(variable?.oid)}</span>
                    </div>
                    <div className="trap-var-row">
                      <span className="label">Description</span>
                      <span className="value">{formatDescription(variable?.description)}</span>
                    </div>
                  </div>
                  <div className="trap-var-col">
                    {renderEnums(variable?.enums) || <span className="muted">No enums</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
