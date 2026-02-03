import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';
import { getEventsSchemaFields } from '../services/eventsSchemaCache';

const router = Router();

const getUaClientFromSession = (req: Request): UAClient => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const auth = getCredentials(sessionId);
  const server = getServer(sessionId);
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

router.get('/', async (req: Request, res: Response) => {
  try {
    const uaClient = getUaClientFromSession(req);
    const fields = await getEventsSchemaFields(uaClient);
    res.json({ fields });
  } catch (error: any) {
    logger.error(`Events schema error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to fetch Events schema' });
  }
});

export default router;
