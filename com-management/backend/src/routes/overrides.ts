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
  const overridePath = `${overrideRoot}`;
  const overrideRootId = toIdCorePath(overrideRoot);

  return {
    basePath,
    vendor,
    method,
    overrideRoot,
    overridePath,
    overrideRootId,
  };
};

const normalizeOverrideSegment = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/::/g, '.')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^-+|-+$/g, '')
    .replace(/^\.+|\.+$/g, '');

const splitObjectName = (objectName: string) => {
  const [mib, obj] = String(objectName || '').split('::');
  return {
    mib: mib || 'unknown',
    object: obj || mib || 'object',
  };
};

const buildOverrideFileName = (vendor: string, objectName: string) => {
  const { mib, object } = splitObjectName(objectName);
  const vendorPart = normalizeOverrideSegment(vendor) || 'vendor';
  const mibPart = normalizeOverrideSegment(mib) || 'mib';
  const objectPart = normalizeOverrideSegment(object) || 'object';
  return `${vendorPart}.${mibPart}.${objectPart}.override.json`;
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

const extractRuleObjects = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return [] as any[];
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed?.objects)) {
    return parsed.objects;
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }
  return [] as any[];
};

const listRulesAll = async (uaClient: UAClient, node: string, limit: number = 500) => {
  const entries: any[] = [];
  let start = 0;
  while (true) {
    const response = await uaClient.listRules('/', limit, node, true, start);
    const data = Array.isArray(response?.data) ? response.data : [];
    if (data.length === 0) {
      break;
    }
    entries.push(...data);
    if (data.length < limit) {
      break;
    }
    start += data.length;
  }
  return entries;
};

const isPatchOperation = (processor: any) => {
  const op = processor?.op;
  const path = processor?.path;
  if (!op || !path) {
    return false;
  }
  const allowed = new Set(['add', 'replace', 'test', 'remove', 'move', 'copy']);
  return typeof op === 'string' && allowed.has(op) && typeof path === 'string';
};

const normalizeOverrideEntry = (entry: any, objectName: string, method: string) => ({
  name: entry?.name || `${objectName} Override`,
  description: entry?.description || `Overrides for ${objectName}`,
  domain: entry?.domain || 'fault',
  method: entry?.method || method || 'trap',
  scope: entry?.scope || 'post',
  '@objectName': objectName,
  _type: 'override',
  processors: Array.isArray(entry?.processors) ? entry.processors : [],
});

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

