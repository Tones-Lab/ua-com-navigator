import MicroserviceStatusModal from '../features/microservices/MicroserviceStatusModal';

type MicroserviceModalHostProps = any;

export default function MicroserviceModalHost({
  redeployModalOpen,
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
  handleDeployMicroservice,
  handleRedeployMicroservice,
  setRedeployModalOpen,
  setRedeployError,
  setMicroserviceActionLabel,
  refreshMicroserviceStatus,
  handleRedeployFcomProcessor,
}: MicroserviceModalHostProps) {
  return (
    <MicroserviceStatusModal
      isOpen={redeployModalOpen}
      redeployReady={redeployReady}
      showMicroserviceWarning={showMicroserviceWarning}
      missingMicroservices={missingMicroservices}
      unhealthyMicroservices={unhealthyMicroservices}
      microserviceStatusError={microserviceStatusError}
      microserviceIsStale={microserviceIsStale}
      microserviceLastRefreshed={microserviceLastRefreshed}
      redeployError={redeployError}
      microserviceStatusLoading={microserviceStatusLoading}
      requiredMicroservices={requiredMicroservices}
      microserviceActionLabel={microserviceActionLabel}
      redeployLoading={redeployLoading}
      hasEditPermission={hasEditPermission}
      formatTime={formatTime}
      getServiceTone={getServiceTone}
      getServiceStatusText={getServiceStatusText}
      onDeployMicroservice={handleDeployMicroservice}
      onRedeployMicroservice={handleRedeployMicroservice}
      onClose={() => {
        if (!redeployLoading) {
          setRedeployModalOpen(false);
          setRedeployError(null);
        }
      }}
      onRefreshStatus={async () => {
        setMicroserviceActionLabel('Refreshing status...');
        await refreshMicroserviceStatus({ refresh: true });
        setMicroserviceActionLabel(null);
      }}
      onRedeployFcomProcessor={handleRedeployFcomProcessor}
    />
  );
}
