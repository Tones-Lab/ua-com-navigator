import { Router, Request, Response } from 'express';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';
import { getEventsSchemaFields } from '../services/eventsSchemaCache';

const router = Router();
const CACHE_TTL_MS = Number(process.env.FOLDER_OVERVIEW_TTL_MS || 10 * 60 * 1000);
const overviewCache = new Map<string, { data: any; fetchedAt: number }>();

const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaRaw);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const getUaClientFromSession = (req: Request): UAClient => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const auth = getCredentials(sessionId);
  const server = getServer(sessionId);
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

const parseRuleText = (payload: any) => {
  const ruleText = payload?.data?.[0]?.RuleText ?? payload?.RuleText ?? payload?.content?.data?.[0]?.RuleText;
  if (typeof ruleText === 'string') {
    try {
      return JSON.parse(ruleText);
    } catch {
      return null;
    }
  }
  return ruleText && typeof ruleText === 'object' ? ruleText : null;
};

const getEventFields = (obj: any) => {
  if (!obj || typeof obj !== 'object') {
    return {} as Record<string, any>;
  }
  return typeof obj.event === 'object' && obj.event ? obj.event : {};
};

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { node, limit = '25' } = req.query as { node?: string; limit?: string };
    if (!node) {
      return res.status(400).json({ error: 'Missing node' });
    }
    const cacheKey = `${node}:${limit}`;
    const cached = overviewCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const uaClient = getUaClientFromSession(req);
    const eventsFields = await getEventsSchemaFields(uaClient);
    const allowedFields = new Set(eventsFields.map((f) => f.toLowerCase()));

    const listing = await uaClient.listRules('/', 500, node);
    const entries = Array.isArray(listing?.data) ? listing.data : [];
    const files = entries.filter((item: any) => String(item.PathName || '').toLowerCase().endsWith('.json'));

    let fileCount = files.length;
    let objectCount = 0;
    let schemaErrorCount = 0;
    let unknownFieldCount = 0;

    const rows: Array<{ file: string; pathId: string; schemaErrors: number; unknownFields: number; objects: number }> = [];

    for (const entry of files) {
      const fileId = entry.PathID;
      const response = await uaClient.readRule(fileId);
      const content = parseRuleText(response);
      if (!content) {
        continue;
      }
      const objects = Array.isArray(content?.objects) ? content.objects : Array.isArray(content) ? content : [];
      objectCount += objects.length;

      const valid = validate(content);
      const errors = valid ? 0 : (validate.errors || []).length;
      schemaErrorCount += errors;

      let unknowns = 0;
      if (allowedFields.size > 0) {
        for (const obj of objects) {
          const event = getEventFields(obj);
          for (const key of Object.keys(event)) {
            if (!allowedFields.has(key.toLowerCase())) {
              unknowns += 1;
            }
          }
        }
      }
      unknownFieldCount += unknowns;

      rows.push({
        file: entry.PathName || fileId,
        pathId: fileId,
        schemaErrors: errors,
        unknownFields: unknowns,
        objects: objects.length,
      });
    }

    const ranked = rows
      .sort((a, b) => (b.schemaErrors + b.unknownFields) - (a.schemaErrors + a.unknownFields))
      .slice(0, Number(limit));

    const data = {
      node,
      fileCount,
      objectCount,
      schemaErrorCount,
      unknownFieldCount,
      topFiles: ranked,
      cachedAt: new Date().toISOString(),
    };

    overviewCache.set(cacheKey, { data, fetchedAt: Date.now() });
    res.json(data);
  } catch (error: any) {
    logger.error(`Folder overview error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to build folder overview' });
  }
});

export default router;
