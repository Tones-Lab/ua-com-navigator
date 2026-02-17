import type { RefObject } from 'react';
import Modal from '../../components/Modal';

type TrapComposerModalProps = {
  open: boolean;
  trapModalRef: RefObject<HTMLDivElement>;
  bulkTrapContext: any;
  trapSource: 'mib' | 'fcom';
  trapSending: boolean;
  bulkTrapSummary: { passed: number; failed: number; total: number } | null;
  bulkTrapProgress: { current: number; total: number; failed: number; currentLabel: string };
  bulkTrapFailures: Array<{ objectName: string; message: string }>;
  bulkTrapShowAllFailures: boolean;
  setBulkTrapShowAllFailures: (next: boolean | ((prev: boolean) => boolean)) => void;
  retryFailedTraps: () => void;
  trapServerError: string | null;
  trapServerList: any[];
  trapHost: string;
  setTrapHost: (value: string) => void;
  trapManualOpen: boolean;
  setTrapManualOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  trapPort: number;
  setTrapPort: (value: number) => void;
  recentTargets: string[];
  trapVersion: string;
  setTrapVersion: (value: string) => void;
  trapCommunity: string;
  setTrapCommunity: (value: string) => void;
  trapOid: string;
  setTrapOid: (value: string) => void;
  trapVarbinds: Array<{ oid: string; type: string; value: string }>;
  setTrapVarbinds: (
    next:
      | Array<{ oid: string; type: string; value: string }>
      | ((prev: Array<{ oid: string; type: string; value: string }>) => Array<{
          oid: string;
          type: string;
          value: string;
        }>),
  ) => void;
  trapError: string | null;
  triggerValidationPulse: (container: HTMLElement | null) => void;
  sendBulkTraps: () => void;
  sendTrap: () => void;
  onClose: () => void;
};

