import logger from '../utils/logger';
import UAClient from './ua';
import { getServerById, listServers } from './serverRegistry';

type BootstrapClient = {
  uaClient: UAClient;
  serverId: string;
};

export const getBootstrapClient = (): BootstrapClient | null => {
  const serverId = process.env.UA_BOOTSTRAP_SERVER_ID || listServers()[0]?.server_id;
  const server = serverId ? getServerById(serverId) : listServers()[0];
  if (!server) {
    logger.warn('Bootstrap client skipped: no UA server configured.');
    return null;
  }

  const authMethod = process.env.UA_BOOTSTRAP_AUTH_METHOD || 'basic';
  const username = process.env.UA_BOOTSTRAP_USERNAME;
  const password = process.env.UA_BOOTSTRAP_PASSWORD;
  const certPath = process.env.UA_BOOTSTRAP_CERT_PATH;
  const keyPath = process.env.UA_BOOTSTRAP_KEY_PATH;
  const caCertPath = process.env.UA_BOOTSTRAP_CA_CERT_PATH;
  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';

  if (authMethod === 'certificate') {
    if (!certPath || !keyPath) {
      logger.warn('Bootstrap client skipped: missing certificate credentials.');
      return null;
    }
  } else if (!username || !password) {
    logger.warn('Bootstrap client skipped: missing username/password credentials.');
    return null;
  }

  const uaClient = new UAClient({
    hostname: server.hostname,
    port: server.port,
    auth_method: authMethod as 'basic' | 'certificate',
    username,
    password,
    cert_path: certPath,
    key_path: keyPath,
    ca_cert_path: caCertPath,
    insecure_tls: insecureTls,
  });

  return { uaClient, serverId: server.server_id };
};
