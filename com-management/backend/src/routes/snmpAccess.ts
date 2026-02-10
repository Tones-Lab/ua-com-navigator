import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';

const router = Router();

const getUaClientFromSession = async (req: Request): Promise<UAClient> => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const auth = await getCredentials(sessionId);
  const server = await getServer(sessionId);
  if (!auth || !server) {
    throw new Error('Session not found or expired');
  }

  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';
  return new UAClient({
    hostname: server.hostname,
    port: server.port,
    auth_method: auth.auth_type,
    username: auth.username,
    password: auth.password,
    cert_path: auth.cert_path,
    key_path: auth.key_path,
    ca_cert_path: auth.ca_cert_path,
    insecure_tls: insecureTls,
  });
};

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const accessId = String(req.params.id || '').trim();
    if (!accessId) {
      return res.status(400).json({ error: 'Missing SNMP access id' });
    }
    const uaClient = await getUaClientFromSession(req);
    const data = await uaClient.getSnmpAccessProfile(accessId);
    res.json(data);
  } catch (error: any) {
    logger.error(`SNMP access profile error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to load SNMP access profile' });
  }
});

export default router;
