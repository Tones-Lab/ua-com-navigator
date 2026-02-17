import MicroserviceStatusCard from './MicroserviceStatusCard';

type MicroserviceChainProps = {
  requiredMicroservices: any[];
  microserviceActionLabel: string | null;
  microserviceStatusLoading: boolean;
  redeployLoading: boolean;
  hasEditPermission: boolean;
  getServiceTone: (entry: any) => string;
  getServiceStatusText: (entry: any) => string;
  onDeployMicroservice: (name: string, label: string) => void;
  onRedeployMicroservice: (name: string, label: string) => void;
};

export default function MicroserviceChain({
  requiredMicroservices,
  microserviceActionLabel,
  microserviceStatusLoading,
  redeployLoading,
  hasEditPermission,
  getServiceTone,
  getServiceStatusText,
  onDeployMicroservice,
  onRedeployMicroservice,
}: MicroserviceChainProps) {
  return (
    <div className="microservice-chain">
      {requiredMicroservices.map((entry: any, idx: number) => {
        const tone = getServiceTone(entry);
        const label = entry?.label || entry?.name || 'Unknown';
        const canDeploy = !entry?.installed && entry?.available;
        const canRedeploy =
          Boolean(entry?.installed) && (entry?.name === 'fcom-processor' || !entry?.running);
        const actionLabel = (microserviceActionLabel || '').toLowerCase();
        const labelKey = String(label).toLowerCase();
        const isActionFor = Boolean(labelKey && actionLabel.includes(labelKey));
        const isDeploying = isActionFor && actionLabel.startsWith('deploying');
        const isRedeploying = isActionFor && actionLabel.startsWith('redeploying');
        const isWorking = isDeploying || isRedeploying;

        return (
          <div key={entry?.name || idx} className="microservice-chain-step">
            <MicroserviceStatusCard
              entry={entry}
              tone={tone}
              label={label}
              canDeploy={canDeploy}
              canRedeploy={canRedeploy}
              isWorking={isWorking}
              isDeploying={isDeploying}
              isRedeploying={isRedeploying}
              microserviceStatusLoading={microserviceStatusLoading}
              redeployLoading={redeployLoading}
              hasEditPermission={hasEditPermission}
              getServiceStatusText={getServiceStatusText}
              onDeployMicroservice={onDeployMicroservice}
              onRedeployMicroservice={onRedeployMicroservice}
            />
            {idx < requiredMicroservices.length - 1 && (
              <div className="microservice-chain-arrow" aria-hidden="true">
                -&gt;
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
