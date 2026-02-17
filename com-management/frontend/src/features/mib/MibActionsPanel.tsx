type MibActionsPanelProps = {
  hasEditPermission: boolean;
  mib2FcomLoading: boolean;
  mibUseParent: boolean;
  mib2FcomError: string | null;
  mibOutput: string;
  mibOutputName: string;
  runMib2Fcom: () => void;
  setMibUseParent: (value: boolean) => void;
  setMibOutput: (value: string) => void;
};

export default function MibActionsPanel({
  hasEditPermission,
  mib2FcomLoading,
  mibUseParent,
  mib2FcomError,
  mibOutput,
  mibOutputName,
  runMib2Fcom,
  setMibUseParent,
  setMibOutput,
}: MibActionsPanelProps) {
  return (
    <>
      <div className="mib-actions">
        <button
          type="button"
          className="action-link"
          onClick={runMib2Fcom}
          disabled={!hasEditPermission || mib2FcomLoading}
          title={hasEditPermission ? '' : 'Read-only access'}
        >
          {mib2FcomLoading ? 'Running…' : 'Run MIB2FCOM'}
        </button>
        <label className="mib-checkbox">
          <input
            type="checkbox"
            checked={mibUseParent}
            onChange={(e) => setMibUseParent(e.target.checked)}
            disabled={!hasEditPermission}
          />
          Use parent MIBs
        </label>
      </div>
      {mib2FcomError && <div className="error">{mib2FcomError}</div>}
      {mibOutput && (
        <div className="panel-section">
          <div className="panel-section-title">
            MIB2FCOM Output{mibOutputName ? ` (${mibOutputName})` : ''}
          </div>
          <textarea
            className="mib-output"
            value={mibOutput}
            onChange={(e) => setMibOutput(e.target.value)}
            disabled={!hasEditPermission}
          />
        </div>
      )}
    </>
  );
}
