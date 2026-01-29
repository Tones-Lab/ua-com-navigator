import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getSession } from '../services/sessionStore';
import { addFavorite, getFavorites, removeFavorite, FavoriteItem } from '../services/favoritesStore';

const router = Router();

const getSessionContext = (req: Request) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found or expired');
  }
  return session;
};

router.get('/', (req: Request, res: Response) => {
  try {
    const session = getSessionContext(req);
    const favorites = getFavorites(session.user, session.server_id);
    res.json({ favorites });
  } catch (error: any) {
    logger.error(`Favorites fetch error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to load favorites' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const session = getSessionContext(req);
    const favorite = req.body as FavoriteItem;
    if (!favorite?.type || !favorite?.pathId) {
      return res.status(400).json({ error: 'Missing favorite type or pathId' });
    }
    const updated = addFavorite(session.user, session.server_id, favorite);
    res.json({ favorites: updated });
  } catch (error: any) {
    logger.error(`Favorites add error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to add favorite' });
  }
});

router.delete('/', (req: Request, res: Response) => {
  try {
    const session = getSessionContext(req);
    const favorite = req.body as FavoriteItem;
    if (!favorite?.type || !favorite?.pathId) {
      return res.status(400).json({ error: 'Missing favorite type or pathId' });
    }
    const updated = removeFavorite(session.user, session.server_id, favorite);
    res.json({ favorites: updated });
  } catch (error: any) {
    logger.error(`Favorites remove error: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to remove favorite' });
  }
});

export default router;
