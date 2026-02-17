type MicroserviceStatusCardProps = {
  entry: any;
  tone: string;
  label: string;
  canDeploy: boolean;
  canRedeploy: boolean;
  isWorking: boolean;
  isDeploying: boolean;
  isRedeploying: boolean;
  microserviceStatusLoading: boolean;
  redeployLoading: boolean;
  hasEditPermission: boolean;
  getServiceStatusText: (entry: any) => string;
  onDeployMicroservice: (name: string, label: string) => void;
  onRedeployMicroservice: (name: string, label: string) => void;
};

export default function MicroserviceStatusCard({
  entry,
  tone,
  label,
  canDeploy,
  canRedeploy,
  isWorking,
  isDeploying,
  isRedeploying,
  microserviceStatusLoading,
  redeployLoading,
  hasEditPermission,
  getServiceStatusText,
  onDeployMicroservice,
  onRedeployMicroservice,
}: MicroserviceStatusCardProps) {
  return (
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
        <span className={`microservice-dot microservice-dot-${tone}`} aria-hidden="true" />
        <div className="microservice-card-title">{label}</div>
      </div>
      <div className="microservice-card-status">{getServiceStatusText(entry)}</div>
      {entry?.workload && (
        <div className="microservice-card-meta">
          Ready {entry.workload.ready || '0'} - Available {entry.workload.available || '0'}
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
  );
}
