import { Router, Request, Response } from 'express';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import {
  getOverviewStatus,
  overviewIndex,
  requestOverviewRebuild,
} from '../services/overviewIndex';
import { UAClient } from '../services/ua';

const router = Router();

const requireSession = async (req: Request, res: Response) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  return sessionId;
};

const getUaClientFromSession = async (
  req: Request,
): Promise<{ uaClient: UAClient; serverId: string }> => {
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
  return {
    uaClient: new UAClient({
      hostname: server.hostname,
      port: server.port,
      auth_method: auth.auth_type,
      username: auth.username,
      password: auth.password,
      cert_path: auth.cert_path,
      key_path: auth.key_path,
      ca_cert_path: auth.ca_cert_path,
      insecure_tls: insecureTls,
    }),
    serverId: server.server_id,
  };
};

router.get('/status', async (req: Request, res: Response) => {
  if (!(await requireSession(req, res))) {
    return;
  }
  try {
    const { serverId } = await getUaClientFromSession(req);
    res.json(getOverviewStatus(serverId));
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Session not found or expired' });
  }
});

router.post('/rebuild', async (req: Request, res: Response) => {
  if (!(await requireSession(req, res))) {
    return;
  }
  try {
    const { uaClient, serverId } = await getUaClientFromSession(req);
    requestOverviewRebuild(serverId, uaClient);
    res.json(getOverviewStatus(serverId));
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Session not found or expired' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  if (!(await requireSession(req, res))) {
    return;
  }
  try {
    const { uaClient, serverId } = await getUaClientFromSession(req);
    const status = getOverviewStatus(serverId);
    if (!status.isReady) {
      return res.status(503).json({
        error: status.lastError || 'Overview index is still building',
        status,
      });
    }

    res.json({
      status,
      data: overviewIndex().getData(serverId),
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Session not found or expired' });
  }
});

export default router;
