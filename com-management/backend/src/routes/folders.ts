import { Router, Request, Response } from 'express';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { overviewIndex, OverviewCounts, OverviewData } from '../services/overviewIndex';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { getEventsSchemaFields } from '../services/eventsSchemaCache';

const router = Router();
const CACHE_TTL_MS = Number(process.env.FOLDER_OVERVIEW_TTL_MS || 10 * 60 * 1000);
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
const CACHE_DIR = process.env.COM_CACHE_DIR || path.resolve(process.cwd(), 'cache');
const FOLDER_CACHE_FILE = path.join(CACHE_DIR, 'folder_overview_cache.json');
const overviewCache = new Map<string, { data: any; fetchedAt: number }>();
let lastClearedAtMs: number | null = null;
let isBuilding = false;
let buildProgress = {
  phase: null as string | null,
  processed: 0,
  total: 0,
  unit: 'folders',
};

const ensureCacheDir = () => {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
};

const loadFolderCacheFromDisk = () => {
  try {
    if (!fs.existsSync(FOLDER_CACHE_FILE)) {
      return;
    }
    const raw = fs.readFileSync(FOLDER_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.entries)) {
      for (const entry of parsed.entries) {
        if (Array.isArray(entry) && entry.length === 2) {
          const [key, value] = entry;
          if (value?.data && typeof value?.fetchedAt === 'number') {
            overviewCache.set(key, value);
          }
        }
      }
    }
    if (typeof parsed?.lastClearedAtMs === 'number') {
      lastClearedAtMs = parsed.lastClearedAtMs;
    }
  } catch {
    // ignore
  }
};

const persistFolderCacheToDisk = () => {
  try {
    ensureCacheDir();
    const payload = {
      entries: Array.from(overviewCache.entries()),
      lastClearedAtMs,
    };
    fs.writeFileSync(FOLDER_CACHE_FILE, JSON.stringify(payload));
  } catch (error: any) {
    logger.warn(`Folder cache persist failed: ${error?.message || 'write error'}`);
  }
};

loadFolderCacheFromDisk();

const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaRaw);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const getUaClientFromSession = (req: Request): { uaClient: UAClient; serverId: string } => {
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

const requireSession = (req: Request, res: Response) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId || !getSession(sessionId)) {
    res.status(401).json({ error: 'No active session' });
    return null;
  }
  return sessionId;
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
    return [parsed];
  }
  return [] as any[];
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

