import { Router, Request, Response } from 'express';
import { renderMetrics } from '../utils/metricsStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderMetrics());
});

export default router;
