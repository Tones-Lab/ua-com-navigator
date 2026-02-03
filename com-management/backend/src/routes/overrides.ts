import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';

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

const requireEditPermission = (req: Request, res: Response): boolean => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    res.status(401).json({ error: 'No active session' });
    return false;
  }
  const session = getSession(sessionId);
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

const normalizePath = (pathValue: string) => pathValue.replace(/^\/+/, '').replace(/\/+$/, '');

const resolveOverrideLocation = (fileId: string) => {
  const normalized = normalizePath(fileId);
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    throw new Error('File path does not include fcom');
  }

  const objectsIndex = parts.indexOf('_objects', fcomIndex + 1);
  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  const methodBaseIndex = objectsIndex !== -1 ? objectsIndex : fcomIndex;
  const methodIndex = parts.findIndex((segment, idx) => idx > methodBaseIndex && (segment === 'trap' || segment === 'syslog'));
  const method = methodIndex !== -1 ? parts[methodIndex] : undefined;
  const vendor = methodIndex !== -1
    ? parts[methodIndex + 1]
    : parts[methodBaseIndex + 1];

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

const parseRevisionName = (revisionName: string) => {
  const revisionMatch = revisionName.match(/r(\d+)/i);
  const bracketMatches = revisionName.match(/\[([^\]]+)\]/g) || [];
  const bracketValues = bracketMatches.map((entry) => entry.replace(/[\[\]]/g, '').trim());
  return {
    revision: revisionMatch ? revisionMatch[1] : undefined,
    date: bracketValues.length > 0 ? bracketValues[0] : undefined,
    user: bracketValues.length > 1 ? bracketValues[1] : undefined,
  };
};

const extractHistoryEntries = (history: any) => {
  if (Array.isArray(history?.data)) {
    return history.data;
  }
  if (Array.isArray(history?.history)) {
    return history.history;
  }
  if (Array.isArray(history?.entries)) {
    return history.entries;
  }
  if (Array.isArray(history)) {
    return history;
  }
  return [];
};

const buildOverrideMetaFromHistory = (history: any, resolved: any) => {
  const entries = extractHistoryEntries(history);
  const latest = entries[0];
  if (!latest) {
    return null;
  }
  return {
    pathId: resolved.overridePath,
    pathName: resolved.overrideFileName,
    revision: latest.LastRevision ?? latest.Revision ?? latest.Rev ?? latest.revision ?? latest.commit_id,
    modified: latest.ModificationTime ?? latest.LastModified ?? latest.Modified ?? latest.Date ?? latest.date ?? latest.timestamp,
    modifiedBy: latest.ModifiedBy
      ?? latest.LastModifiedBy
      ?? latest.Modifier
      ?? latest.User
      ?? latest.Author
      ?? latest.author
      ?? latest.username
      ?? latest.user,
  };
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
        const listing = await uaClient.listRules('/', 500, resolved.overrideRoot, true);
        const entries = Array.isArray(listing?.data) ? listing.data : [];
        const entry = entries.find((item: any) => (
          item?.PathName === resolved.overrideFileName
          || item?.PathID === resolved.overridePath
          || String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`)
        ));
        if (entry) {
          overrideMeta = {
            ...(overrideMeta || {}),
            pathId: entry.PathID ?? overrideMeta?.pathId,
            pathName: entry.PathName ?? overrideMeta?.pathName,
            revision: overrideMeta?.revision ?? entry.LastRevision ?? entry.Revision ?? entry.Rev,
            modified: overrideMeta?.modified ?? entry.ModificationTime ?? entry.LastModified ?? entry.Modified,
            modifiedBy: overrideMeta?.modifiedBy
              ?? entry.ModifiedBy
              ?? entry.LastModifiedBy
              ?? entry.Modifier
              ?? entry.User,
          };
        }
        if (entry?.PathID) {
          try {
            const history = await uaClient.getHistoryByNode(String(entry.PathID), 1, 0);
            const entriesHistory = extractHistoryEntries(history);
            const latest = entriesHistory[0];
            const revisionName = latest?.RevisionName ?? latest?.revisionName ?? latest?.RevisionLabel ?? latest?.revisionLabel;
            if (typeof revisionName === 'string') {
              const parsed = parseRevisionName(revisionName);
              if (parsed.user) {
                overrideMeta = {
                  ...(overrideMeta || {}),
                  modifiedBy: parsed.user,
                };
              }
            }
          } catch (error: any) {
            logger.warn(`Override history lookup failed for ${entry.PathID}: ${error?.message || 'unknown error'}`);
          }
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
    if (!requireEditPermission(req, res)) {
      return;
    }
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
      const listing = await uaClient.listRules('/', 500, resolved.overrideRoot, true);
      const entries = Array.isArray(listing?.data) ? listing.data : [];
      const entry = entries.find((item: any) => (
        item?.PathName === resolved.overrideFileName
        || item?.PathID === resolved.overridePath
        || String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`)
      ));
      if (entry) {
        overrideMeta = {
          ...(overrideMeta || {}),
          pathId: entry.PathID ?? overrideMeta?.pathId,
          pathName: entry.PathName ?? overrideMeta?.pathName,
          revision: overrideMeta?.revision ?? entry.LastRevision ?? entry.Revision ?? entry.Rev,
          modified: overrideMeta?.modified ?? entry.ModificationTime ?? entry.LastModified ?? entry.Modified,
          modifiedBy: overrideMeta?.modifiedBy
            ?? entry.ModifiedBy
            ?? entry.LastModifiedBy
            ?? entry.Modifier
            ?? entry.User,
        };
      }
      if (entry?.PathID) {
        try {
          const history = await uaClient.getHistoryByNode(String(entry.PathID), 1, 0);
          const entriesHistory = extractHistoryEntries(history);
          const latest = entriesHistory[0];
          const revisionName = latest?.RevisionName ?? latest?.revisionName ?? latest?.RevisionLabel ?? latest?.revisionLabel;
          if (typeof revisionName === 'string') {
            const parsed = parseRevisionName(revisionName);
            if (parsed.user) {
              overrideMeta = {
                ...(overrideMeta || {}),
                modifiedBy: parsed.user,
              };
            }
          }
        } catch (error: any) {
          logger.warn(`Override history lookup failed for ${entry.PathID}: ${error?.message || 'unknown error'}`);
        }
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
