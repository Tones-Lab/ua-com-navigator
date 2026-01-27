import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/files/browse
 * List directory tree for FCOM files
 */
router.get('/browse', (req: Request, res: Response) => {
  try {
    const { path = '/', vendor, protocol_type, search, limit = 100 } = req.query;

    logger.info(`Browsing files at path: ${path}, vendor: ${vendor}, protocol: ${protocol_type}`);

    // TODO: Call UA server REST API to fetch file listing from SVN
    // For now, return mock data
    const mockListing = {
      path: path,
      entries: [
        {
          name: 'cisco',
          type: 'directory',
          path: '/trap/cisco',
          last_modified: new Date().toISOString(),
          last_author: 'api',
        },
        {
          name: 'arista',
          type: 'directory',
          path: '/trap/arista',
          last_modified: new Date().toISOString(),
          last_author: 'api',
        },
        {
          name: 'CISCO-ENVMON-MIB-FCOM.json',
          type: 'file',
          path: '/trap/cisco/CISCO-ENVMON-MIB-FCOM.json',
          size: 2048,
          last_modified: new Date().toISOString(),
          last_author: 'api',
        },
      ],
    };

    res.json(mockListing);
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

    // TODO: Call UA server REST API and return preview
    const mockPreview = {
      file_id: file_id,
      path: `/trap/cisco/${file_id}`,
      size: 2048,
      last_modified: new Date().toISOString(),
      last_author: 'api',
      object_count: 3,
      objects_preview: [
        {
          '@objectName': 'CISCO-ENVMON-FAN-FAILURE',
          description: 'Fan failure detected',
        },
        {
          '@objectName': 'CISCO-ENVMON-TEMP-CRITICAL',
          description: 'Temperature critical',
        },
      ],
    };

    res.json(mockPreview);
  } catch (error: any) {
    logger.error(`Error previewing file: ${error.message}`);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

export default router;
