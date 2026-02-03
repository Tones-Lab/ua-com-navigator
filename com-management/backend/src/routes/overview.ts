import { Router, Request, Response } from 'express';
import { getSession } from '../services/sessionStore';
import { getOverviewStatus, overviewIndex, requestOverviewRebuild } from '../services/overviewIndex';

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
  res.json(getOverviewStatus());
});

router.post('/rebuild', (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  requestOverviewRebuild();
  res.json(getOverviewStatus());
});

router.get('/', (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  const status = getOverviewStatus();
  if (!status.isReady) {
    return res.status(503).json({
      error: 'Overview index is still building',
      status,
    });
  }

  res.json({
    status,
    data: overviewIndex().getData(),
  });
});

export default router;
