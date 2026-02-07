import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import UAClient from '../services/ua';
import {
  getSearchIndexStatus,
  requestSearchIndexRebuild,
  searchIndex,
  SearchScope,
} from '../services/searchIndex';

const router = Router();

const getSessionContext = async (req: Request, res: Response) => {
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
  const auth = await getCredentials(sessionId);
  const server = await getServer(sessionId);
  if (!auth || !server) {
    res.status(401).json({ error: 'Session not found or expired' });
    return null;
  }
  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';
  const uaClient = new UAClient({
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
  return { session, uaClient };
};

router.get('/status', async (req: Request, res: Response) => {
  const context = await getSessionContext(req, res);
  if (!context) {
    return;
  }
  const { session, uaClient } = context;
  if (!session.server_id) {
    res.status(400).json({ error: 'No server selected' });
    return;
  }
  await searchIndex(session.server_id).ensureHydrated();
  const status = getSearchIndexStatus(session.server_id);
  if (!status.isReady && !status.isBuilding) {
    requestSearchIndexRebuild(session.server_id, uaClient, 'auto');
  }
  if (status.isReady && status.isStale && !status.isBuilding) {
    logger.info(
      `Search cache stale; serving cached data and scheduling refresh server=${session.server_id}`,
    );
    requestSearchIndexRebuild(session.server_id, uaClient, 'auto');
  }
  res.json(status);
});

router.post('/rebuild', async (req: Request, res: Response) => {
  const context = await getSessionContext(req, res);
  if (!context) {
    return;
  }
  const { session, uaClient } = context;
  if (!session.server_id) {
    res.status(400).json({ error: 'No server selected' });
    return;
  }
  requestSearchIndexRebuild(session.server_id, uaClient, 'manual');
  res.json(getSearchIndexStatus(session.server_id));
});

router.get('/', async (req: Request, res: Response) => {
  const context = await getSessionContext(req, res);
  if (!context) {
    return;
  }
  const { session, uaClient } = context;
  if (!session.server_id) {
    res.status(400).json({ error: 'No server selected' });
    return;
  }
  const {
    q = '',
    scope = 'all',
    limit = '200',
  } = req.query as {
    q?: string;
    scope?: SearchScope;
    limit?: string;
  };

  await searchIndex(session.server_id).ensureHydrated();
  const status = getSearchIndexStatus(session.server_id);
  if (!status.isReady) {
    requestSearchIndexRebuild(session.server_id, uaClient, 'auto');
    return res.status(503).json({
      error: 'Search index is still building',
      status,
    });
  }

  if (status.isStale && !status.isBuilding) {
    logger.info(
      `Search cache stale; serving cached data and scheduling refresh server=${session.server_id}`,
    );
    requestSearchIndexRebuild(session.server_id, uaClient, 'auto');
  }

  const scopeValue: SearchScope =
    scope === 'name' || scope === 'content' || scope === 'all' ? scope : 'all';
  const results = searchIndex(session.server_id).search(
    String(q),
    scopeValue,
    Number(limit) || 200,
  );
  logger.info(`Search query="${q}" scope=${scopeValue} results=${results.length}`);
  res.json({
    query: q,
    scope: scopeValue,
    limit: Number(limit) || 200,
    results,
    status,
  });
});

export default router;
