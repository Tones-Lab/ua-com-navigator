import { Router, Request, Response } from 'express';
import { AuthRequest, Session } from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import UAClient from '../services/ua';
import { getServerById } from '../services/serverRegistry';
import { clearSession, getSession, setSession } from '../services/sessionStore';

const router = Router();

const getNestedValue = (source: any, path: string) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);

const parsePermissionFlag = (value: any) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', ''].includes(normalized)) {
      return false;
    }
  }
  return false;
};

const resolveCanEditRules = (uaLoginData: any): boolean => {
  const permissionPaths = [
    'data.Permissions.rule.Rules.update',
    'data.Permissions.rule.Rules.Update',
    'data.Permissions.Rule.Rules.update',
    'data.Permissions.Rule.Rules.Update',
    'Permissions.rule.Rules.update',
    'Permissions.rule.Rules.Update',
    'Permissions.Rule.Rules.update',
    'Permissions.Rule.Rules.Update',
    'data.permissions.rule.Rules.update',
    'permissions.rule.Rules.update',
  ];
  for (const path of permissionPaths) {
    const value = getNestedValue(uaLoginData, path);
    if (value !== undefined) {
      return parsePermissionFlag(value);
    }
  }
  return false;
};

const formatAuthError = (error: any) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const code = error?.code || error?.errno;
  const message = error?.message || 'unknown error';
  return {
    message,
    status,
    code,
    hasResponse: Boolean(error?.response),
    responseKeys: data && typeof data === 'object' ? Object.keys(data) : null,
  };
};

/**
 * POST /api/v1/auth/login
 * Authenticate against a UA server (basic or certificate auth)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const authReq: AuthRequest = req.body;

    const maskedPassword = authReq?.password ? '*****' : undefined;
    logger.info(
      `[Auth] Login attempt path=${req.path} server_id=${authReq?.server_id || 'unknown'} auth_type=${authReq?.auth_type || 'unknown'} user=${authReq?.username || 'cert user'} password=${maskedPassword || 'n/a'}`,
    );

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

    logger.info(
      `Authenticating ${authReq.username || 'cert user'} against server ${server.server_id}`,
    );

    let uaLoginData: any = null;
    if (authReq.auth_type === 'basic') {
      const uaStart = Date.now();
      try {
        uaLoginData = await uaClient.executeLogin(authReq.username!, authReq.password!);
      } catch (error: any) {
        const detail = formatAuthError(error);
        logger.error(
          `[Auth] UA login failed request=${(req as any).id} server_id=${authReq.server_id} user=${authReq.username} detail=${JSON.stringify(detail)}`,
        );
        throw error;
      } finally {
        logger.info(
          `[Auth] UA login duration request=${(req as any).id} server_id=${authReq.server_id} ms=${Date.now() - uaStart}`,
        );
      }
      logger.info(`[UA] executeLogin response: ${JSON.stringify(uaLoginData)}`);
    } else {
      // Verify auth with a lightweight read call (rules list) for certificate auth
      const uaStart = Date.now();
      try {
        await uaClient.listRules('/', 1);
      } catch (error: any) {
        const detail = formatAuthError(error);
        logger.error(
          `[Auth] UA cert check failed request=${(req as any).id} server_id=${authReq.server_id} detail=${JSON.stringify(detail)}`,
        );
        throw error;
      } finally {
        logger.info(
          `[Auth] UA cert check duration request=${(req as any).id} server_id=${authReq.server_id} ms=${Date.now() - uaStart}`,
        );
      }
    }

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 8 * 3600000); // 8 hours

    const canEditRules = resolveCanEditRules(uaLoginData);
    const session: Session = {
      session_id: sessionId,
      user: authReq.username || 'api',
      server_id: authReq.server_id,
      auth_method: authReq.auth_type,
      created_at: new Date(),
      expires_at: expiresAt,
      ua_login: uaLoginData,
      can_edit_rules: canEditRules,
    };

    try {
      await setSession(session, authReq, server);
    } catch (error: any) {
      const detail = formatAuthError(error);
      logger.error(
        `[Auth] Session store failed request=${(req as any).id} server_id=${authReq.server_id} user=${session.user} detail=${JSON.stringify(detail)}`,
      );
      throw error;
    }
    // Set HTTP-only cookie
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isSecure =
      req.secure || forwardedProto === 'https' || process.env.COOKIE_SECURE === 'true';

    res.cookie('FCOM_SESSION_ID', sessionId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 8 * 3600000,
    });

    logger.info(
      `[Auth] Login success path=${req.path} server_id=${authReq.server_id} user=${session.user} auth_type=${session.auth_method}`,
    );

    res.json({
      session_id: sessionId,
      user: session.user,
      server_id: session.server_id,
      auth_method: session.auth_method,
      expires_at: session.expires_at.toISOString(),
      ua_login: uaLoginData,
      can_edit_rules: canEditRules,
    });
  } catch (error: any) {
    const detail = formatAuthError(error);
    logger.error(
      `[Auth] Login failed request=${(req as any).id} path=${req.path} server_id=${req.body?.server_id || 'unknown'} user=${req.body?.username || 'cert user'} auth_type=${req.body?.auth_type || 'unknown'} detail=${JSON.stringify(detail)}`,
    );
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Terminate session
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.FCOM_SESSION_ID;
    if (sessionId) {
      await clearSession(sessionId);
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
router.get('/session', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.FCOM_SESSION_ID;
    if (!sessionId) {
      return res.status(401).json({ error: 'No active session' });
    }
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'No active session' });
    }
    res.json({
      session_id: session.session_id,
      user: session.user,
      server_id: session.server_id,
      expires_at: session.expires_at.toISOString(),
      ua_login: session.ua_login ?? null,
      can_edit_rules: session.can_edit_rules ?? false,
    });
  } catch (error: any) {
    logger.error(`Session query error: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

export default router;
