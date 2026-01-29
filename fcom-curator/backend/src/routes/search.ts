import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getSession } from '../services/sessionStore';
import {
  getSearchIndexStatus,
  requestSearchIndexRebuild,
  searchIndex,
  SearchScope,
} from '../services/searchIndex';

const router = Router();

const requireSession = (req: Request, res: Response) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId || !getSession(sessionId)) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  return sessionId;
};

router.get('/status', (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  res.json(getSearchIndexStatus());
});

router.post('/rebuild', async (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  requestSearchIndexRebuild();
  res.json(getSearchIndexStatus());
});

router.get('/', (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  const { q = '', scope = 'all', limit = '200' } = req.query as {
    q?: string;
    scope?: SearchScope;
    limit?: string;
  };

  const status = getSearchIndexStatus();
  if (!status.isReady) {
    return res.status(503).json({
      error: 'Search index is still building',
      status,
    });
  }

  const scopeValue: SearchScope = scope === 'name' || scope === 'content' || scope === 'all' ? scope : 'all';
  const results = searchIndex().search(String(q), scopeValue, Number(limit) || 200);
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
