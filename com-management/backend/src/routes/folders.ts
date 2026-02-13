import { Router, Request, Response } from 'express';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import cacheLogger from '../utils/cacheLogger';
import UAClient from '../services/ua';
import { overviewIndex, OverviewCounts, OverviewData } from '../services/overviewIndex';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { getEventsSchemaFields } from '../services/eventsSchemaCache';
import { getRedisClient } from '../services/redisClient';

const router = Router();
const CACHE_TTL_MS = Number(
  process.env.CACHE_TTL_MS || process.env.FOLDER_OVERVIEW_TTL_MS || 10 * 60 * 1000,
);
const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const FOLDER_OVERVIEW_PAGE_LIMIT = Number(process.env.FOLDER_OVERVIEW_PAGE_LIMIT || 500);
const FOLDER_OVERVIEW_CONCURRENCY = Math.max(
  1,
  Number(process.env.FOLDER_OVERVIEW_CONCURRENCY || 20),
);
const FOLDER_OVERVIEW_FILE_CONCURRENCY = Math.max(
  1,
  Number(process.env.FOLDER_OVERVIEW_FILE_CONCURRENCY || 20),
);
const FOLDER_LIST_RETRIES = Math.max(0, Number(process.env.FOLDER_LIST_RETRIES || 3));
const FOLDER_LIST_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.FOLDER_LIST_RETRY_DELAY_MS || 500),
);
const FOLDER_READ_RETRIES = Math.max(0, Number(process.env.FOLDER_READ_RETRIES || 3));
const FOLDER_READ_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.FOLDER_READ_RETRY_DELAY_MS || 500),
);
const FOLDER_CACHE_PREFIX = 'fcom:folder:overview:';
const FOLDER_CACHE_META_PREFIX = 'fcom:folder:overview:meta:';
const buildCacheKey = (serverId: string, node: string, limit: number) =>
  `${FOLDER_CACHE_PREFIX}${serverId}:${node}:${limit}`;
const buildMetaKey = (serverId: string) => `${FOLDER_CACHE_META_PREFIX}${serverId}`;

type CacheStats = {
  keyCount: number;
  sizeBytes: number;
  updatedAt: string;
};

const buildStateByServer = new Map<
  string,
  {
    isBuilding: boolean;
    buildId: number | null;
    progress: { phase: string | null; processed: number; total: number; unit: string };
  }
>();

const getBuildState = (serverId: string) => {
  if (!buildStateByServer.has(serverId)) {
    buildStateByServer.set(serverId, {
      isBuilding: false,
      buildId: null,
      progress: { phase: null, processed: 0, total: 0, unit: 'folders' },
    });
  }
  return buildStateByServer.get(serverId)!;
};

const loadFolderCache = async (serverId: string, node: string, limit: number) => {
  try {
    const client = await getRedisClient();
    const raw = await client.get(buildCacheKey(serverId, node, limit));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as { data: any; fetchedAt: number; expiresAtMs?: number | null };
  } catch (error: any) {
    cacheLogger.warn(`Folder cache load failed: ${error?.message || 'read error'}`);
    return null;
  }
};

const persistFolderCache = async (serverId: string, node: string, limit: number, data: any) => {
  try {
    const client = await getRedisClient();
    const payload = {
      data,
      fetchedAt: Date.now(),
      expiresAtMs: Date.now() + CACHE_TTL_MS,
    };
    await client.set(buildCacheKey(serverId, node, limit), JSON.stringify(payload));
  } catch (error: any) {
    cacheLogger.warn(`Folder cache persist failed: ${error?.message || 'write error'}`);
  }
};

const persistFolderMeta = async (
  serverId: string,
  lastBuiltAtMs: number,
  cacheStats?: CacheStats | null,
) => {
  try {
    const client = await getRedisClient();
    await client.set(
      buildMetaKey(serverId),
      JSON.stringify({
        lastBuiltAtMs,
        expiresAtMs: Date.now() + CACHE_TTL_MS,
        cacheStats: cacheStats ?? null,
      }),
    );
  } catch (error: any) {
    cacheLogger.warn(`Folder cache meta persist failed: ${error?.message || 'write error'}`);
  }
};

