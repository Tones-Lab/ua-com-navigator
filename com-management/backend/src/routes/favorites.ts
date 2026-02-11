import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getSession } from '../services/sessionStore';
import {
  addFavorite,
  getFavorites,
  removeFavorite,
  FavoriteItem,
  FavoriteScope,
} from '../services/favoritesStore';

const router = Router();

const normalizeScope = (raw?: string): FavoriteScope => {
  const value = String(raw || '').toLowerCase();
  if (value === 'pcom') {
    return 'pcom';
  }
  if (value === 'mib') {
    return 'mib';
  }
  return 'fcom';
};

const getSessionContext = async (req: Request) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found or expired');
  }
  return session;
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const session = await getSessionContext(req);
    const scope = normalizeScope(req.query.scope as string | undefined);
    const favorites = await getFavorites(session.user, session.server_id, scope);
    res.json({ favorites });
  } catch (error: any) {
    logger.error(`Favorites fetch error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to load favorites' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const session = await getSessionContext(req);
    const favorite = req.body as FavoriteItem;
    if (!favorite?.type || !favorite?.pathId) {
      return res.status(400).json({ error: 'Missing favorite type or pathId' });
    }
    const scope = normalizeScope(favorite?.scope || (req.query.scope as string | undefined));
    const updated = await addFavorite(session.user, session.server_id, favorite, scope);
    res.json({ favorites: updated });
  } catch (error: any) {
    logger.error(`Favorites add error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to add favorite' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const session = await getSessionContext(req);
    const favorite = req.body as FavoriteItem;
    if (!favorite?.type || !favorite?.pathId) {
      return res.status(400).json({ error: 'Missing favorite type or pathId' });
    }
    const scope = normalizeScope(favorite?.scope || (req.query.scope as string | undefined));
    const updated = await removeFavorite(session.user, session.server_id, favorite, scope);
    res.json({ favorites: updated });
  } catch (error: any) {
    logger.error(`Favorites remove error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to remove favorite' });
  }
});

export default router;