const collectOverrideTargets = (processors: any[], objectName: string, targetKeys: Set<string>) => {
  (processors || []).forEach((processor: any) => {
    if (!processor || typeof processor !== 'object') {
      return;
    }
    if (processor.if) {
      const payload = processor.if;
      collectOverrideTargets(
        Array.isArray(payload.processors) ? payload.processors : [],
        objectName,
        targetKeys,
      );
      collectOverrideTargets(
        Array.isArray(payload.else) ? payload.else : [],
        objectName,
        targetKeys,
      );
    }
    if (processor.foreach?.processors) {
      collectOverrideTargets(
        Array.isArray(processor.foreach.processors) ? processor.foreach.processors : [],
        objectName,
        targetKeys,
      );
    }
    if (Array.isArray(processor.switch?.case)) {
      processor.switch.case.forEach((entry: any) => {
        collectOverrideTargets(
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
      collectOverrideTargets(processor.switch.default, objectName, targetKeys);
    }
    const target = getProcessorTargetField(processor);
    if (target && typeof target === 'string' && target.startsWith('$.event.')) {
      targetKeys.add(`${objectName}::${target}`);
    }
  });
};

const collectEventOverrideTargets = (entry: any, objectName: string, targetKeys: Set<string>) => {
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
  try {
    const eventsFields = await getEventsSchemaFields(uaClient);
    allowedFields = new Set(eventsFields.map((f) => f.toLowerCase()));
  } catch (error: any) {
    logger.warn(`Folder overview schema lookup failed: ${error?.message || 'unknown error'}`);
    allowedFields = new Set<string>();
  }

  let entries: any[] = [];
  try {
    const listing = await uaClient.listRules('/', 500, node);
    entries = Array.isArray(listing?.data) ? listing.data : [];
  } catch (error: any) {
    logger.error(`Folder overview list error for ${node}: ${error?.message || 'list error'}`);
    return {
      node,
      fileCount: cachedCounts?.files ?? 0,
      objectCount: cachedCounts?.objects ?? 0,
      schemaErrorCount: 0,
      unknownFieldCount: 0,
      overrideCount: cachedCounts?.overrides ?? (await getOverrideCountForNode(uaClient, node)),
      topFiles: [],
      cachedAt: new Date().toISOString(),
    };
  }
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
    try {
      const response = await uaClient.readRule(fileId);
      const content = parseRuleText(response);
      if (!content) {
        return null;
      }
      const objects = Array.isArray(content?.objects)
        ? content.objects
        : Array.isArray(content)
          ? content
          : [];
      const valid = validate(content);
      const errors = valid ? 0 : (validate.errors || []).length;

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
    } catch (error: any) {
      logger.warn(`Folder overview skipped ${fileId}: ${error?.message || 'read error'}`);
      return null;
    }
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

const resolveOverridePathFromNode = (node: string) => {
  const normalized = node.replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    return null;
  }
  const objectsIndex = parts.indexOf('_objects', fcomIndex + 1);
  const methodBaseIndex = objectsIndex !== -1 ? objectsIndex : fcomIndex;
  const methodIndex = parts.findIndex(
    (segment, idx) => idx > methodBaseIndex && (segment === 'trap' || segment === 'syslog'),
  );
  const protocol = methodIndex !== -1 ? parts[methodIndex] : null;
  const vendor = methodIndex !== -1 ? parts[methodIndex + 1] : parts[methodBaseIndex + 1];

  if (!vendor) {
    return null;
  }

  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  if (protocol) {
    return `${basePath}/overrides/${protocol}/${vendor}.override.json`;
  }
  return `${basePath}/overrides/${vendor}.override.json`;
};

const getOverrideCountForNode = async (uaClient: UAClient, node: string) => {
  const overridePath = resolveOverridePathFromNode(node);
  if (!overridePath) {
    return 0;
  }
  try {
    const response = await uaClient.readRule(overridePath, 'HEAD');
    const raw = extractRuleText(response);
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
    const overrides = parseOverridePayload(text);
    const targetKeys = new Set<string>();
    overrides.forEach((entry: any) => {
      const objectName = entry?.['@objectName'] || '__global__';
      const processors = Array.isArray(entry?.processors) ? entry.processors : [];
      collectOverrideTargets(processors, objectName, targetKeys);
      collectEventOverrideTargets(entry, objectName, targetKeys);
    });
    return targetKeys.size;
  } catch {
    return 0;
  }
};

const isFolderEntry = (entry: any) => {
  const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
  return !name.endsWith('.json');
};

const listDirectory = async (uaClient: UAClient, node: string) => {
  const all: any[] = [];
  let start = 0;
  try {
    while (true) {
      const response = await uaClient.listRules('/', FOLDER_OVERVIEW_PAGE_LIMIT, node, true, start);
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
  } catch (error: any) {
    logger.warn(`Folder overview list failed for ${node}: ${error?.message || 'list error'}`);
  }
  return all;
};

const rebuildAllFolderOverviews = async (
  uaClient: UAClient,
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
    let protocolListing: any[] = [];
    try {
      protocolListing = await listDirectory(uaClient, protocolNode);
    } catch (error: any) {
      logger.warn(
        `Folder overview protocol scan failed for ${protocolNode}: ${error?.message || 'list error'}`,
      );
      continue;
    }
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

  buildProgress.phase = 'Rebuilding folders';
  buildProgress.processed = 0;
  buildProgress.total = vendorNodes.length;
  buildProgress.unit = 'folders';

  const nextCache = new Map<string, { data: any; fetchedAt: number }>();

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
          const cacheKey = `${vendorNode}:${limit}`;
          nextCache.set(cacheKey, { data, fetchedAt: Date.now() });
        } catch (error: any) {
          logger.warn(
            `Folder overview build failed for ${vendorNode}: ${error?.message || 'build error'}`,
          );
        } finally {
          buildProgress.processed += 1;
        }
      }
    });
    await Promise.all(workers);
  };

  await runPool(vendorNodes, FOLDER_OVERVIEW_CONCURRENCY);

  if (nextCache.size > 0) {
    overviewCache.clear();
    for (const [key, value] of nextCache.entries()) {
      overviewCache.set(key, value);
    }
  }
};