const _clearFolderCache = async (serverId: string) => {
  try {
    const client = await getRedisClient();
    const keys: string[] = [];
    for await (const key of client.scanIterator({
      MATCH: `${FOLDER_CACHE_PREFIX}${serverId}:*`,
      COUNT: 200,
    })) {
      keys.push(String(key));
    }
    if (keys.length > 0) {
      await client.del(keys);
    }
    await client.del(buildMetaKey(serverId));
  } catch (error: any) {
    cacheLogger.warn(`Folder cache clear failed: ${error?.message || 'delete error'}`);
  }
};

const calculateFolderCacheStats = async (serverId: string): Promise<CacheStats | null> => {
  try {
    const client = await getRedisClient();
    let keyCount = 0;
    let sizeBytes = 0;
    for await (const key of client.scanIterator({
      MATCH: `${FOLDER_CACHE_PREFIX}${serverId}:*`,
      COUNT: 200,
    })) {
      keyCount += 1;
      try {
        const length = await client.strLen(String(key));
        if (typeof length === 'number') {
          sizeBytes += length;
        }
      } catch {
        // ignore size errors
      }
    }
    return {
      keyCount,
      sizeBytes,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    cacheLogger.warn(`Folder cache stats failed: ${error?.message || 'read error'}`);
    return null;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (baseDelayMs: number, attempt: number) =>
  baseDelayMs > 0 ? baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)) : 0;

const listRulesWithRetry = async (
  uaClient: UAClient,
  node: string,
  start: number,
  pageLimit: number,
  deep: boolean,
  context: string,
) => {
  const maxAttempts = FOLDER_LIST_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uaClient.listRules('/', pageLimit, node, deep, start);
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      logger.warn(
        `Folder listRules failed (${context}) node=${node} start=${start} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Folder listRules failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(FOLDER_LIST_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Folder listRules failed (${context}) for node=${node} start=${start}`);
};

const readRuleWithRetry = async (
  uaClient: UAClient,
  pathId: string,
  revision: string | undefined,
  context: string,
) => {
  const maxAttempts = FOLDER_READ_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return revision ? await uaClient.readRule(pathId, revision) : await uaClient.readRule(pathId);
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      logger.warn(
        `Folder readRule failed (${context}) path=${pathId} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Folder readRule failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(FOLDER_READ_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Folder readRule failed (${context}) for path=${pathId}`);
};


const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaRaw);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const getUaClientFromSession = async (
  req: Request,
): Promise<{ uaClient: UAClient; serverId: string }> => {
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
  return {
    uaClient: new UAClient({
      hostname: server.hostname,
      port: server.port,
      auth_method: auth.auth_type,
      username: auth.username,
      password: auth.password,
      cert_path: auth.cert_path,
      key_path: auth.key_path,
      ca_cert_path: auth.ca_cert_path,
      insecure_tls: insecureTls,
    }),
    serverId: server.server_id,
  };
};

const requireSession = async (req: Request, res: Response) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  return session;
};

const parseRuleText = (payload: any) => {
  const ruleText =
    payload?.data?.[0]?.RuleText ?? payload?.RuleText ?? payload?.content?.data?.[0]?.RuleText;
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

const extractRuleText = (payload: any) =>
  payload?.data?.[0]?.RuleText ??
  payload?.RuleText ??
  payload?.content?.data?.[0]?.RuleText ??
  payload;

const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return [] as any[];
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    if (Object.keys(parsed).length === 0) {
      return [] as any[];
    }
    return [parsed];
  }
  return [] as any[];
};

const countOverrideEntries = (overrides: any[]) => {
  const entries = overrides.filter((entry) => entry && typeof entry === 'object');
  if (entries.length === 0) {
    return 0;
  }
  const typed = entries.filter(
    (entry) => String(entry?._type || '').toLowerCase() === 'override',
  );
  return typed.length > 0 ? typed.length : entries.length;
};

const normalizeOverrideProtocol = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'trap' || normalized === 'syslog') {
    return normalized;
  }
  return 'fcom';
};

