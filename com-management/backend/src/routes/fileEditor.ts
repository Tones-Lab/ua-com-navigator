import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { refreshOverviewNode } from '../services/overviewIndex';
import { searchIndex } from '../services/searchIndex';
import { refreshFolderOverviewForNode } from './folders';

const router = Router();

const getUaClientFromSession = async (req: Request): Promise<UAClient> => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const auth = await getCredentials(sessionId);
  const server = await getServer(sessionId);
  if (!auth || !server) {
    throw new Error('Session not found or expired');
  }

  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';
  return new UAClient({
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
};

const getServerIdFromSession = async (req: Request): Promise<string> => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const server = await getServer(sessionId);
  if (!server) {
    throw new Error('Session not found or expired');
  }

  return server.server_id;
};

const requireEditPermission = async (req: Request, res: Response): Promise<boolean> => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    res.status(401).json({ error: 'No active session' });
    return false;
  }
  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: 'Session not found or expired' });
    return false;
  }
  if (!session.can_edit_rules) {
    res.status(403).json({ error: 'Read-only access' });
    return false;
  }
  return true;
};

/**
 * GET /api/v1/files/:file_id/read
 * Read and parse a complete FCOM JSON file
 */
router.get('/read', async (req: Request, res: Response) => {
  try {
    const { file_id, revision = 'HEAD' } = req.query;
    if (!file_id) {
      return res.status(400).json({ error: 'Missing file_id' });
    }
    const start = Date.now();
    logger.info(`Reading file: ${file_id}, revision: ${revision}`);
    const uaClient = await getUaClientFromSession(req);

    try {
      const readStart = Date.now();
      const data = await uaClient.readRule(String(file_id), String(revision));
      logger.info(
        `Read file: ${file_id} in ${Date.now() - readStart}ms (total ${Date.now() - start}ms)`,
      );
      const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      res.json({
        file_id: String(file_id),
        revision: revision as string,
        etag,
        content: data,
        validation_errors: [],
      });
    } catch (error: any) {
      logger.error(`Error reading file: ${error.message}`);
      res.status(500).json({ error: 'Failed to read file' });
    }
  } catch (error: any) {
    logger.error(`Error reading file: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to read file' });
  }
});

router.get('/:file_id/read', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;
    const { revision = 'HEAD' } = req.query;

    const start = Date.now();
    logger.info(`Reading file: ${file_id}, revision: ${revision}`);
    const uaClient = await getUaClientFromSession(req);

    try {
      const readStart = Date.now();
      const data = await uaClient.readRule(file_id, String(revision));
      logger.info(
        `Read file: ${file_id} in ${Date.now() - readStart}ms (total ${Date.now() - start}ms)`,
      );
      const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      res.json({
        file_id: file_id,
        revision: revision as string,
        etag,
        content: data,
        validation_errors: [],
      });
    } catch (error: any) {
      logger.error(`Error reading file: ${error.message}`);
      res.status(500).json({ error: 'Failed to read file' });
    }
  } catch (error: any) {
    logger.error(`Error reading file: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to read file' });
  }
});

/**
 * POST /api/v1/files/save
 * Validate and commit changes to a FCOM JSON file
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    if (!(await requireEditPermission(req, res))) {
      return;
    }
    const { file_id, content, etag, commit_message } = req.body;

    if (!file_id || !content || !etag || commit_message === undefined) {
      return res.status(400).json({ error: 'Missing file_id, content, etag, or commit_message' });
    }

    logger.info(`Saving file: ${file_id}, message: ${commit_message}`);

    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);
    const data = await uaClient.updateRule(String(file_id), content, commit_message);
    try {
      await searchIndex(serverId).updateFileFromContent(String(file_id), content);
    } catch (err: any) {
      logger.warn(`Search index update failed: ${err?.message || 'unknown error'}`);
    }
    const parentNode = String(file_id).split('/').slice(0, -1).join('/');
    if (parentNode) {
      try {
        await refreshFolderOverviewForNode(uaClient, serverId, parentNode, 25);
      } catch (err: any) {
        logger.warn(`Folder cache refresh failed: ${err?.message || 'unknown error'}`);
      }
      try {
        await refreshOverviewNode(serverId, uaClient, parentNode);
      } catch (err: any) {
        logger.warn(`Overview cache refresh failed: ${err?.message || 'unknown error'}`);
      }
    }
    const listing = parentNode
      ? await uaClient.listRules('/', 500, parentNode)
      : await uaClient.listRules('/', 500);
    const entry = listing?.data?.find(
      (item: any) => item.PathName === String(file_id).split('/').pop(),
    );
    const newEtag = crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
    res.json({
      file_id: String(file_id),
      revision: entry?.LastRevision ?? data?.revision ?? 'HEAD',
      last_modified: entry?.ModificationTime ?? data?.last_modified ?? new Date().toISOString(),
      commit_id: entry?.LastRevision ?? data?.commit_id ?? 'unknown',
      etag: newEtag,
    });
  } catch (error: any) {
    logger.error(`Error saving file: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to save file' });
  }
});

/**
 * POST /api/v1/files/:file_id/save
 * Validate and commit changes to a FCOM JSON file
 */
router.post('/:file_id/save', async (req: Request, res: Response) => {
  try {
    if (!(await requireEditPermission(req, res))) {
      return;
    }
    const { file_id } = req.params;
    const { content, etag, commit_message } = req.body;

    if (!content || !etag || commit_message === undefined) {
      return res.status(400).json({ error: 'Missing content, etag, or commit_message' });
    }

    logger.info(`Saving file: ${file_id}, message: ${commit_message}`);

    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);
    const data = await uaClient.updateRule(file_id, content, commit_message);
    try {
      await searchIndex(serverId).updateFileFromContent(String(file_id), content);
    } catch (err: any) {
      logger.warn(`Search index update failed: ${err?.message || 'unknown error'}`);
    }
    const parentNode = String(file_id).split('/').slice(0, -1).join('/');
    if (parentNode) {
      try {
        await refreshFolderOverviewForNode(uaClient, serverId, parentNode, 25);
      } catch (err: any) {
        logger.warn(`Folder cache refresh failed: ${err?.message || 'unknown error'}`);
      }
      try {
        await refreshOverviewNode(serverId, uaClient, parentNode);
      } catch (err: any) {
        logger.warn(`Overview cache refresh failed: ${err?.message || 'unknown error'}`);
      }
    }
    const listing = parentNode
      ? await uaClient.listRules('/', 500, parentNode)
      : await uaClient.listRules('/', 500);
    const entry = listing?.data?.find(
      (item: any) => item.PathName === String(file_id).split('/').pop(),
    );
    const newEtag = crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
    res.json({
      file_id: file_id,
      revision: entry?.LastRevision ?? data?.revision ?? 'HEAD',
      last_modified: entry?.ModificationTime ?? data?.last_modified ?? new Date().toISOString(),
      commit_id: entry?.LastRevision ?? data?.commit_id ?? 'unknown',
      etag: newEtag,
    });
  } catch (error: any) {
    logger.error(`Error saving file: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to save file' });
  }
});

/**
 * GET /api/v1/files/:file_id/diff
 * Get diff between working copy and HEAD (or two revisions)
 */
router.get('/:file_id/diff', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;
    const { revision_a = 'HEAD', revision_b = 'WORKING' } = req.query;

    logger.info(`Getting diff for file: ${file_id}`);
    const uaClient = await getUaClientFromSession(req);

    try {
      const data = await uaClient.diffRules(
        file_id,
        String(revision_a),
        String(revision_b),
      );
      res.json(data);
    } catch (error: any) {
      logger.error(`Error getting diff: ${error.message}`);
      res.status(500).json({ error: 'Failed to get diff' });
    }
  } catch (error: any) {
    logger.error(`Error getting diff: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to get diff' });
  }
});

/**
 * GET /api/v1/files/:file_id/history
 * Get SVN commit history for a file
 */
router.get('/:file_id/history', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    logger.info(`Getting history for file: ${file_id}`);
    const uaClient = await getUaClientFromSession(req);
    try {
      const data = await uaClient.getHistory(file_id, Number(limit), Number(offset));
      res.json(data);
    } catch (error: any) {
      logger.error(`Error getting history: ${error.message}`);
      res.status(500).json({ error: 'Failed to get history' });
    }
  } catch (error: any) {
    logger.error(`Error getting history: ${error.message}`);
    res.status(401).json({ error: error.message || 'Failed to get history' });
  }
});

/**
 * POST /api/v1/files/:file_id/test
 * Generate and send a test trap for a single event object
 */
router.post('/:file_id/test', (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;
    const { object_name } = req.body;

    if (!object_name) {
      return res.status(400).json({ error: 'Missing object_name' });
    }

    logger.info(`Testing object ${object_name} in file ${file_id}`);

    res.status(501).json({
      error: 'Single-object test endpoint is not implemented yet',
      file_id,
      object_name,
    });
  } catch (error: any) {
    logger.error(`Error testing object: ${error.message}`);
    res.status(500).json({ error: 'Failed to test object' });
  }
});

/**
 * POST /api/v1/files/:file_id/test-all
 * Test all event objects in a file
 */
router.post('/:file_id/test-all', (req: Request, res: Response) => {
  try {
    const { file_id } = req.params;

    logger.info(`Running batch test for file ${file_id}`);

    res.status(501).json({
      error: 'Batch test endpoint is not implemented yet',
      file_id,
    });
  } catch (error: any) {
    logger.error(`Error running batch test: ${error.message}`);
    res.status(500).json({ error: 'Failed to run batch test' });
  }
});

export default router;
