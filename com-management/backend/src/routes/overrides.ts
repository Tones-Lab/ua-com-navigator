import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { refreshOverviewNode } from '../services/overviewIndex';
import { refreshFolderOverviewForNode } from './folders';
import {
  buildOverrideFileName,
  buildLegacyOverrideFileNames,
  resolveOverrideLocation,
  extractRuleText,
  buildRuleTextDiagnostics,
  isOverrideEntry,
  isLikelyListResponse,
  parseOverridePayload,
  extractRuleObjects,
  isPatchOperation,
  normalizeOverrideEntry,
  parseRevisionName,
  extractHistoryEntries,
  buildOverrideMetaFromHistory,
  mergeOverrideMeta,
} from '../services/com/overrides';

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
  if (!server?.server_id) {
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

const listRulesAll = async (uaClient: UAClient, node: string, pageLimit: number) => {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const response = await uaClient.listRules('/', pageLimit, node, false, start);
    if (isLikelyListResponse(response) && response?.success === false) {
      throw new Error(response?.message || 'listRules failed');
    }
    const data = Array.isArray(response?.data) ? response.data : [];
    if (data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < pageLimit) {
      break;
    }
    start += data.length;
  }
  return all;
};



type OverrideSaveProgress = {
  fileName: string;
  action: 'create' | 'update' | 'delete';
  status: 'queued' | 'saving' | 'done' | 'failed';
};

type OverrideSaveError = Error & { status?: number; payload?: any };

const createOverrideSaveError = (status: number, payload: any): OverrideSaveError => {
  const error = new Error(payload?.error || 'Override save failed') as OverrideSaveError;
  error.status = status;
  error.payload = payload;
  return error;
};