const countOverridesForProtocol = (overrides: any[], protocol: string) => {
  const target = normalizeOverrideProtocol(protocol);
  const entries = overrides.filter((entry) => entry && typeof entry === 'object');
  if (entries.length === 0) {
    return 0;
  }
  const candidates = entries.filter((entry) => {
    const method = String(entry?.method || '').trim();
    if (!method) {
      return target === 'fcom';
    }
    return normalizeOverrideProtocol(method) === target;
  });
  return countOverrideEntries(candidates);
};

const decodeJsonPointerSegment = (segment: string) =>
  segment.replace(/~1/g, '/').replace(/~0/g, '~');

const getJsonPointerEventPath = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  if (!normalized.startsWith('/event')) {
    return null;
  }
  const remainder = normalized.slice('/event'.length);
  if (!remainder) {
    return '$.event';
  }
  const parts = remainder
    .split('/')
    .filter(Boolean)
    .map(decodeJsonPointerSegment);
  if (parts.length === 0) {
    return '$.event';
  }
  return `$.event.${parts.join('.')}`;
};

const getProcessorTargetField = (processor: any) => {
  if (!processor || typeof processor !== 'object') {
    return null;
  }
  const keys = [
    'set',
    'copy',
    'replace',
    'convert',
    'eval',
    'json',
    'lookup',
    'append',
    'sort',
    'split',
    'math',
    'regex',
    'grok',
    'rename',
    'strcase',
    'substr',
    'trim',
  ];
  for (const key of keys) {
    const target = processor?.[key]?.targetField;
    if (target) {
      return target;
    }
  }
  return null;
};

const _collectOverrideTargets = (processors: any[], objectName: string, targetKeys: Set<string>) => {
  (processors || []).forEach((processor: any) => {
    if (!processor || typeof processor !== 'object') {
      return;
    }
    const patchTarget = getJsonPointerEventPath(processor?.path);
    if (patchTarget) {
      targetKeys.add(`${objectName}::${patchTarget}`);
    }
    if (processor.if) {
      const payload = processor.if;
      _collectOverrideTargets(
        Array.isArray(payload.processors) ? payload.processors : [],
        objectName,
        targetKeys,
      );
      _collectOverrideTargets(
        Array.isArray(payload.else) ? payload.else : [],
        objectName,
        targetKeys,
      );
    }
    if (processor.foreach?.processors) {
      _collectOverrideTargets(
        Array.isArray(processor.foreach.processors) ? processor.foreach.processors : [],
        objectName,
        targetKeys,
      );
    }
    if (Array.isArray(processor.switch?.case)) {
      processor.switch.case.forEach((entry: any) => {
        _collectOverrideTargets(
          Array.isArray(entry?.then)
            ? entry.then
            : Array.isArray(entry?.processors)
              ? entry.processors
              : [],
          objectName,
          targetKeys,
        );
      });
    }
    if (Array.isArray(processor.switch?.default)) {
      _collectOverrideTargets(processor.switch.default, objectName, targetKeys);
    }
    const target = getProcessorTargetField(processor);
    if (target && typeof target === 'string' && target.startsWith('$.event.')) {
      targetKeys.add(`${objectName}::${target}`);
    }
  });
};

const _collectEventOverrideTargets = (entry: any, objectName: string, targetKeys: Set<string>) => {
  if (!entry || typeof entry !== 'object') {
    return;
  }
  const eventPayload = entry.event;
  if (!eventPayload || typeof eventPayload !== 'object') {
    return;
  }
  Object.keys(eventPayload).forEach((key) => {
    if (!key) {
      return;
    }
    targetKeys.add(`${objectName}::$.event.${key}`);
  });
};