export default function TrapComposerModal({
  open,
  trapModalRef,
  bulkTrapContext,
  trapSource,
  trapSending,
  bulkTrapSummary,
  bulkTrapProgress,
  bulkTrapFailures,
  bulkTrapShowAllFailures,
  setBulkTrapShowAllFailures,
  retryFailedTraps,
  trapServerError,
  trapServerList,
  trapHost,
  setTrapHost,
  trapManualOpen,
  setTrapManualOpen,
  trapPort,
  setTrapPort,
  recentTargets,
  trapVersion,
  setTrapVersion,
  trapCommunity,
  setTrapCommunity,
  trapOid,
  setTrapOid,
  trapVarbinds,
  setTrapVarbinds,
  trapError,
  triggerValidationPulse,
  sendBulkTraps,
  sendTrap,
  onClose,
}: TrapComposerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal className="modal-wide" ariaLabel="Send SNMP Trap" containerRef={trapModalRef}>
      <h3>
        {bulkTrapContext
          ? `Sending ${bulkTrapContext.total} SNMP traps — ${bulkTrapContext.label}`
          : 'Send SNMP Trap'}
      </h3>
      {bulkTrapContext ? (
        <div className="muted">Using test commands from FCOM objects.</div>
      ) : (
        trapSource === 'fcom' && <div className="muted">Prefilled from FCOM test command.</div>
      )}
      {bulkTrapContext && (
        <div className="panel-section">
          <div className="panel-section-title">Progress</div>
          {!trapSending && !bulkTrapSummary ? (
            <div className="trap-progress-meta">
              <span>Ready to send {bulkTrapContext.total} SNMP traps.</span>
              {!trapHost && <span className="trap-progress-failed">Select a destination to continue.</span>}
            </div>
          ) : bulkTrapSummary ? (
            <div className="trap-progress-meta">
              <span>
                Completed: {bulkTrapSummary.passed}/{bulkTrapSummary.total} sent, {bulkTrapSummary.failed}{' '}
                failed.
              </span>
            </div>
          ) : (
            <>
              <div className="trap-progress">
                <div
                  className="trap-progress-bar"
                  style={{
                    width:
                      bulkTrapProgress.total > 0
                        ? `${Math.round((bulkTrapProgress.current / bulkTrapProgress.total) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <div className="trap-progress-meta">
                <span>
                  Sending {bulkTrapProgress.current} / {bulkTrapProgress.total}
                </span>
                {bulkTrapProgress.currentLabel && (
                  <span className="trap-progress-current">Now: {bulkTrapProgress.currentLabel}</span>
                )}
                {bulkTrapProgress.failed > 0 && (
                  <span className="trap-progress-failed">Failed: {bulkTrapProgress.failed}</span>
                )}
              </div>
            </>
          )}
          {bulkTrapFailures.length > 0 && (
            <div className="trap-progress-failures">
              <div className="trap-progress-failure-header">
                <span>{bulkTrapFailures.length} failures</span>
                {bulkTrapFailures.length > 3 && (
                  <button
                    type="button"
                    className="builder-link"
                    onClick={() => setBulkTrapShowAllFailures((prev) => !prev)}
                  >
                    {bulkTrapShowAllFailures ? 'Hide failures' : 'View failures'}
                  </button>
                )}
                <button type="button" className="builder-link" onClick={retryFailedTraps} disabled={trapSending}>
                  Retry failed
                </button>
              </div>
              {bulkTrapShowAllFailures || bulkTrapFailures.length <= 3 ? (
                <div className="trap-progress-failure-list">
                  {bulkTrapFailures.map((failure) => (
                    <details key={`${failure.objectName}-failure`}>
                      <summary className="trap-progress-failure-summary">
                        {failure.objectName} — failed to send
                      </summary>
                      <div className="trap-progress-failure-detail">{failure.message}</div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="trap-progress-failure-collapsed">
                  Too many failures to display. Click “View failures” to inspect.
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="panel-section">
        <div className="panel-section-title">Destination</div>
        {trapServerError && <div className="error">{trapServerError}</div>}
        {trapServerList.length > 0 && (
          <label className="mib-field">
            Server list
            <select
              value={trapHost}
              onChange={(e) => {
                setTrapHost(e.target.value);
                if (e.target.value) {
                  setTrapManualOpen(false);
                }
              }}
              data-error={!trapHost ? 'true' : undefined}
              aria-invalid={!trapHost}
            >
              <option value="">Select a server</option>
              {trapServerList.map((server) => (
                <option key={server.ServerID || server.ServerName} value={server.ServerHostFQDN || server.ServerName}>
                  {server.ServerName || server.ServerHostFQDN}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="ghost-button" onClick={() => setTrapManualOpen((prev) => !prev)}>
          {trapManualOpen ? 'Hide manual entry' : 'Manual destination'}
        </button>
        {trapManualOpen && (
          <div className="mib-manual-entry">
            <label className="mib-field">
              Host or IP
              <input
                type="text"
                placeholder="10.0.0.10"
                value={trapHost}
                onChange={(e) => setTrapHost(e.target.value)}
                data-error={!trapHost ? 'true' : undefined}
                aria-invalid={!trapHost}
              />
            </label>
            <label className="mib-field">
              Port
              <input type="number" value={trapPort} onChange={(e) => setTrapPort(Number(e.target.value))} />
            </label>
          </div>
        )}
        {recentTargets.length > 0 && (
          <label className="mib-field">
            Recent destinations
            <select value="" onChange={(e) => setTrapHost(e.target.value)}>
              <option value="">Select recent</option>
              {recentTargets.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!bulkTrapContext && (
        <div className="panel-section">
          <div className="panel-section-title">Trap</div>
          <div className="mib-trap-grid">
            <label className="mib-field">
              Version
              <select value={trapVersion} onChange={(e) => setTrapVersion(e.target.value)}>
                <option value="2c">v2c</option>
              </select>
            </label>
            <label className="mib-field">
              Community
              <input type="text" value={trapCommunity} onChange={(e) => setTrapCommunity(e.target.value)} />
            </label>
            <label className="mib-field mib-field-wide">
              Trap OID
              <input
                type="text"
                value={trapOid}
                onChange={(e) => setTrapOid(e.target.value)}
                data-error={!trapOid ? 'true' : undefined}
                aria-invalid={!trapOid}
              />
            </label>
          </div>
          <div className="panel-section-title">Varbinds</div>
          <div className="mib-varbinds">
            {trapVarbinds.length === 0 && <div className="empty-state">No varbinds yet.</div>}
            {trapVarbinds.map((binding, index) => (
              <div key={`${binding.oid}-${index}`} className="mib-varbind-row">
                <input
                  type="text"
                  placeholder="OID"
                  value={binding.oid}
                  onChange={(e) =>
                    setTrapVarbinds((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, oid: e.target.value } : item)),
                    )
                  }
                />
                <select
                  value={binding.type}
                  onChange={(e) =>
                    setTrapVarbinds((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, type: e.target.value } : item)),
                    )
                  }
                >
                  <option value="s">string</option>
                  <option value="i">integer</option>
                  <option value="u">unsigned</option>
                  <option value="t">timeticks</option>
                  <option value="o">oid</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  value={binding.value}
                  onChange={(e) =>
                    setTrapVarbinds((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, value: e.target.value } : item)),
                    )
                  }
                />
                <button
                  type="button"
                  className="builder-link"
                  onClick={() => setTrapVarbinds((prev) => prev.filter((_item, idx) => idx !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="builder-link"
              onClick={() => setTrapVarbinds((prev) => [...prev, { oid: '', type: 's', value: '' }])}
            >
              Add varbind
            </button>
          </div>
        </div>
      )}
      {trapError && <div className="error">{trapError}</div>}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          aria-disabled={
            trapSending || (bulkTrapContext ? !trapHost || Boolean(bulkTrapSummary) : !trapHost || !trapOid)
          }
          className={`builder-card builder-card-primary${
            trapSending || (bulkTrapContext ? !trapHost || Boolean(bulkTrapSummary) : !trapHost || !trapOid)
              ? ' button-disabled'
              : ''
          }`}
          onClick={() => {
            const disabled =
              trapSending || (bulkTrapContext ? !trapHost || Boolean(bulkTrapSummary) : !trapHost || !trapOid);
            if (disabled) {
              triggerValidationPulse(trapModalRef.current);
              return;
            }
            if (bulkTrapContext) {
              sendBulkTraps();
              return;
            }
            sendTrap();
          }}
        >
          {trapSending ? 'Sending…' : bulkTrapContext ? 'Send Traps' : 'Send Trap'}
        </button>
      </div>
    </Modal>
  );
}
