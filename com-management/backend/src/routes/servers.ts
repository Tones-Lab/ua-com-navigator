import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { getBootstrapClient } from '../services/bootstrapClient';
import { getServerById, listServers } from '../services/serverRegistry';
import { UAServer } from '../types';

const router = Router();

/**
 * GET /api/v1/servers
 * List all configured UA server instances
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const bootstrap = getBootstrapClient();
    if (!bootstrap) {
      return res.json(listServers());
    }

    bootstrap.uaClient
      .getBrokerServers()
      .then((data) => {
        const normalized = normalizeBrokerServers(data);
        res.json(normalized.length > 0 ? normalized : listServers());
      })
      .catch((error: any) => {
        logger.warn(`Broker server list failed: ${error?.message || 'unknown error'}`);
        res.json(listServers());
      });
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

    if (!getServerById(server_id)) {
      return res.status(404).json({ error: 'Server not found' });
    }

    logger.info(`Switching session to server ${server_id}`);

    res.status(501).json({
      error: 'Server switch endpoint is not implemented yet',
      server_id,
    });
  } catch (error: any) {
    logger.error(`Error switching servers: ${error.message}`);
    res.status(500).json({ error: 'Failed to switch servers' });
  }
});

export default router;

const normalizeBrokerServers = (payload: any): UAServer[] => {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.result)
        ? payload.result
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
            ? payload
            : [];

  return rows
    .map((entry: any): UAServer | null => {
      const serverId = String(
        entry?.server_id ??
          entry?.serverId ??
          entry?.ServerID ??
          entry?.id ??
          entry?.ID ??
          entry?.name ??
          entry?.Name ??
          '',
      ).trim();
      const hostname = String(
        entry?.hostname ??
          entry?.Hostname ??
          entry?.host ??
          entry?.Host ??
          entry?.ip ??
          entry?.IPAddress ??
          '',
      ).trim();
      if (!serverId || !hostname) {
        return null;
      }
      const serverName = String(
        entry?.server_name ??
          entry?.serverName ??
          entry?.ServerName ??
          entry?.name ??
          entry?.Name ??
          serverId,
      ).trim();
      const portRaw =
        entry?.port ??
        entry?.Port ??
        entry?.server_port ??
        entry?.ServerPort ??
        entry?.https_port ??
        entry?.HttpsPort ??
        entry?.httpsPort;
      const port = Number(portRaw || 443);
      const environment =
        String(entry?.environment ?? entry?.Environment ?? entry?.env ?? 'dev').toLowerCase() as
          | 'dev'
          | 'test'
          | 'staging'
          | 'prod';
      const svnUrl =
        String(entry?.svn_url ?? entry?.svnUrl ?? entry?.SvnUrl ?? '').trim() ||
        `svn://${hostname}/fcom`;

      return {
        server_id: serverId,
        server_name: serverName,
        hostname,
        port,
        environment: ['dev', 'test', 'staging', 'prod'].includes(environment)
          ? environment
          : 'dev',
        svn_url: svnUrl,
      };
    })
    .filter((entry: UAServer | null): entry is UAServer => Boolean(entry));
};
