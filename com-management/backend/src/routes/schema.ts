import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/schema
 * Fetch the FCOM JSON schema
 */
router.get('/', (req: Request, res: Response) => {
  try {
    logger.info('Fetching FCOM JSON schema');
    const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
    const fallbackPath = path.resolve(__dirname, '..', 'schema', 'fcom.schema.json');
    const targetPath = fs.existsSync(schemaPath) ? schemaPath : fallbackPath;
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const fcomSchema = JSON.parse(raw);

    res.json(fcomSchema);
  } catch (error: any) {
    logger.error(`Error fetching schema: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch schema' });
  }
});

/**
 * GET /api/v1/schema/version
 * Get schema version and last update time
 */
router.get('/version', (req: Request, res: Response) => {
  try {
    logger.info('Fetching schema version');
    const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
    const fallbackPath = path.resolve(__dirname, '..', 'schema', 'fcom.schema.json');
    const targetPath = fs.existsSync(schemaPath) ? schemaPath : fallbackPath;
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const schema = JSON.parse(raw);
    const checksum = crypto.createHash('sha256').update(raw).digest('hex');

    res.json({
      version: schema['x-version'] || schema.version || 'unknown',
      last_updated: new Date().toISOString(),
      checksum,
    });
  } catch (error: any) {
    logger.error(`Error fetching schema version: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch schema version' });
  }
});

export default router;
