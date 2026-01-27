import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/schema
 * Fetch the FCOM JSON schema
 */
router.get('/', (req: Request, res: Response) => {
  try {
    logger.info('Fetching FCOM JSON schema');

    // TODO: Serve actual FCOM JSON Schema (Draft 7)
    // This is a minimal example schema
    const fcomSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'FCOM Object Schema',
      type: 'object',
      properties: {
        objects: {
          type: 'array',
          items: {
            type: 'object',
            required: ['@objectName'],
            properties: {
              '@objectName': {
                type: 'string',
                description: 'Unique identifier for the FCOM object',
              },
              description: {
                type: 'string',
                description: 'Human-readable description of the event',
              },
              certification: {
                type: 'string',
                enum: ['CERTIFIED', 'UNCERTIFIED', 'IN_REVIEW'],
              },
              test: {
                type: 'string',
              },
              tests: {
                type: 'string',
              },
              event: {
                type: 'object',
                properties: {
                  EventType: { type: 'string' },
                  Severity: {
                    type: 'string',
                    enum: ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFORMATIONAL'],
                  },
                  Summary: { type: 'string' },
                  ExpireTime: { type: 'integer' },
                  SubNode: { type: 'boolean' },
                  EventCategory: { type: 'string' },
                },
              },
              trap: {
                type: 'object',
                properties: {
                  variables: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
              preProcessors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['grok', 'lookup', 'regex'],
                    },
                    parameters: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

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

    res.json({
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      checksum: 'abc123def456',
    });
  } catch (error: any) {
    logger.error(`Error fetching schema version: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch schema version' });
  }
});

export default router;
