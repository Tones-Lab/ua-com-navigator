import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';

const router = Router();

/**
 * GET /api/v1/files/browse
 * List directory tree for FCOM files
 */
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const { path = '/', node, vendor, protocol_type, limit = 100 } = req.query;

    const sessionId = req.cookies.FCOM_SESSION_ID;
    if (!sessionId) {
      return res.status(401).json({ error: 'No active session' });
    }

    const auth = await getCredentials(sessionId);
    const server = await getServer(sessionId);
    if (!auth || !server) {
      return res.status(401).json({ error: 'Session not found or expired' });
    }

    logger.info(
      `Browsing files at path: ${path}, node: ${node}, vendor: ${vendor}, protocol: ${protocol_type}`,
    );

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

    // TODO: Map UA response into normalized entries for UI; return raw for now.
    try {
      const data = await uaClient.listRules(
        String(path),
        Number(limit),
        node ? String(node) : undefined,
      );
      res.json(data);
    } catch (error: any) {
      logger.error(`Error browsing files: ${error.message}`);
      res.status(500).json({ error: 'Failed to browse files' });
    }
  } catch (error: any) {
    logger.error(`Error browsing files: ${error.message}`);
    res.status(500).json({ error: 'Failed to browse files' });
  }
});

/**
 * GET /api/v1/files/:file_id/preview
 * Quick preview of a file (structure outline only)
 */
router.get('/:file_id/preview', (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;

    logger.info(`Previewing file: ${file_id}`);

    res.status(501).json({
      error: 'File preview endpoint is not implemented yet',
      file_id,
    });
  } catch (error: any) {
    logger.error(`Error previewing file: ${error.message}`);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

export default router;
