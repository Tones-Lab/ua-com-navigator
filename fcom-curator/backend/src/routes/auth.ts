import { Router, Request, Response } from 'express';
import { AuthRequest, Session } from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import UAClient from '../services/ua';
import { getServerById } from '../services/serverRegistry';
import { clearSession, getSession, setSession } from '../services/sessionStore';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Authenticate against a UA server (basic or certificate auth)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const authReq: AuthRequest = req.body;

    const basicEnabled = (process.env.UA_AUTH_BASIC_ENABLED ?? 'true').toLowerCase() === 'true';
    const certEnabled = (process.env.UA_AUTH_CERT_ENABLED ?? 'true').toLowerCase() === 'true';
    
    // Validate required fields
    if (!authReq.server_id || !authReq.auth_type) {
      return res.status(400).json({ error: 'Missing server_id or auth_type' });
    }

    const server = getServerById(authReq.server_id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (authReq.auth_type === 'basic') {
      if (!basicEnabled) {
        return res.status(403).json({ error: 'Basic authentication is disabled' });
      }
      if (!authReq.username || !authReq.password) {
        return res.status(400).json({ error: 'Missing username or password' });
      }
    } else if (authReq.auth_type === 'certificate') {
      if (!certEnabled) {
        return res.status(403).json({ error: 'Certificate authentication is disabled' });
      }
      if (!authReq.cert_path || !authReq.key_path) {
        return res.status(400).json({ error: 'Missing cert_path or key_path' });
      }
    }

    // Authenticate against UA server REST API
    const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';
    const uaClient = new UAClient({
      hostname: server.hostname,
      port: server.port,
      auth_method: authReq.auth_type,
      username: authReq.username,
      password: authReq.password,
      cert_path: authReq.cert_path,
      key_path: authReq.key_path,
      ca_cert_path: authReq.ca_cert_path,
      insecure_tls: insecureTls,
    });

    logger.info(`Authenticating ${authReq.username || 'cert user'} against server ${server.server_id}`);

    // Verify auth with a lightweight read call (rules list)
    await uaClient.listRules('/', 1);

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

    setSession(session, authReq, server);

    // Set HTTP-only cookie
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isSecure = req.secure || forwardedProto === 'https' || process.env.COOKIE_SECURE === 'true';

    res.cookie('FCOM_SESSION_ID', sessionId, {
      httpOnly: true,
      secure: isSecure,
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
      clearSession(sessionId);
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
    if (!sessionId || !getSession(sessionId)) {
      return res.status(401).json({ error: 'No active session' });
    }

    const session = getSession(sessionId)!;
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
