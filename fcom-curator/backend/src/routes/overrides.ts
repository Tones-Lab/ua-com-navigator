import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';

const router = Router();

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

const normalizePath = (pathValue: string) => pathValue.replace(/^\/+/, '').replace(/\/+$/, '');

const resolveOverrideLocation = (fileId: string) => {
  const normalized = normalizePath(fileId);
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    throw new Error('File path does not include fcom');
  }

  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  const methodIndex = parts.findIndex((segment, idx) => idx > fcomIndex && (segment === 'trap' || segment === 'syslog'));
  const method = methodIndex !== -1 ? parts[methodIndex] : undefined;
  const vendor = methodIndex !== -1
    ? parts[methodIndex + 1]
    : parts[fcomIndex + 1];

  if (!vendor) {
    throw new Error('Unable to resolve vendor from file path');
  }

  const overrideRoot = `${basePath}/overrides`;
  const overrideFileName = `${vendor}.override.json`;
  const overridePath = `${overrideRoot}/${overrideFileName}`;

  return {
    basePath,
    vendor,
    method,
    overrideRoot,
    overrideFileName,
    overridePath,
  };
};

const extractRuleText = (data: any) => {
  const ruleText = data?.content?.data?.[0]?.RuleText
    ?? data?.data?.[0]?.RuleText
    ?? data?.RuleText
    ?? data;
  return typeof ruleText === 'string' ? ruleText : JSON.stringify(ruleText ?? []);
};

const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return { overrides: [], format: 'array' as const };
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { overrides: parsed, format: 'array' as const };
  }
  if (parsed && typeof parsed === 'object') {
    return { overrides: [parsed], format: 'object' as const };
  }
  throw new Error('Override file must be a JSON array or object at the root');
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.query;
    if (!file_id) {
      return res.status(400).json({ error: 'Missing file_id' });
    }

    const resolved = resolveOverrideLocation(String(file_id));
    const uaClient = getUaClientFromSession(req);

    try {
      const data = await uaClient.readRule(resolved.overridePath, 'HEAD');
      const ruleText = extractRuleText(data);
      const parsed = parseOverridePayload(ruleText);
      const overrides = parsed.overrides;
      const etag = crypto.createHash('md5').update(ruleText).digest('hex');
      let overrideMeta: any = null;
      try {
        const listing = await uaClient.listRules('/', 500, resolved.overrideRoot);
        const entries = Array.isArray(listing?.data) ? listing.data : [];
        const entry = entries.find((item: any) => (
          item?.PathName === resolved.overrideFileName
          || item?.PathID === resolved.overridePath
          || String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`)
        ));
        if (entry) {
          overrideMeta = {
            pathId: entry.PathID,
            pathName: entry.PathName,
            revision: entry.LastRevision ?? entry.Revision ?? entry.Rev,
            modified: entry.ModificationTime ?? entry.LastModified ?? entry.Modified,
            modifiedBy: entry.ModifiedBy ?? entry.LastModifiedBy ?? entry.Modifier ?? entry.User,
          };
        }
      } catch (error: any) {
        logger.warn(`Override meta lookup failed for ${resolved.overrideRoot}: ${error?.message || 'unknown error'}`);
      }
      return res.json({
        ...resolved,
        overrides,
        overrideFormat: parsed.format,
        overrideMeta,
        etag,
        exists: Boolean(overrideMeta),
      });
    } catch (error: any) {
      logger.warn(`Override read failed for ${resolved.overridePath}: ${error?.message || 'unknown error'}`);
      return res.json({
        ...resolved,
        overrides: [],
        overrideMeta: null,
        etag: null,
        exists: false,
      });
    }
  } catch (error: any) {
    logger.error(`Override lookup error: ${error.message}`);
    return res.status(500).json({ error: error.message || 'Failed to resolve overrides' });
  }
});

router.post('/save', async (req: Request, res: Response) => {
  try {
    const { file_id, overrides, commit_message } = req.body;
    if (!file_id || !Array.isArray(overrides) || commit_message === undefined) {
      return res.status(400).json({ error: 'Missing file_id, overrides, or commit_message' });
    }

    const resolved = resolveOverrideLocation(String(file_id));
    const uaClient = getUaClientFromSession(req);

    let overrideFormat: 'array' | 'object' = 'array';
    try {
      const data = await uaClient.readRule(resolved.overridePath, 'HEAD');
      const ruleText = extractRuleText(data);
      const parsed = parseOverridePayload(ruleText);
      overrideFormat = parsed.format;
    } catch {
      return res.status(409).json({
        error: 'Override file not found. Create it manually before saving overrides.',
        overridePath: resolved.overridePath,
      });
    }

    const payload = overrideFormat === 'object' && overrides.length === 1
      ? JSON.stringify(overrides[0], null, 2)
      : JSON.stringify(overrides, null, 2);
    const response = await uaClient.updateRule(resolved.overridePath, payload, commit_message);

    const etag = crypto.createHash('md5').update(payload).digest('hex');
    let overrideMeta: any = null;
    try {
      const listing = await uaClient.listRules('/', 500, resolved.overrideRoot);
      const entries = Array.isArray(listing?.data) ? listing.data : [];
      const entry = entries.find((item: any) => (
        item?.PathName === resolved.overrideFileName
        || item?.PathID === resolved.overridePath
        || String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`)
      ));
      if (entry) {
        overrideMeta = {
          pathId: entry.PathID,
          pathName: entry.PathName,
          revision: entry.LastRevision ?? entry.Revision ?? entry.Rev,
          modified: entry.ModificationTime ?? entry.LastModified ?? entry.Modified,
          modifiedBy: entry.ModifiedBy ?? entry.LastModifiedBy ?? entry.Modifier ?? entry.User,
        };
      }
    } catch (error: any) {
      logger.warn(`Override meta lookup failed for ${resolved.overrideRoot}: ${error?.message || 'unknown error'}`);
    }
    res.json({
      ...resolved,
      overrides,
      overrideFormat: overrideFormat === 'object' && overrides.length === 1 ? 'object' : 'array',
      overrideMeta,
      exists: Boolean(overrideMeta),
      etag,
      result: response,
    });
  } catch (error: any) {
    logger.error(`Override save error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to save overrides' });
  }
});

export default router;