const getCachedCountsForNode = (
  overviewData: OverviewData | null,
  node: string,
): OverviewCounts | null => {
  if (!overviewData) {
    return null;
  }
  const parts = node.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const protocolMap = new Map(
    overviewData.protocols.map((protocol) => [protocol.name.toLowerCase(), protocol]),
  );
  const protocolIndex = parts.findIndex((segment) => protocolMap.has(segment.toLowerCase()));
  if (protocolIndex === -1) {
    return null;
  }
  const protocolEntry = protocolMap.get(parts[protocolIndex].toLowerCase());
  if (!protocolEntry) {
    return null;
  }
  const vendorSegment = parts[protocolIndex + 1];
  if (!vendorSegment) {
    return protocolEntry.counts;
  }
  const vendorEntry = protocolEntry.vendors.find(
    (vendor) => vendor.name.toLowerCase() === vendorSegment.toLowerCase(),
  );
  return vendorEntry?.counts ?? protocolEntry.counts;
};

const buildFolderOverview = async (
  uaClient: UAClient,
  node: string,
  limit: number,
  cachedCounts?: OverviewCounts | null,
) => {
  let allowedFields = new Set<string>();
  const eventsFields = await getEventsSchemaFields(uaClient);
  allowedFields = new Set(eventsFields.map((f) => f.toLowerCase()));

  const listing = await listRulesWithRetry(uaClient, node, 0, 500, false, 'overview-list');
  const entries = Array.isArray(listing?.data) ? listing.data : [];
  const files = entries.filter((item: any) =>
    String(item.PathName || '')
      .toLowerCase()
      .endsWith('.json'),
  );

  let fileCount = files.length;
  let objectCount = 0;
  let schemaErrorCount = 0;
  let unknownFieldCount = 0;
  const overrideCount = cachedCounts ? 0 : await getOverrideCountForNode(uaClient, node);

  const rows: Array<{
    file: string;
    pathId: string;
    schemaErrors: number;
    unknownFields: number;
    objects: number;
  }> = [];

  const processFile = async (entry: any) => {
    const fileId = entry.PathID;
    const response = await readRuleWithRetry(uaClient, fileId, undefined, 'overview-read');
    const content = parseRuleText(response);
    if (!content) {
      logger.warn(`Folder overview empty content; treating as empty ${fileId}`);
      return {
        row: {
          file: entry.PathName || fileId,
          pathId: fileId,
          schemaErrors: 1,
          unknownFields: 0,
          objects: 0,
        },
        objectCount: 0,
        schemaErrors: 1,
        unknownFields: 0,
      };
    }
    const objects = Array.isArray(content?.objects)
      ? content.objects
      : Array.isArray(content)
        ? content
        : [];
    const valid = validate(content);
    const errors = valid ? 0 : (validate.errors || []).length;

    let unknowns = 0;
    for (const obj of objects) {
      const event = getEventFields(obj);
      for (const key of Object.keys(event)) {
        if (!allowedFields.has(key.toLowerCase())) {
          unknowns += 1;
        }
      }
    }

    return {
      row: {
        file: entry.PathName || fileId,
        pathId: fileId,
        schemaErrors: errors,
        unknownFields: unknowns,
        objects: objects.length,
      },
      objectCount: objects.length,
      schemaErrors: errors,
      unknownFields: unknowns,
    };
  };

  const runFilePool = async (entries: any[], concurrency: number) => {
    const results: Array<Awaited<ReturnType<typeof processFile>> | null> = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
      while (cursor < entries.length) {
        const idx = cursor;
        cursor += 1;
        const result = await processFile(entries[idx]);
        results[idx] = result;
      }
    });
    await Promise.all(workers);
    return results.filter(Boolean) as Array<NonNullable<Awaited<ReturnType<typeof processFile>>>>;
  };

  const useConcurrency = files.length > 5;
  const processed = useConcurrency
    ? await runFilePool(files, FOLDER_OVERVIEW_FILE_CONCURRENCY)
    : await runFilePool(files, 1);

  for (const result of processed) {
    objectCount += result.objectCount;
    schemaErrorCount += result.schemaErrors;
    unknownFieldCount += result.unknownFields;
    rows.push(result.row);
  }

  const ranked = rows
    .sort((a, b) => b.schemaErrors + b.unknownFields - (a.schemaErrors + a.unknownFields))
    .slice(0, limit);

  return {
    node,
    fileCount: cachedCounts?.files ?? fileCount,
    objectCount: cachedCounts?.objects ?? objectCount,
    schemaErrorCount,
    unknownFieldCount,
    overrideCount: cachedCounts?.overrides ?? overrideCount,
    topFiles: ranked,
    cachedAt: new Date().toISOString(),
  };
};

