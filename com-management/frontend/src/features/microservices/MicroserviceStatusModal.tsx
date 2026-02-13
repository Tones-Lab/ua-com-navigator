import Modal from '../../components/Modal';

type MicroserviceStatusModalProps = {
  isOpen: boolean;
  redeployReady: boolean;
  showMicroserviceWarning: boolean;
  missingMicroservices: string[];
  unhealthyMicroservices: string[];
  microserviceStatusError: string | null;
  microserviceIsStale: boolean;
  microserviceLastRefreshed: string | null;
  redeployError: string | null;
  microserviceStatusLoading: boolean;
  requiredMicroservices: any[];
  microserviceActionLabel: string | null;
  redeployLoading: boolean;
  hasEditPermission: boolean;
  formatTime: (value: string) => string;
  getServiceTone: (entry: any) => string;
  getServiceStatusText: (entry: any) => string;
  onDeployMicroservice: (name: string, label: string) => void;
  onRedeployMicroservice: (name: string, label: string) => void;
  onClose: () => void;
  onRefreshStatus: () => Promise<void>;
  onRedeployFcomProcessor: () => void;
};

export default function MicroserviceStatusModal({
  isOpen,
  redeployReady,
  showMicroserviceWarning,
  missingMicroservices,
  unhealthyMicroservices,
  microserviceStatusError,
  microserviceIsStale,
  microserviceLastRefreshed,
  redeployError,
  microserviceStatusLoading,
  requiredMicroservices,
  microserviceActionLabel,
  redeployLoading,
  hasEditPermission,
  formatTime,
  getServiceTone,
  getServiceStatusText,
  onDeployMicroservice,
  onRedeployMicroservice,
  onClose,
  onRefreshStatus,
  onRedeployFcomProcessor,
}: MicroserviceStatusModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal className="modal-wide" ariaLabel="Microservice Status">
      <h3>Microservice Status</h3>
      <p>
        Trap processing requires the chain below to be installed and running: trap-collector -&gt;
        fcom-processor -&gt; event-sink.
      </p>
      {redeployReady && (
        <div className="builder-hint builder-hint-warning">
          Changes staged. Redeploy FCOM Processor to apply them.
        </div>
      )}
      {showMicroserviceWarning && (
        <div className="builder-hint builder-hint-warning">
          Attention: {[...missingMicroservices, ...unhealthyMicroservices].join(', ')}
        </div>
      )}
      {microserviceStatusError && (
        <div className="builder-hint builder-hint-warning">{microserviceStatusError}</div>
      )}
      {microserviceIsStale && (
        <div className="builder-hint builder-hint-warning">
          Status may be stale. Last refresh was {formatTime(microserviceLastRefreshed || '')}.
        </div>
      )}
      {redeployError && <div className="error-message">{redeployError}</div>}
      <div className="microservice-action-banner">
        {microserviceStatusLoading
          ? microserviceLastRefreshed
            ? `Refreshing... Last refreshed at ${formatTime(microserviceLastRefreshed)}`
            : 'Refreshing...'
          : microserviceLastRefreshed
            ? `Last refreshed at ${formatTime(microserviceLastRefreshed)}`
            : 'Status not refreshed yet.'}
      </div>
      {requiredMicroservices.length === 0 && microserviceStatusLoading ? (
        <div className="microservice-loading">Loading status...</div>
      ) : (
        <div className="microservice-chain">
          {requiredMicroservices.map((entry: any, idx: number) => {
            const tone = getServiceTone(entry);
            const label = entry?.label || entry?.name || 'Unknown';
            const canDeploy = !entry?.installed && entry?.available;
            const canRedeploy =
              Boolean(entry?.installed) &&
              (entry?.name === 'fcom-processor' || !entry?.running);
            const actionLabel = (microserviceActionLabel || '').toLowerCase();
            const labelKey = String(label).toLowerCase();
            const isActionFor = labelKey && actionLabel.includes(labelKey);
            const isDeploying = isActionFor && actionLabel.startsWith('deploying');
            const isRedeploying = isActionFor && actionLabel.startsWith('redeploying');
            const isWorking = isDeploying || isRedeploying;
            return (
              <div key={entry?.name || idx} className="microservice-chain-step">
                <div
                  className={`microservice-card microservice-card-${tone}${
                    isWorking ? ' microservice-card-working' : ''
                  }${microserviceStatusLoading ? ' microservice-card-refreshing' : ''}`}
                >
                  {microserviceStatusLoading && (
                    <div className="microservice-card-overlay">
                      <span className="microservice-spinner" aria-hidden="true" />
                      Refreshing...
                    </div>
                  )}
                  <div className="microservice-card-header">
                    <span
                      className={`microservice-dot microservice-dot-${tone}`}
                      aria-hidden="true"
                    />
                    <div className="microservice-card-title">{label}</div>
                  </div>
                  <div className="microservice-card-status">{getServiceStatusText(entry)}</div>
                  {entry?.workload && (
                    <div className="microservice-card-meta">
                      Ready {entry.workload.ready || '0'} - Available{' '}
                      {entry.workload.available || '0'}
                    </div>
                  )}
                  {isWorking && (
                    <div className="microservice-card-progress">
                      <span className="microservice-spinner" aria-hidden="true" />
                      Working...
                    </div>
                  )}
                  <div className="microservice-card-actions">
                    {canDeploy && (
                      <button
                        type="button"
                        className="builder-card builder-card-primary"
                        onClick={() => onDeployMicroservice(entry.name, label)}
                        disabled={redeployLoading || !hasEditPermission}
                      >
                        {isDeploying ? 'Deploying...' : 'Deploy'}
                      </button>
                    )}
                    {canRedeploy && (
                      <button
                        type="button"
                        className="builder-card builder-card-primary"
                        onClick={() => onRedeployMicroservice(entry.name, label)}
                        disabled={redeployLoading || !hasEditPermission}
                      >
                        {isRedeploying ? 'Redeploying...' : 'Redeploy'}
                      </button>
                    )}
                  </div>
                </div>
                {idx < requiredMicroservices.length - 1 && (
                  <div className="microservice-chain-arrow" aria-hidden="true">
                    -&gt;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="builder-card"
          onClick={onRefreshStatus}
          disabled={microserviceStatusLoading || redeployLoading}
        >
          {microserviceStatusLoading ? 'Refreshing...' : 'Refresh status'}
        </button>
        {redeployReady && (
          <button
            type="button"
            className="builder-card builder-card-primary microservice-pulse"
            onClick={onRedeployFcomProcessor}
            disabled={redeployLoading || !hasEditPermission}
          >
            Redeploy FCOM Processor
          </button>
        )}
      </div>
    </Modal>
  );
}
