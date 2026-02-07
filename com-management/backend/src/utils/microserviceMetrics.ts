import { incCounter, setGauge } from './metricsStore';
import { MicroserviceStatusSummary } from '../services/microserviceStatus';

export const recordMicroserviceStatusSuccess = (data: MicroserviceStatusSummary) => {
  incCounter('com_microservice_status_poll_success_total');
  setGauge('com_microservice_status_poll_last_success_timestamp', Date.now());
  setGauge('com_microservice_status_chain_ready', data.chainReady ? 1 : 0);
  setGauge('com_microservice_status_missing_count', data.missing.length);
  setGauge('com_microservice_status_installed_count', data.installedCount);
};

export const recordMicroserviceStatusError = () => {
  incCounter('com_microservice_status_poll_error_total');
  setGauge('com_microservice_status_poll_last_error_timestamp', Date.now());
};