const resolveOverrideRootFromNode = (node: string) => {
  const normalized = node.replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    return null;
  }
  const objectsIndex = parts.indexOf('_objects', fcomIndex + 1);
  const methodIndex = objectsIndex !== -1 ? objectsIndex + 1 : fcomIndex + 1;
  const protocol = parts[methodIndex] || null;
  const vendor = parts[methodIndex + 1];

  if (!protocol || !vendor) {
    return null;
  }

  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  return {
    root: `${basePath}/overrides`,
    protocol,
    vendor,
  };
};

const getOverrideCountForNode = async (uaClient: UAClient, node: string) => {
  const resolved = resolveOverrideRootFromNode(node);
  if (!resolved) {
    return 0;
  }
  const { root, vendor, protocol } = resolved;
  const listing = await listDirectory(uaClient, root);
  const vendorKey = String(vendor || '').toLowerCase();
  const overrideFiles = listing.filter((entry: any) => {
    const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
    if (!name.endsWith('.override.json')) {
      return false;
    }
    const base = name.split('/').pop() || name;
    const stem = base.replace(/\.override\.json$/i, '');
    const parts = stem.split('.').filter(Boolean);
    return parts.length > 0 && parts[0] === vendorKey;
  });
  let count = 0;
  for (const entry of overrideFiles) {
    const pathId = String(entry?.PathID || entry?.PathName || '');
    if (!pathId) {
      continue;
    }
    const response = await readRuleWithRetry(uaClient, pathId, 'HEAD', 'override-read');
    const raw = extractRuleText(response);
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
    const overrides = parseOverridePayload(text);
    count += countOverridesForProtocol(overrides, protocol);
  }
  return count;
};

const isFolderEntry = (entry: any) => {
  const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
  return !name.endsWith('.json');
};

const listDirectory = async (uaClient: UAClient, node: string) => {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const response = await listRulesWithRetry(
      uaClient,
      node,
      start,
      FOLDER_OVERVIEW_PAGE_LIMIT,
      true,
      'rebuild-list',
    );
    const data = Array.isArray(response?.data) ? response.data : [];
    if (data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < FOLDER_OVERVIEW_PAGE_LIMIT) {
      break;
    }
    start += data.length;
  }
  return all;
};

const rebuildAllFolderOverviews = async (
  uaClient: UAClient,
  serverId: string,
  limit: number,
  overviewData: OverviewData | null,
) => {
  if (!PATH_PREFIX) {
    throw new Error('COMS_PATH_PREFIX is not configured');
  }
  const protocolEntries = await listDirectory(uaClient, PATH_PREFIX);
  const protocolFolders = protocolEntries.filter((entry) => isFolderEntry(entry));
  const vendorNodes: string[] = [];

  for (const protocolEntry of protocolFolders) {
    const protocolName =
      String(protocolEntry?.PathName || protocolEntry?.PathID || '')
        .split('/')
        .pop() || '';
    if (!protocolName || protocolName.toLowerCase() === 'overrides') {
      continue;
    }
    const protocolNode = String(protocolEntry?.PathID || `${PATH_PREFIX}/${protocolName}`);
    const protocolListing = await listDirectory(uaClient, protocolNode);
    for (const entry of protocolListing) {
      const entryName = String(entry?.PathName || entry?.PathID || '');
      if (entryName.toLowerCase() === 'overrides') {
        continue;
      }
      if (isFolderEntry(entry)) {
        const vendorName = entryName;
        const vendorNode = String(entry?.PathID || `${protocolNode}/${vendorName}`);
        vendorNodes.push(vendorNode);
      }
    }
  }

  const buildState = getBuildState(serverId);
  buildState.progress.phase = 'Rebuilding folders';
  buildState.progress.processed = 0;
  buildState.progress.total = vendorNodes.length;
  buildState.progress.unit = 'folders';

  const runPool = async (nodes: string[], concurrency: number) => {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, nodes.length) }, async () => {
      while (cursor < nodes.length) {
        const idx = cursor;
        cursor += 1;
        const vendorNode = nodes[idx];
        try {
          const cachedCounts = getCachedCountsForNode(overviewData, vendorNode);
          const data = await buildFolderOverview(uaClient, vendorNode, limit, cachedCounts);
          await persistFolderCache(serverId, vendorNode, limit, data);
        } finally {
          buildState.progress.processed += 1;
        }
      }
    });
    await Promise.all(workers);
  };

  await runPool(vendorNodes, FOLDER_OVERVIEW_CONCURRENCY);
};

