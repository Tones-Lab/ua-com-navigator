import Modal from '../../components/Modal';
import MicroserviceChain from './MicroserviceChain';

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
        <MicroserviceChain
          requiredMicroservices={requiredMicroservices}
          microserviceActionLabel={microserviceActionLabel}
          microserviceStatusLoading={microserviceStatusLoading}
          redeployLoading={redeployLoading}
          hasEditPermission={hasEditPermission}
          getServiceTone={getServiceTone}
          getServiceStatusText={getServiceStatusText}
          onDeployMicroservice={onDeployMicroservice}
          onRedeployMicroservice={onRedeployMicroservice}
        />
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
