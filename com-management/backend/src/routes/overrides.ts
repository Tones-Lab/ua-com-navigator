import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { refreshOverviewNode } from '../services/overviewIndex';
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

const normalizePath = (pathValue: string) => pathValue.replace(/^\/+/, '').replace(/\/+$/, '');

const toIdCorePath = (pathValue: string) => {
  const normalized = normalizePath(pathValue);
  if (normalized.startsWith('id-core/')) {
    return normalized;
  }
  if (normalized.startsWith('core/')) {
    return `id-core/${normalized.slice('core/'.length)}`;
  }
  return normalized;
};

const resolveOverrideLocation = (fileId: string) => {
  const normalized = normalizePath(fileId);
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    throw new Error('File path does not include fcom');
  }

  const objectsIndex = parts.indexOf('_objects', fcomIndex + 1);
  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  const methodIndex = objectsIndex !== -1 ? objectsIndex + 1 : fcomIndex + 1;
  const method = parts[methodIndex];
  const vendor = parts[methodIndex + 1];

  if (!method || !vendor) {
    throw new Error('Unable to resolve method or vendor from file path');
  }

  const overrideRoot = `${basePath}/overrides`;
  const overrideFileName = method
    ? `${vendor}.${method}.override.json`
    : `${vendor}.override.json`;
  const overridePath = `${overrideRoot}/${overrideFileName}`;
  const overrideRootId = toIdCorePath(overrideRoot);
  const overridePathId = `${overrideRootId}/${overrideFileName}`;

  return {
    basePath,
    vendor,
    method,
    overrideRoot,
    overrideFileName,
    overridePath,
    overrideRootId,
    overridePathId,
  };
};

const extractRuleText = (data: any) => {
  const ruleText =
    data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;
  return typeof ruleText === 'string' ? ruleText : JSON.stringify(ruleText ?? []);
};

const buildRuleTextDiagnostics = (data: any) => {
  const ruleText =
    data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText;
  const responseKeys = data && typeof data === 'object' ? Object.keys(data) : [];
  return {
    responseKeys,
    hasRuleText: typeof ruleText === 'string',
    ruleTextType: typeof ruleText,
  };
};

const isOverrideEntry = (entry: any) =>
  entry && typeof entry === 'object' && String(entry._type || '').toLowerCase() === 'override';

const isLikelyListResponse = (data: any) => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!Array.isArray(data?.data)) {
    return false;
  }
  const hasMessage = typeof data?.message === 'string' || typeof data?.Message === 'string';
  const hasSuccess = typeof data?.success === 'boolean' || typeof data?.Success === 'boolean';
  return hasMessage || hasSuccess;
};

const isValidOverridePayload = (payload: any) => {
  if (Array.isArray(payload)) {
    return payload.every(isOverrideEntry);
  }
  return isOverrideEntry(payload);
};

