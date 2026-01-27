import { Router, Request, Response } from 'express';
import { AuthRequest, Session } from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Mock session store - in production, use Redis or database
const sessions = new Map<string, Session>();
const serverCredentials = new Map<string, AuthRequest>();

/**
 * POST /api/v1/auth/login
 * Authenticate against a UA server (basic or certificate auth)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const authReq: AuthRequest = req.body;
    
    // Validate required fields
    if (!authReq.server_id || !authReq.auth_type) {
      return res.status(400).json({ error: 'Missing server_id or auth_type' });
    }

    if (authReq.auth_type === 'basic') {
      if (!authReq.username || !authReq.password) {
        return res.status(400).json({ error: 'Missing username or password' });
      }
    } else if (authReq.auth_type === 'certificate') {
      if (!authReq.cert_path || !authReq.key_path) {
        return res.status(400).json({ error: 'Missing cert_path or key_path' });
      }
    }

    // TODO: Authenticate against UA server REST API
    // For now, we'll simulate successful auth
    logger.info(`Authenticating ${authReq.username || 'cert user'} against server ${authReq.server_id}`);

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 8 * 3600000); // 8 hours

    const session: Session = {
      session_id: sessionId,
      user: authReq.username || 'api',
      server_id: authReq.server_id,
      auth_method: authReq.auth_type,
      created_at: new Date(),
      expires_at: expiresAt,
    };

    sessions.set(sessionId, session);
    serverCredentials.set(sessionId, authReq);

    // Set HTTP-only cookie
    res.cookie('FCOM_SESSION_ID', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600000,
    });

    res.json({
      session_id: sessionId,
      user: session.user,
      server_id: session.server_id,
      auth_method: session.auth_method,
      expires_at: session.expires_at.toISOString(),
    });
  } catch (error: any) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Terminate session
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.FCOM_SESSION_ID;
    if (sessionId) {
      sessions.delete(sessionId);
      serverCredentials.delete(sessionId);
      res.clearCookie('FCOM_SESSION_ID');
    }
    res.status(204).send();
  } catch (error: any) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/v1/auth/session
 * Get current session details
 */
router.get('/session', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.FCOM_SESSION_ID;
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(401).json({ error: 'No active session' });
    }

    const session = sessions.get(sessionId)!;
    res.json({
      session_id: session.session_id,
      user: session.user,
      server_id: session.server_id,
      expires_at: session.expires_at.toISOString(),
    });
  } catch (error: any) {
    logger.error(`Session query error: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

export default router;