const mergeOverrideMeta = (base: any, next: any) => {
  if (!next) {
    return base;
  }
  if (!base) {
    return next;
  }
  return {
    ...next,
    ...base,
    revision: base.revision ?? next.revision,
    modified: base.modified ?? next.modified,
    modifiedBy: base.modifiedBy ?? next.modifiedBy,
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
    const ruleData = await uaClient.readRule(String(file_id), 'HEAD');
    const ruleText = extractRuleText(ruleData);
    if (typeof ruleText !== 'string') {
      const diagnostics = buildRuleTextDiagnostics(ruleData);
      return res.status(400).json({
        error: 'Override load aborted: file content did not include RuleText.',
        lastCall: {
          action: 'readRule',
          path: String(file_id),
          diagnostics,
        },
      });
    }

    const objects = extractRuleObjects(ruleText);
    const objectNames = objects
      .map((obj: any) => obj?.['@objectName'])
      .filter((name: any) => typeof name === 'string' && name.length > 0) as string[];
    const objectNameSet = new Set(objectNames);

    const overrideListing = await listRulesAll(uaClient, resolved.overrideRootId, 500);
    const overrides: any[] = [];
    const overrideMetaByObject: Record<string, any> = {};
    const overrideFilesByObject: Record<string, any> = {};

    for (const objectName of objectNames) {
      const fileName = buildOverrideFileName(resolved.vendor, objectName);
      const overridePathId = `${resolved.overrideRootId}/${fileName}`;
      const entry = overrideListing.find(
        (item: any) =>
          item?.PathName === fileName ||
          item?.PathID === overridePathId ||
          String(item?.PathID || '').endsWith(`/${fileName}`),
      );
      const exists = Boolean(entry);
      overrideFilesByObject[objectName] = {
        fileName,
        pathId: entry?.PathID ?? overridePathId,
        exists,
      };
      if (!exists) {
        continue;
      }

      try {
        const data = await uaClient.readRule(String(entry?.PathID || overridePathId), 'HEAD');
        const ruleText = extractRuleText(data);
        if (typeof ruleText !== 'string') {
          continue;
        }
        const parsed = parseOverridePayload(ruleText);
        const overrideEntry = parsed.overrides.find(
          (item: any) => item?.['@objectName'] === objectName,
        );
        const normalized = overrideEntry
          ? normalizeOverrideEntry(overrideEntry, objectName, resolved.method)
          : null;
        const processors = Array.isArray(normalized?.processors) ? normalized?.processors : [];
        const hasOverrides = processors.length > 0;
        if (hasOverrides && normalized) {
          overrides.push(normalized);
        }

        let overrideMeta: any = null;
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
            const historyMeta = buildOverrideMetaFromHistory(history, {
              overridePath: String(entry.PathID),
              overrideFileName: fileName,
            });
            const revisionName =
              latest?.RevisionName ??
              latest?.revisionName ??
              latest?.RevisionLabel ??
              latest?.revisionLabel;
            if (typeof revisionName === 'string') {
              const parsedRevision = parseRevisionName(revisionName);
              if (parsedRevision.user) {
                overrideMeta = {
                  ...(overrideMeta || {}),
                  modifiedBy: parsedRevision.user,
                };
              }
            }
            overrideMeta = mergeOverrideMeta(overrideMeta, historyMeta);
          } catch (error: any) {
            logger.warn(
              `Override history lookup failed for ${entry.PathID}: ${error?.message || 'unknown error'}`,
            );
          }
        }
        if (overrideMeta) {
          overrideMetaByObject[objectName] = overrideMeta;
        }
      } catch (error: any) {
        logger.warn(
          `Override read failed for ${overridePathId}: ${error?.message || 'unknown error'}`,
        );
      }
    }

    const etagPayload = JSON.stringify(overrides);
    const etag = crypto.createHash('md5').update(etagPayload).digest('hex');
    const overrideRootRulePath = `/rules/${resolved.overrideRootId.replace(/^id-core\//, '')}`;

    return res.json({
      ...resolved,
      overrides,
      overrideFormat: 'object',
      overrideMetaByObject,
      overrideFilesByObject,
      overrideRootRulePath,
      etag,
      exists: overrides.length > 0,
    });
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
          const message = String(createResp?.message || '').toLowerCase();
          if (message.includes('file exists') || message.includes('already exists')) {
            return;
          }
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

    if (!overrides.every(isOverrideEntry)) {
      return res.status(400).json({
        error: 'Override payload must be override object(s) (_type: override).',
      });
    }

    const ruleData = await uaClient.readRule(String(file_id), 'HEAD');
    const ruleText = extractRuleText(ruleData);
    if (typeof ruleText !== 'string') {
      return res.status(400).json({
        error: 'Override save aborted: selected file content is missing RuleText.',
      });
    }
    const objects = extractRuleObjects(ruleText);
    const objectNames = objects
      .map((obj: any) => obj?.['@objectName'])
      .filter((name: any) => typeof name === 'string' && name.length > 0) as string[];

    const overridesByObject = new Map<string, any>();
    for (const entry of overrides) {
      const objectName = entry?.['@objectName'];
      if (!objectName) {
        return res.status(400).json({
          error: 'Global overrides are not supported in per-object mode.',
        });
      }
      if (!objectNameSet.has(objectName)) {
        return res.status(400).json({
          error: `Override target ${objectName} is not part of the selected file.`,
        });
      }
      if (overridesByObject.has(objectName)) {
        return res.status(400).json({
          error: `Multiple override entries found for ${objectName}. Only one per object is supported.`,
        });
      }
      overridesByObject.set(objectName, entry);
    }

    const listing = await listRulesAll(uaClient, resolved.overrideRootId, 500);

    const writeQueue: Array<{
      pathId: string;
      fileName: string;
      action: 'create' | 'update';
      payload: string;
      previousContent?: string | null;
    }> = [];

    for (const objectName of objectNames) {
      const fileName = buildOverrideFileName(resolved.vendor, objectName);
      const overridePathId = `${resolved.overrideRootId}/${fileName}`;
      const listingEntry = listing.find(
        (item: any) =>
          item?.PathName === fileName ||
          item?.PathID === overridePathId ||
          String(item?.PathID || '').endsWith(`/${fileName}`),
      );
      const exists = Boolean(listingEntry);
      const desiredEntryRaw = overridesByObject.get(objectName) || null;

      let existingContent: string | null = null;
      let existingEntry: any = null;
      if (exists) {
        const existing = await uaClient.readRule(String(listingEntry?.PathID || overridePathId));
        const existingText = extractRuleText(existing);
        if (typeof existingText === 'string') {
          existingContent = existingText;
          try {
            const parsed = parseOverridePayload(existingText);
            existingEntry = parsed.overrides.find(
              (item: any) => item?.['@objectName'] === objectName,
            );
          } catch (error: any) {
            return res.status(400).json({
              error:
                'Override save aborted: existing override file is not valid JSON. Check the file content.',
              lastCall: {
                action: 'readRule',
                path: String(listingEntry?.PathID || overridePathId),
                parseError: error?.message || 'Failed to parse JSON',
              },
            });
          }
        }
      }

      let desiredEntry: any = null;
      if (desiredEntryRaw) {
        desiredEntry = normalizeOverrideEntry(desiredEntryRaw, objectName, resolved.method);
      } else if (exists) {
        const normalizedExisting = normalizeOverrideEntry(
          existingEntry || {},
          objectName,
          resolved.method,
        );
        normalizedExisting.processors = [];
        desiredEntry = normalizedExisting;
      }

      if (!desiredEntry) {
        continue;
      }

      const processors = Array.isArray(desiredEntry.processors) ? desiredEntry.processors : [];
      const invalidProcessor = processors.find((proc: any) => !isPatchOperation(proc));
      if (invalidProcessor) {
        return res.status(400).json({
          error:
            'Override save aborted: v3 override files only support JSON Patch operations in processors.',
          lastCall: {
            action: 'validateOverride',
            objectName,
          },
        });
      }

      const payload = JSON.stringify(desiredEntry, null, 2);
      if (existingContent && existingContent.trim() === payload.trim()) {
        continue;
      }

      writeQueue.push({
        pathId: String(listingEntry?.PathID || overridePathId),
        fileName,
        action: exists ? 'update' : 'create',
        payload,
        previousContent: existingContent,
      });
    }

    const writeWithRetry = async (fn: () => Promise<any>, attempts: number = 3) => {
      let lastError: any = null;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          return await fn();
        } catch (error: any) {
          lastError = error;
          if (attempt >= attempts) {
            break;
          }
        }
      }
      throw lastError;
    };

    const appliedWrites: Array<{ action: 'create' | 'update'; pathId: string; previous?: string }>
      = [];
    try {
      for (const write of writeQueue) {
        if (write.action === 'create') {
          await writeWithRetry(
            () =>
              uaClient.createRule(
                write.fileName,
                write.payload,
                resolved.overrideRootId,
                commit_message,
                resolved.overrideRootId,
              ),
            3,
          );
          appliedWrites.push({ action: 'create', pathId: write.pathId });
        } else {
          await writeWithRetry(
            () => uaClient.updateRule(write.pathId, write.payload, commit_message),
            3,
          );
          appliedWrites.push({
            action: 'update',
            pathId: write.pathId,
            previous: write.previousContent || '',
          });
        }
      }
    } catch (error: any) {
      const rollbackMessage = `${commit_message} (rollback)`;
      for (const applied of appliedWrites.reverse()) {
        try {
          if (applied.action === 'create') {
            await uaClient.deleteRule(applied.pathId, rollbackMessage);
          } else {
            await uaClient.updateRule(applied.pathId, applied.previous || '', rollbackMessage);
          }
        } catch (rollbackError: any) {
          logger.warn(
            `Override rollback failed for ${applied.pathId}: ${rollbackError?.message || 'unknown error'}`,
          );
        }
      }
      return res.status(500).json({
        error: error?.message || 'Override save failed; changes were rolled back.',
      });
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
    try {
      await refreshFolderOverviewForNode(uaClient, serverId, resolved.overrideRootId, 25);
    } catch (err: any) {
      logger.warn(`Override folder cache refresh failed: ${err?.message || 'unknown error'}`);
    }

    const etagPayload = JSON.stringify(overrides);
    const etag = crypto.createHash('md5').update(etagPayload).digest('hex');
    res.json({
      ...resolved,
      overrides,
      overrideFormat: 'object',
      etag,
      exists: overrides.length > 0,
      result: { writes: writeQueue.length },
    });
  } catch (error: any) {
    logger.error(`Override save error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to save overrides' });
  }
});

export default router;