const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return { overrides: [], format: 'object' as const };
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { overrides: parsed, format: 'array' as const };
  }
  if (parsed && typeof parsed === 'object') {
    if (Object.keys(parsed).length === 0) {
      return { overrides: [], format: 'object' as const };
    }
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

const isMissingRule = (error: any) => {
  const status = error?.response?.status;
  if (status === 404) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  return message.includes('not found');
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
    revision:
      latest.LastRevision ?? latest.Revision ?? latest.Rev ?? latest.revision ?? latest.commit_id,
    modified:
      latest.ModificationTime ??
      latest.LastModified ??
      latest.Modified ??
      latest.Date ??
      latest.date ??
      latest.timestamp,
    modifiedBy:
      latest.ModifiedBy ??
      latest.LastModifiedBy ??
      latest.Modifier ??
      latest.User ??
      latest.Author ??
      latest.author ??
      latest.username ??
      latest.user,
  };
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.query;
    if (!file_id) {
      return res.status(400).json({ error: 'Missing file_id' });
    }

    const resolved = resolveOverrideLocation(String(file_id));
    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);

    try {
      const data = await uaClient.readRule(resolved.overridePathId, 'HEAD');
      const ruleText =
        data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText;
      if (typeof ruleText !== 'string') {
        if (isLikelyListResponse(data)) {
          return res.json({
            ...resolved,
            overrides: [],
            overrideMeta: null,
            etag: null,
            exists: false,
          });
        }
        const diagnostics = buildRuleTextDiagnostics(data);
        return res.status(400).json({
          error:
            'Override load aborted: response did not include RuleText. Check the last call details.',
          lastCall: {
            action: 'readRule',
            path: resolved.overridePathId,
            diagnostics,
          },
        });
      }
      const parsed = parseOverridePayload(ruleText);
      const overrides = parsed.overrides;
      const etag = crypto.createHash('md5').update(ruleText).digest('hex');
      let overrideMeta: any = null;
      try {
        const listing = await uaClient.listRules('/', 500, resolved.overrideRoot, true);
        const entries = Array.isArray(listing?.data) ? listing.data : [];
        const entry = entries.find(
          (item: any) =>
            item?.PathName === resolved.overrideFileName ||
            item?.PathID === resolved.overridePath ||
            String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`),
        );
        if (entry) {
          overrideMeta = {
            ...(overrideMeta || {}),
            pathId: entry.PathID ?? overrideMeta?.pathId,
            pathName: entry.PathName ?? overrideMeta?.pathName,
            revision: overrideMeta?.revision ?? entry.LastRevision ?? entry.Revision ?? entry.Rev,
            modified:
              overrideMeta?.modified ??
              entry.ModificationTime ??
              entry.LastModified ??
              entry.Modified,
            modifiedBy:
              overrideMeta?.modifiedBy ??
              entry.ModifiedBy ??
              entry.LastModifiedBy ??
              entry.Modifier ??
              entry.User,
          };
        }
        if (entry?.PathID) {
          try {
            const history = await uaClient.getHistoryByNode(String(entry.PathID), 1, 0);
            const entriesHistory = extractHistoryEntries(history);
            const latest = entriesHistory[0];
            const revisionName =
              latest?.RevisionName ??
              latest?.revisionName ??
              latest?.RevisionLabel ??
              latest?.revisionLabel;
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
            logger.warn(
              `Override history lookup failed for ${entry.PathID}: ${error?.message || 'unknown error'}`,
            );
          }
        }
      } catch (error: any) {
        logger.warn(
          `Override meta lookup failed for ${resolved.overrideRoot}: ${error?.message || 'unknown error'}`,
        );
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
      logger.warn(
        `Override read failed for ${resolved.overridePath}: ${error?.message || 'unknown error'}`,
      );
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
    if (!(await requireEditPermission(req, res))) {
      return;
    }
    const { file_id, overrides, commit_message } = req.body;
    if (!file_id || !Array.isArray(overrides) || commit_message === undefined) {
      return res.status(400).json({ error: 'Missing file_id, overrides, or commit_message' });
    }
    if (overrides.length !== 1) {
      return res.status(400).json({
        error: 'Override file must contain a single override object.',
      });
    }

    const resolved = resolveOverrideLocation(String(file_id));
    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);

    const ensureOverrideFolder = async () => {
      try {
        const listing = await uaClient.listRules('/', 1, resolved.overrideRootId, true);
        if (listing?.success === false) {
          throw new Error(listing?.message || 'Override folder missing');
        }
        return;
      } catch {
        const parentNode = resolved.overrideRootId.replace(/\/?overrides$/, '');
        const createResp = await uaClient.createFolderInNode(
          parentNode,
          'overrides',
          commit_message,
        );
        if (createResp?.success === false) {
          return res.status(403).json({
            error: createResp?.message || 'Override folder create failed.',
            lastCall: {
              action: 'createFolder',
              path: parentNode,
              folderName: 'overrides',
            },
          });
        }
      }
    };

    const ensureResult = await ensureOverrideFolder();
    if (ensureResult) {
      return;
    }

    if (!isOverrideEntry(overrides[0])) {
      return res.status(400).json({
        error: 'Override payload must be a single override object (_type: override).',
      });
    }

    const payload = JSON.stringify(overrides[0], null, 2);
    let response: any;
    let created = false;
    try {
      const existing = await uaClient.readRule(resolved.overridePathId, 'HEAD');
      const diagnostics = buildRuleTextDiagnostics(existing);
      const ruleText =
        existing?.content?.data?.[0]?.RuleText ??
        existing?.data?.[0]?.RuleText ??
        existing?.RuleText ??
        null;
      if (!diagnostics.hasRuleText || typeof ruleText !== 'string') {
        if (!isLikelyListResponse(existing)) {
          return res.status(400).json({
            error:
              'Override save aborted: existing file content is not a rule text payload. Check the last call details.',
            lastCall: {
              action: 'readRule',
              path: resolved.overridePathId,
              diagnostics,
            },
          });
        }
        response = await uaClient.createRule(
          resolved.overrideFileName,
          payload,
          resolved.overrideRootId,
          commit_message,
          resolved.overrideRootId,
        );
        if (response?.success === false) {
          return res.status(403).json({
            error: response?.message || 'Override create failed: permission required.',
            lastCall: {
              action: 'createRule',
              path: resolved.overrideRoot,
              fileName: resolved.overrideFileName,
            },
          });
        }
        created = true;
      } else {
        try {
          const parsed = JSON.parse(ruleText.trim() || 'null');
          if (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed) &&
            Object.keys(parsed).length === 0
          ) {
            // Treat empty objects as missing override content so saves can proceed.
          } else if (!isValidOverridePayload(parsed)) {
            return res.status(400).json({
              error:
                'Override save aborted: existing file content does not look like override JSON. Check the last call details.',
              lastCall: {
                action: 'readRule',
                path: resolved.overridePath,
                diagnostics,
              },
            });
          }
        } catch (parseError: any) {
          return res.status(400).json({
            error:
              'Override save aborted: existing file content is not valid JSON. Check the last call details.',
            lastCall: {
              action: 'readRule',
              path: resolved.overridePath,
              diagnostics,
              parseError: parseError?.message || 'Failed to parse JSON',
            },
          });
        }
        response = await uaClient.updateRule(resolved.overridePathId, payload, commit_message);
      }
    } catch (error: any) {
      if (!isMissingRule(error)) {
        throw error;
      }
      response = await uaClient.createRule(
        resolved.overrideFileName,
        payload,
        resolved.overrideRootId,
        commit_message,
        resolved.overrideRootId,
      );
      if (response?.success === false) {
        return res.status(403).json({
          error: response?.message || 'Override create failed: permission required.',
          lastCall: {
            action: 'createRule',
            path: resolved.overrideRoot,
            fileName: resolved.overrideFileName,
          },
        });
      }
      created = true;
    }

    const etag = crypto.createHash('md5').update(payload).digest('hex');
    let overrideMeta: any = null;
    try {
      const listing = await uaClient.listRules('/', 500, resolved.overrideRootId, true);
      const entries = Array.isArray(listing?.data) ? listing.data : [];
      const entry = entries.find(
        (item: any) =>
          item?.PathName === resolved.overrideFileName ||
          item?.PathID === resolved.overridePath ||
          String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`),
      );
      if (entry) {
        overrideMeta = {
          ...(overrideMeta || {}),
          pathId: entry.PathID ?? overrideMeta?.pathId,
          pathName: entry.PathName ?? overrideMeta?.pathName,
          revision: overrideMeta?.revision ?? entry.LastRevision ?? entry.Revision ?? entry.Rev,
          modified:
            overrideMeta?.modified ??
            entry.ModificationTime ??
            entry.LastModified ??
            entry.Modified,
          modifiedBy:
            overrideMeta?.modifiedBy ??
            entry.ModifiedBy ??
            entry.LastModifiedBy ??
            entry.Modifier ??
            entry.User,
        };
      }
      if (created && !overrideMeta?.pathId) {
        return res.status(500).json({
          error:
            'Override save failed: override file was not found after create. Check UA rules listing.',
          lastCall: {
            action: 'createRule',
            path: resolved.overrideRoot,
            fileName: resolved.overrideFileName,
          },
        });
      }
      if (entry?.PathID) {
        try {
          const history = await uaClient.getHistoryByNode(String(entry.PathID), 1, 0);
          const entriesHistory = extractHistoryEntries(history);
          const latest = entriesHistory[0];
          const revisionName =
            latest?.RevisionName ??
            latest?.revisionName ??
            latest?.RevisionLabel ??
            latest?.revisionLabel;
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
          logger.warn(
            `Override history lookup failed for ${entry.PathID}: ${error?.message || 'unknown error'}`,
          );
        }
      }
    } catch (error: any) {
      logger.warn(
        `Override meta lookup failed for ${resolved.overrideRoot}: ${error?.message || 'unknown error'}`,
      );
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

    res.json({
      ...resolved,
      overrides,
      overrideFormat: 'object',
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