const performOverrideSave = async (params: {
  fileId: string;
  overrides: any[];
  commitMessage: string;
  uaClient: UAClient;
  serverId: string;
  onProgress?: (entry: OverrideSaveProgress) => void;
}) => {
  const { fileId, overrides, commitMessage, uaClient, serverId, onProgress } = params;
  const resolved = resolveOverrideLocation(String(fileId));
  const resolvedMethod = resolved.method || 'trap';

  const ensureOverrideFolder = async () => {
    try {
      const listing = await uaClient.listRules('/', 1, resolved.overrideRoot, true);
      if (listing?.success === false) {
        throw new Error(listing?.message || 'Override folder missing');
      }
      return;
    } catch {
      const parentNode = resolved.overrideRoot.replace(/\/?overrides$/, '');
      const createResp = await uaClient.createFolderInNode(parentNode, 'overrides', commitMessage);
      if (createResp?.success === false) {
        const message = String(createResp?.message || '').toLowerCase();
        if (message.includes('file exists') || message.includes('already exists')) {
          return;
        }
        throw createOverrideSaveError(403, {
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

  await ensureOverrideFolder();

  if (!overrides.every(isOverrideEntry)) {
    throw createOverrideSaveError(400, {
      error: 'Override payload must be override object(s) (_type: override).',
    });
  }

  const ruleData = await uaClient.readRule(String(fileId), 'HEAD');
  const ruleText = extractRuleText(ruleData);
  if (typeof ruleText !== 'string') {
    throw createOverrideSaveError(400, {
      error: 'Override save aborted: selected file content is missing RuleText.',
    });
  }
  const objects = extractRuleObjects(ruleText);
  const objectNames = objects
    .map((obj: any) => obj?.['@objectName'])
    .filter((name: any) => typeof name === 'string' && name.length > 0) as string[];
  const objectNameSet = new Set(objectNames);

  const overridesByObject = new Map<string, any>();
  for (const entry of overrides) {
    const objectName = entry?.['@objectName'];
    if (!objectName) {
      throw createOverrideSaveError(400, {
        error: 'Global overrides are not supported in per-object mode.',
      });
    }
    if (!objectNameSet.has(objectName)) {
      throw createOverrideSaveError(400, {
        error: `Override target ${objectName} is not part of the selected file.`,
      });
    }
    if (overridesByObject.has(objectName)) {
      throw createOverrideSaveError(400, {
        error: `Multiple override entries found for ${objectName}. Only one per object is supported.`,
      });
    }
    overridesByObject.set(objectName, entry);
  }

  const listing = await listRulesAll(uaClient, resolved.overrideRoot, 500);
  const legacyFileNames = buildLegacyOverrideFileNames(resolved.vendor, resolved.method);
  const legacyListingEntry = listing.find((item: any) =>
    legacyFileNames.includes(String(item?.PathName || '')),
  );
  let legacyOverrides: any[] = [];
  let legacyFormat: 'array' | 'object' | null = null;
  let legacyContent: string | null = null;
  const legacyOverridesByObject = new Map<string, any>();
  if (legacyListingEntry) {
    const legacyData = await uaClient.readRule(String(legacyListingEntry?.PathID || ''));
    const legacyText = extractRuleText(legacyData);
    if (typeof legacyText === 'string') {
      legacyContent = legacyText;
      try {
        const parsed = parseOverridePayload(legacyText);
        legacyOverrides = parsed.overrides;
        legacyFormat = parsed.format;
        parsed.overrides.forEach((entry: any) => {
          const name = entry?.['@objectName'];
          if (typeof name === 'string' && name.length > 0) {
            legacyOverridesByObject.set(name, entry);
          }
        });
      } catch (error: any) {
        throw createOverrideSaveError(400, {
          error:
            'Override save aborted: legacy override file is not valid JSON. Check the file content.',
          lastCall: {
            action: 'readRule',
            path: String(legacyListingEntry?.PathID || ''),
            parseError: error?.message || 'Failed to parse JSON',
          },
        });
      }
    }
  }

  const writeQueue: Array<{
    pathId: string;
    fileName: string;
    action: 'create' | 'update' | 'delete';
    payload?: string;
    previousContent?: string | null;
  }> = [];

  for (const objectName of objectNames) {
    const fileName = buildOverrideFileName(resolved.vendor, objectName);
    const overridePathId = `${resolved.overrideRoot}/${fileName}`;
    const listingEntry = listing.find(
      (item: any) =>
        item?.PathName === fileName ||
        item?.PathID === overridePathId ||
        String(item?.PathID || '').endsWith(`/${fileName}`),
    );
    const exists = Boolean(listingEntry);
    const legacyEntryForObject = legacyOverridesByObject.get(objectName) || null;
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
          existingEntry = parsed.overrides.find((item: any) => item?.['@objectName'] === objectName);
        } catch (error: any) {
          throw createOverrideSaveError(400, {
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
      desiredEntry = normalizeOverrideEntry(desiredEntryRaw, objectName, resolvedMethod);
    } else if (exists || legacyEntryForObject) {
      const normalizedExisting = normalizeOverrideEntry(
        existingEntry || legacyEntryForObject || {},
        objectName,
        resolvedMethod,
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
      throw createOverrideSaveError(400, {
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

  if (legacyListingEntry && legacyFormat) {
    const legacyRemainingOverrides = legacyOverrides.filter((entry: any) => {
      const name = entry?.['@objectName'];
      return !name || !objectNameSet.has(name);
    });
    if (legacyRemainingOverrides.length === 0) {
      writeQueue.push({
        pathId: String(legacyListingEntry?.PathID || ''),
        fileName: String(legacyListingEntry?.PathName || ''),
        action: 'delete',
        previousContent: legacyContent,
      });
    } else {
      const legacyPayload =
        legacyFormat === 'object' && legacyRemainingOverrides.length === 1
          ? JSON.stringify(legacyRemainingOverrides[0], null, 2)
          : JSON.stringify(legacyRemainingOverrides, null, 2);
      if (!legacyContent || legacyContent.trim() !== legacyPayload.trim()) {
        writeQueue.push({
          pathId: String(legacyListingEntry?.PathID || ''),
          fileName: String(legacyListingEntry?.PathName || ''),
          action: 'update',
          payload: legacyPayload,
          previousContent: legacyContent,
        });
      }
    }
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

  const fileResults: OverrideSaveProgress[] = writeQueue.map((write) => ({
    fileName: write.fileName,
    action: write.action,
    status: 'queued',
  }));
  fileResults.forEach((entry) => onProgress?.(entry));

  const appliedWrites: Array<{
    action: 'create' | 'update' | 'delete';
    pathId: string;
    fileName: string;
    previous?: string;
  }> = [];
  try {
    for (let index = 0; index < writeQueue.length; index += 1) {
      const write = writeQueue[index];
      if (fileResults[index]) {
        fileResults[index].status = 'saving';
        onProgress?.(fileResults[index]);
      }
      if (write.action === 'create') {
        await writeWithRetry(
          () =>
            uaClient.createRule(
              write.fileName,
              write.payload,
              resolved.overrideRoot,
              commitMessage,
              resolved.overrideRoot,
            ),
          3,
        );
        appliedWrites.push({ action: 'create', pathId: write.pathId, fileName: write.fileName });
        if (fileResults[index]) {
          fileResults[index].status = 'done';
          onProgress?.(fileResults[index]);
        }
      } else if (write.action === 'delete') {
        await writeWithRetry(() => uaClient.deleteRule(write.pathId, commitMessage), 3);
        appliedWrites.push({
          action: 'delete',
          pathId: write.pathId,
          fileName: write.fileName,
          previous: write.previousContent || '',
        });
        if (fileResults[index]) {
          fileResults[index].status = 'done';
          onProgress?.(fileResults[index]);
        }
      } else {
        await writeWithRetry(
          () => uaClient.updateRule(write.pathId, write.payload || '', commitMessage),
          3,
        );
        appliedWrites.push({
          action: 'update',
          pathId: write.pathId,
          fileName: write.fileName,
          previous: write.previousContent || '',
        });
        if (fileResults[index]) {
          fileResults[index].status = 'done';
          onProgress?.(fileResults[index]);
        }
      }
    }
  } catch (error: any) {
    const failedIndex = fileResults.findIndex((entry) => entry.status === 'saving');
    if (failedIndex >= 0) {
      fileResults[failedIndex].status = 'failed';
      onProgress?.(fileResults[failedIndex]);
    }
    const rollbackMessage = `${commitMessage} (rollback)`;
    for (const applied of appliedWrites.reverse()) {
      try {
        if (applied.action === 'create') {
          await uaClient.deleteRule(applied.pathId, rollbackMessage);
        } else if (applied.action === 'delete') {
          await uaClient.createRule(
            applied.fileName,
            applied.previous || '',
            resolved.overrideRoot,
            rollbackMessage,
            resolved.overrideRoot,
          );
        } else {
          await uaClient.updateRule(applied.pathId, applied.previous || '', rollbackMessage);
        }
      } catch (rollbackError: any) {
        logger.warn(
          `Override rollback failed for ${applied.pathId}: ${rollbackError?.message || 'unknown error'}`,
        );
      }
    }
    throw createOverrideSaveError(500, {
      error: error?.message || 'Override save failed; changes were rolled back.',
      result: { writes: writeQueue.length, files: fileResults },
    });
  }

  const parentNode = String(fileId).split('/').slice(0, -1).join('/');
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
    await refreshFolderOverviewForNode(uaClient, serverId, resolved.overrideRoot, 25);
  } catch (err: any) {
    logger.warn(`Override folder cache refresh failed: ${err?.message || 'unknown error'}`);
  }

  const etagPayload = JSON.stringify(overrides);
  const etag = crypto.createHash('md5').update(etagPayload).digest('hex');
  return {
    ...resolved,
    overrides,
    overrideFormat: 'object',
    etag,
    exists: overrides.length > 0,
    result: { writes: writeQueue.length, files: fileResults },
  };
};



router.get('/', async (req: Request, res: Response) => {
  try {
    const { file_id } = req.query;
    if (!file_id) {
      return res.status(400).json({ error: 'Missing file_id' });
    }

    const start = Date.now();
    const logTiming = (label: string, since: number) =>
      logger.info(`Overrides timing ${label} for ${file_id}: ${Date.now() - since}ms`);

    const resolved = resolveOverrideLocation(String(file_id));
    const resolvedMethod = resolved.method || 'trap';
    const uaClient = await getUaClientFromSession(req);
    const readStart = Date.now();
    const ruleData = await uaClient.readRule(String(file_id), 'HEAD');
    logTiming('readRule', readStart);
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
    logger.info(
      `Overrides lookup start for ${file_id}: vendor=${resolved.vendor} method=${resolved.method} objects=${objectNames.length}`,
    );

    const listStart = Date.now();
    const overrideListing = await listRulesAll(uaClient, resolved.overrideRoot, 500);
    logTiming('listRulesAll', listStart);
    logger.info(
      `Overrides listing for ${file_id}: entries=${overrideListing.length} root=${resolved.overrideRoot}`,
    );
    const legacyFileNames = buildLegacyOverrideFileNames(resolved.vendor, resolved.method);
    const legacyListingEntry = overrideListing.find((item: any) =>
      legacyFileNames.includes(String(item?.PathName || '')),
    );
    const legacyOverridesByObject = new Map<string, any>();
    if (legacyListingEntry) {
      try {
        const legacyStart = Date.now();
        const legacyData = await uaClient.readRule(String(legacyListingEntry?.PathID), 'HEAD');
        logTiming('legacyRead', legacyStart);
        const legacyText = extractRuleText(legacyData);
        if (typeof legacyText === 'string') {
          const parsed = parseOverridePayload(legacyText);
          parsed.overrides.forEach((entry: any) => {
            const name = entry?.['@objectName'];
            if (typeof name === 'string' && name.length > 0) {
              legacyOverridesByObject.set(name, entry);
            }
          });
        }
      } catch (error: any) {
        logger.warn(
          `Legacy override read failed for ${legacyListingEntry?.PathID}: ${error?.message || 'unknown error'}`,
        );
      }
    }
    const overrides: any[] = [];
    const overrideMetaByObject: Record<string, any> = {};
    const overrideFilesByObject: Record<string, any> = {};
    const objectStats = {
      existing: 0,
      legacyOnly: 0,
      missing: 0,
      withOverrides: 0,
    };
    const missingObjects: string[] = [];

    let overridesReadCount = 0;
    let overridesReadTime = 0;
    const slowOverrides: Array<{ file: string; ms: number }> = [];
    for (const objectName of objectNames) {
      const fileName = buildOverrideFileName(resolved.vendor, objectName);
      const overridePathId = `${resolved.overrideRoot}/${fileName}`;
      const entry = overrideListing.find(
        (item: any) =>
          item?.PathName === fileName ||
          item?.PathID === overridePathId ||
          String(item?.PathID || '').endsWith(`/${fileName}`),
      );
      const exists = Boolean(entry);
      const legacyEntry = legacyOverridesByObject.get(objectName);
      if (exists) {
        objectStats.existing += 1;
      } else if (legacyEntry) {
        objectStats.legacyOnly += 1;
      } else {
        objectStats.missing += 1;
        if (missingObjects.length < 5) {
          missingObjects.push(objectName);
        }
      }
      overrideFilesByObject[objectName] = {
        fileName: entry?.PathName ?? legacyListingEntry?.PathName ?? fileName,
        pathId: entry?.PathID ?? legacyListingEntry?.PathID ?? overridePathId,
        exists: exists || Boolean(legacyEntry),
      };
      if (!exists && !legacyEntry) {
        continue;
      }

      try {
        let normalized: any = null;
        let metaEntry: any = null;
        if (exists) {
          const overrideReadStart = Date.now();
          const data = await uaClient.readRule(String(entry?.PathID || overridePathId), 'HEAD');
          const elapsed = Date.now() - overrideReadStart;
          overridesReadCount += 1;
          overridesReadTime += elapsed;
          if (elapsed > 1500) {
            slowOverrides.push({ file: String(entry?.PathID || overridePathId), ms: elapsed });
          }
          const ruleText = extractRuleText(data);
          if (typeof ruleText !== 'string') {
            continue;
          }
          const parsed = parseOverridePayload(ruleText);
          const overrideEntry = parsed.overrides.find(
            (item: any) => item?.['@objectName'] === objectName,
          );
          normalized = overrideEntry
            ? normalizeOverrideEntry(overrideEntry, objectName, resolvedMethod)
            : null;
          metaEntry = entry;
        } else if (legacyEntry) {
          normalized = normalizeOverrideEntry(legacyEntry, objectName, resolvedMethod);
          metaEntry = legacyListingEntry;
        }

        const processors = Array.isArray(normalized?.processors) ? normalized?.processors : [];
        const hasOverrides = processors.length > 0;
        if (hasOverrides && normalized) {
          overrides.push(normalized);
          objectStats.withOverrides += 1;
        }

        let overrideMeta: any = null;
        if (metaEntry) {
          overrideMeta = {
            ...(overrideMeta || {}),
            pathId: metaEntry.PathID ?? overrideMeta?.pathId,
            pathName: metaEntry.PathName ?? overrideMeta?.pathName,
            revision:
              overrideMeta?.revision ??
              metaEntry.LastRevision ??
              metaEntry.Revision ??
              metaEntry.Rev,
            modified:
              overrideMeta?.modified ??
              metaEntry.ModificationTime ??
              metaEntry.LastModified ??
              metaEntry.Modified,
            modifiedBy:
              overrideMeta?.modifiedBy ??
              metaEntry.ModifiedBy ??
              metaEntry.LastModifiedBy ??
              metaEntry.Modifier ??
              metaEntry.User,
          };
        }
        if (metaEntry?.PathID) {
          try {
            const history = await uaClient.getHistoryByNode(String(metaEntry.PathID), 1, 0);
            const entriesHistory = extractHistoryEntries(history);
            const latest = entriesHistory[0];
            const historyMeta = buildOverrideMetaFromHistory(history, {
              overridePath: String(metaEntry.PathID),
              overrideFileName: metaEntry.PathName ?? fileName,
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
              `Override history lookup failed for ${metaEntry.PathID}: ${error?.message || 'unknown error'}`,
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

    if (overridesReadCount > 0) {
      logger.info(
        `Overrides timing per-file reads for ${file_id}: ${overridesReadCount} files in ${overridesReadTime}ms`,
      );
      if (slowOverrides.length > 0) {
        logger.info(
          `Overrides slow reads for ${file_id}: ${slowOverrides
            .slice(0, 5)
            .map((entry) => `${entry.file} (${entry.ms}ms)`)
            .join(', ')}`,
        );
      }
    }
    logger.info(`Overrides total for ${file_id}: ${Date.now() - start}ms`);
    logger.info(
      `Overrides summary for ${file_id}: existing=${objectStats.existing} legacyOnly=${objectStats.legacyOnly} missing=${objectStats.missing} withOverrides=${objectStats.withOverrides} overrideEntries=${overrides.length}`,
    );
    if (missingObjects.length > 0) {
      logger.info(`Overrides missing sample for ${file_id}: ${missingObjects.join(', ')}`);
    }

    const etagPayload = JSON.stringify(overrides);
    const etag = crypto.createHash('md5').update(etagPayload).digest('hex');
    const overrideRootRulePath = `/rules/${resolved.overrideRoot.replace(/^id-core\//, '')}`;

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
    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);
    const result = await performOverrideSave({
      fileId: String(file_id),
      overrides,
      commitMessage: String(commit_message),
      uaClient,
      serverId,
    });
    res.json(result);
  } catch (error: any) {
    const status = (error as OverrideSaveError)?.status || 500;
    const payload = (error as OverrideSaveError)?.payload || {
      error: error.message || 'Failed to save overrides',
    };
    logger.error(`Override save error: ${error.message}`);
    res.status(status).json(payload);
  }
});

router.post('/save-stream', async (req: Request, res: Response) => {
  try {
    if (!(await requireEditPermission(req, res))) {
      return;
    }
    const { file_id, overrides, commit_message } = req.body;
    if (!file_id || !Array.isArray(overrides) || commit_message === undefined) {
      res.status(400).json({ error: 'Missing file_id, overrides, or commit_message' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const uaClient = await getUaClientFromSession(req);
    const serverId = await getServerIdFromSession(req);

    const result = await performOverrideSave({
      fileId: String(file_id),
      overrides,
      commitMessage: String(commit_message),
      uaClient,
      serverId,
      onProgress: (entry) => sendEvent('progress', entry),
    });

    sendEvent('complete', result);
    res.end();
  } catch (error: any) {
    const status = (error as OverrideSaveError)?.status || 500;
    const payload = (error as OverrideSaveError)?.payload || {
      error: error.message || 'Failed to save overrides',
    };
    res.statusCode = status;
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  }
});

export default router;