export const refreshFolderOverviewForNode = async (
  uaClient: UAClient,
  serverId: string,
  node: string,
  limit: number = 25,
) => {
  await overviewIndex().ensureHydrated(serverId);
  const cachedCounts = getCachedCountsForNode(overviewIndex().getData(serverId), node);
  const data = await buildFolderOverview(uaClient, node, limit, cachedCounts);
  await persistFolderCache(serverId, node, limit, data);
  return data;
};

export const rebuildAllFolderOverviewCaches = async (
  uaClient: UAClient,
  serverId: string,
  limit: number = 25,
  trigger: 'startup' | 'manual' | 'auto' = 'manual',
) => {
  const buildState = getBuildState(serverId);
  buildState.isBuilding = true;
  buildState.buildId = (buildState.buildId ?? 0) + 1;
  buildState.progress = {
    phase: 'Starting',
    processed: 0,
    total: 0,
    unit: 'folders',
  };
  logger.info(`Folder cache rebuild started (${trigger}) server=${serverId}`);
  const start = Date.now();
  let failed = false;
  try {
    await overviewIndex().ensureHydrated(serverId);
    await rebuildAllFolderOverviews(
      uaClient,
      serverId,
      limit,
      overviewIndex().getData(serverId),
    );
    const cacheStats = await calculateFolderCacheStats(serverId);
    await persistFolderMeta(serverId, Date.now(), cacheStats);
    const durationMs = Date.now() - start;
    logger.info(
      `Folder cache COMPLETE (${trigger}) server=${serverId} took ${durationMs}ms`,
    );
  } catch (error: any) {
    failed = true;
    const durationMs = Date.now() - start;
    logger.error(
      `Folder cache rebuild failed (${trigger}) server=${serverId} after ${durationMs}ms: ${
        error?.message || 'error'
      }`,
    );
    throw error;
  } finally {
    buildState.progress.phase = failed ? 'Failed' : 'Completed';
    buildState.isBuilding = false;
  }
};

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { node, limit = '25' } = req.query as { node?: string; limit?: string };
    if (!node) {
      return res.status(400).json({ error: 'Missing node' });
    }
    const parsedLimit = Number(limit) || 25;
    const { uaClient, serverId } = await getUaClientFromSession(req);
    const cached = await loadFolderCache(serverId, node, parsedLimit);
    if (cached?.data) {
      const isStale =
        typeof cached.expiresAtMs === 'number' && Date.now() > cached.expiresAtMs;
      if (isStale) {
        logger.info(
          `Folder cache stale; serving cached data and scheduling refresh server=${serverId} node=${node}`,
        );
        void refreshFolderOverviewForNode(uaClient, serverId, node, parsedLimit).catch(
          (error) => {
            logger.warn(
              `Folder overview refresh failed for ${node}: ${error?.message || 'error'}`,
            );
          },
        );
      }
      return res.json(cached.data);
    }

    await overviewIndex().ensureHydrated(serverId);
    const cachedCounts = getCachedCountsForNode(overviewIndex().getData(serverId), node);
    const data = await buildFolderOverview(uaClient, node, parsedLimit, cachedCounts);
    await persistFolderCache(serverId, node, parsedLimit, data);
    res.json(data);
  } catch (error: any) {
    logger.error(`Folder overview error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to build folder overview' });
  }
});

router.get('/overview/status', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }
  const serverId = session.server_id;
  const buildState = getBuildState(serverId);
  const client = await getRedisClient();
  let lastBuiltAtMs: number | null = null;
  let expiresAtMs: number | null = null;
  let cacheStats: CacheStats | null = null;
  try {
    const metaRaw = await client.get(buildMetaKey(serverId));
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (typeof meta?.lastBuiltAtMs === 'number') {
        lastBuiltAtMs = meta.lastBuiltAtMs;
      }
      if (typeof meta?.expiresAtMs === 'number') {
        expiresAtMs = meta.expiresAtMs;
      }
      if (meta?.cacheStats && typeof meta.cacheStats === 'object') {
        cacheStats = meta.cacheStats as CacheStats;
      }
    }
  } catch {
    lastBuiltAtMs = null;
    expiresAtMs = null;
    cacheStats = null;
  }
  if (!cacheStats && lastBuiltAtMs) {
    cacheStats = await calculateFolderCacheStats(serverId);
    if (cacheStats) {
      await persistFolderMeta(serverId, lastBuiltAtMs, cacheStats);
    }
  }
  const entryCount = cacheStats?.keyCount ?? 0;
  const isStale =
    (!!lastBuiltAtMs && !expiresAtMs) ||
    (typeof expiresAtMs === 'number' && Date.now() > expiresAtMs);
  if ((!lastBuiltAtMs || isStale) && !buildState.isBuilding) {
    try {
      const { uaClient, serverId: resolvedServerId } = await getUaClientFromSession(req);
      await overviewIndex().ensureHydrated(resolvedServerId);
      if (isStale && lastBuiltAtMs) {
        logger.info(
          `Folder cache stale; serving cached data and scheduling refresh server=${resolvedServerId}`,
        );
      }
      void rebuildAllFolderOverviewCaches(uaClient, resolvedServerId, 25, 'auto');
    } catch (error: any) {
      logger.warn(
        `Folder cache auto rebuild skipped: ${error?.message || 'session error'}`,
      );
    }
  }
  res.json({
    isReady: !!lastBuiltAtMs,
    isBuilding: buildState.isBuilding,
    isStale,
    buildId: buildState.buildId,
    progress: buildState.progress,
    entryCount,
    cacheStats,
    ttlMs: CACHE_TTL_MS,
    lastBuiltAt: lastBuiltAtMs ? new Date(lastBuiltAtMs).toISOString() : null,
    nextRefreshAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    lastClearedAt: null,
  });
});

router.post('/overview/rebuild', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }
  const serverId = session.server_id;
  const buildState = getBuildState(serverId);
  buildState.isBuilding = true;
  buildState.progress = {
    phase: 'Starting',
    processed: 0,
    total: 0,
    unit: 'folders',
  };
  try {
    const { node, limit = 25 } = req.body as { node?: string; limit?: number };
    const parsedLimit = Number(limit) || 25;
    if (!node) {
      const { uaClient, serverId: resolvedServerId } = await getUaClientFromSession(req);
      await overviewIndex().ensureHydrated(resolvedServerId);
      await rebuildAllFolderOverviewCaches(uaClient, resolvedServerId, parsedLimit, 'manual');
      res.json({ status: 'rebuilt' });
      return;
    }
    const { uaClient, serverId: resolvedServerId } = await getUaClientFromSession(req);
    buildState.progress.phase = 'Rebuilding folder';
    buildState.progress.processed = 0;
    buildState.progress.total = 1;
    buildState.progress.unit = 'folders';
    await overviewIndex().ensureHydrated(resolvedServerId);
    const cachedCounts = getCachedCountsForNode(overviewIndex().getData(resolvedServerId), node);
    const data = await buildFolderOverview(uaClient, node, parsedLimit, cachedCounts);
    await persistFolderCache(resolvedServerId, node, parsedLimit, data);
    buildState.progress.processed = 1;
    res.json(data);
  } catch (error: any) {
    logger.error(`Folder overview rebuild error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to rebuild folder overview' });
  } finally {
    buildState.progress.phase = 'Completed';
    buildState.isBuilding = false;
  }
});

export default router;
