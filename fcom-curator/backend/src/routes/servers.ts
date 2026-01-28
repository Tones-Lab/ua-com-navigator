import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getServerById, listServers } from '../services/serverRegistry';

const router = Router();

/**
 * GET /api/v1/servers
 * List all configured UA server instances
 */
router.get('/', (req: Request, res: Response) => {
  try {
    res.json(listServers());
  } catch (error: any) {
    logger.error(`Error listing servers: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve servers' });
  }
});

/**
 * POST /api/v1/servers/:server_id/switch
 * Switch session context to a different server
 */
router.post('/:server_id/switch', (req: Request, res: Response) => {
  try {
    const { server_id } = req.params;
    const { auth_type, username, password, cert_path, key_path } = req.body;

    if (!getServerById(server_id)) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // TODO: Authenticate against the new UA server
    logger.info(`Switching session to server ${server_id}`);

    // In a real implementation, validate credentials and update session
    res.json({
      session_id: req.cookies.FCOM_SESSION_ID,
      user: username || 'api',
      server_id: server_id,
    });
  } catch (error: any) {
    logger.error(`Error switching servers: ${error.message}`);
    res.status(500).json({ error: 'Failed to switch servers' });
  }
});

export default router;
