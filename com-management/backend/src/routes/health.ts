import { Router, Request, Response } from 'express';
import { getCachedConnectivityStatus, getConnectivityStatusPollMs } from '../services/connectivityStatusCache';

const router = Router();

router.get('/connectivity', (_req: Request, res: Response) => {
  const cached = getCachedConnectivityStatus();
  const pollMs = getConnectivityStatusPollMs();
  const updatedAtMs = cached.updatedAt ? Date.parse(cached.updatedAt) : 0;
  const ageMs = updatedAtMs ? Date.now() - updatedAtMs : Number.MAX_SAFE_INTEGER;
  const stale = ageMs > pollMs * 2;

  res.json({
    success: cached.data?.success ?? false,
    uaRest: cached.data?.uaRest ?? { ok: false, error: cached.error || 'No data' },
    microservices: cached.data?.microservices ?? { ok: false, error: cached.error || 'No data' },
    updatedAt: cached.updatedAt,
    cache: {
      updatedAt: cached.updatedAt,
      lastAttemptAt: cached.lastAttemptAt,
      serverId: cached.serverId,
      ageSeconds: updatedAtMs ? Math.floor(ageMs / 1000) : null,
      stale,
    },
  });
});

export default router;
