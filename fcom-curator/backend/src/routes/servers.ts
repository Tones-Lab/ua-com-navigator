import { Router, Request, Response } from 'express';
import { UAServer } from '../types';
import logger from '../utils/logger';

const router = Router();

// Mock list of configured UA servers
const uaServers: Map<string, UAServer> = new Map([
  [
    'dev-ua-01',
    {
      server_id: 'dev-ua-01',
      server_name: 'Development UA Primary',
      hostname: 'ua-dev.example.com',
      port: 8080,
      environment: 'dev',
      svn_url: 'svn://ua-dev.example.com/fcom',
    },
  ],
  [
    'test-ua-01',
    {
      server_id: 'test-ua-01',
      server_name: 'Test UA Primary',
      hostname: 'ua-test.example.com',
      port: 8080,
      environment: 'test',
      svn_url: 'svn://ua-test.example.com/fcom',
    },
  ],
  [
    'prod-ua-01',
    {
      server_id: 'prod-ua-01',
      server_name: 'Production UA Primary',
      hostname: 'ua-prod.example.com',
      port: 8080,
      environment: 'prod',
      svn_url: 'svn://ua-prod.example.com/fcom',
    },
  ],
]);

/**
 * GET /api/v1/servers
 * List all configured UA server instances
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const servers = Array.from(uaServers.values());
    res.json(servers);
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

    if (!uaServers.has(server_id)) {
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