export const refreshFolderOverviewForNode = async (
  uaClient: UAClient,
  serverId: string,
  node: string,
  limit: number = 25,
) => {
  const cachedCounts = getCachedCountsForNode(overviewIndex().getData(serverId), node);
  const data = await buildFolderOverview(uaClient, node, limit, cachedCounts);
  overviewCache.set(`${node}:${limit}`, { data, fetchedAt: Date.now() });
  persistFolderCacheToDisk();
  return data;
};

export const rebuildAllFolderOverviewCaches = async (
  uaClient: UAClient,
  serverId: string,
  limit: number = 25,
) => {
  isBuilding = true;
  buildProgress = {
    phase: 'Starting',
    processed: 0,
    total: 0,
    unit: 'folders',
  };
  try {
    await rebuildAllFolderOverviews(uaClient, limit, overviewIndex().getData(serverId));
    persistFolderCacheToDisk();
  } finally {
    buildProgress.phase = 'Completed';
    isBuilding = false;
  }
};

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { node, limit = '25' } = req.query as { node?: string; limit?: string };
    if (!node) {
      return res.status(400).json({ error: 'Missing node' });
    }
    const parsedLimit = Number(limit) || 25;
    const cacheKey = `${node}:${parsedLimit}`;
    const cached = overviewCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const { uaClient, serverId } = getUaClientFromSession(req);
    const cachedCounts = getCachedCountsForNode(overviewIndex().getData(serverId), node);
    const data = await buildFolderOverview(uaClient, node, parsedLimit, cachedCounts);
    overviewCache.set(cacheKey, { data, fetchedAt: Date.now() });
    res.json(data);
  } catch (error: any) {
    logger.error(`Folder overview error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to build folder overview' });
  }
});

router.get('/overview/status', (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  const entries = Array.from(overviewCache.values());
  const lastBuiltAtMs =
    entries.length > 0 ? Math.max(...entries.map((entry) => entry.fetchedAt)) : null;
  res.json({
    isReady: entries.length > 0,
    isBuilding,
    progress: buildProgress,
    entryCount: entries.length,
    ttlMs: CACHE_TTL_MS,
    lastBuiltAt: lastBuiltAtMs ? new Date(lastBuiltAtMs).toISOString() : null,
    lastClearedAt: lastClearedAtMs ? new Date(lastClearedAtMs).toISOString() : null,
  });
});

router.post('/overview/rebuild', async (req: Request, res: Response) => {
  if (!requireSession(req, res)) {
    return;
  }
  isBuilding = true;
  buildProgress = {
    phase: 'Starting',
    processed: 0,
    total: 0,
    unit: 'folders',
  };
  try {
    const { node, limit = 25 } = req.body as { node?: string; limit?: number };
    const parsedLimit = Number(limit) || 25;
    if (!node) {
      const { uaClient, serverId } = getUaClientFromSession(req);
      await rebuildAllFolderOverviews(uaClient, parsedLimit, overviewIndex().getData(serverId));
      persistFolderCacheToDisk();
      res.json({ status: 'rebuilt', count: overviewCache.size });
      return;
    }
    const cacheKey = `${node}:${parsedLimit}`;
    const { uaClient, serverId } = getUaClientFromSession(req);
    buildProgress.phase = 'Rebuilding folder';
    buildProgress.processed = 0;
    buildProgress.total = 1;
    buildProgress.unit = 'folders';
    const cachedCounts = getCachedCountsForNode(overviewIndex().getData(serverId), node);
    const data = await buildFolderOverview(uaClient, node, parsedLimit, cachedCounts);
    overviewCache.set(cacheKey, { data, fetchedAt: Date.now() });
    buildProgress.processed = 1;
    persistFolderCacheToDisk();
    res.json(data);
  } catch (error: any) {
    logger.error(`Folder overview rebuild error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to rebuild folder overview' });
  } finally {
    buildProgress.phase = 'Completed';
    isBuilding = false;
  }
});

export default router;
