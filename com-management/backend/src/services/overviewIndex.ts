import path from 'path';
import cacheLogger from '../utils/cacheLogger';
import { UAClient } from './ua';
import { getRedisClient } from './redisClient';

const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const OVERVIEW_PAGE_LIMIT = Number(process.env.OVERVIEW_PAGE_LIMIT || 500);
const OVERRIDE_SUFFIX = '.override.json';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const OVERVIEW_LIST_RETRIES = Math.max(0, Number(process.env.OVERVIEW_LIST_RETRIES || 3));
const OVERVIEW_LIST_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.OVERVIEW_LIST_RETRY_DELAY_MS || 500),
);
const OVERVIEW_READ_RETRIES = Math.max(0, Number(process.env.OVERVIEW_READ_RETRIES || 3));
const OVERVIEW_READ_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.OVERVIEW_READ_RETRY_DELAY_MS || 500),
);
const OVERVIEW_REFRESH_INTERVAL_MS = Number(
  process.env.OVERVIEW_REFRESH_INTERVAL_MS || DEFAULT_CACHE_TTL_MS,
);
const OVERVIEW_CONCURRENCY = Math.max(1, Number(process.env.OVERVIEW_CONCURRENCY || 20));
const OVERVIEW_OVERRIDE_CONCURRENCY = Math.max(
  1,
  Number(process.env.OVERVIEW_OVERRIDE_CONCURRENCY || 4),
);
const OVERVIEW_OVERRIDE_TIMEOUT_MS = Math.max(
  0,
  Number(process.env.OVERVIEW_OVERRIDE_TIMEOUT_MS || 15000),
);
const CACHE_TTL_MS = Number(
  process.env.CACHE_TTL_MS || process.env.OVERVIEW_CACHE_TTL_MS || OVERVIEW_REFRESH_INTERVAL_MS,
);
const OVERVIEW_CACHE_PREFIX = 'fcom:overview:index:';

type OverviewCounts = {
  files: number;
  overrides: number;
  objects: number;
  variables: number;
  evalObjects: number;
  processorObjects: number;
  literalObjects: number;
};

type VendorEntry = {
  name: string;
  counts: OverviewCounts;
};

type ProtocolEntry = {
  name: string;
  counts: OverviewCounts;
  vendors: VendorEntry[];
};

type OverviewData = {
  totals: OverviewCounts;
  protocols: ProtocolEntry[];
};

type OverviewStatus = {
  rootPath: string;
  isReady: boolean;
  isBuilding: boolean;
  isStale: boolean;
  buildId: number | null;
  lastBuiltAt: string | null;
  lastDurationMs: number | null;
  nextRefreshAt: string | null;
  lastError: string | null;
  progress: {
    phase: string | null;
    processed: number;
    total: number;
    unit: string;
  };
  counts: {
    protocols: number;
    vendors: number;
    files: number;
    objects: number;
  };
  cacheStats: CacheStats | null;
};

type CacheStats = {
  keyCount: number;
  sizeBytes: number;
  updatedAt: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (baseDelayMs: number, attempt: number) =>
  baseDelayMs > 0 ? baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)) : 0;

const listRulesWithRetry = async (
  uaClient: UAClient,
  node: string,
  start: number,
  context: string,
) => {
  const maxAttempts = OVERVIEW_LIST_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uaClient.listRules('/', OVERVIEW_PAGE_LIMIT, node, true, start);
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      cacheLogger.warn(
        `Overview listRules failed (${context}) node=${node} start=${start} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Overview listRules failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(OVERVIEW_LIST_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Overview listRules failed (${context}) for node=${node} start=${start}`);
};

const readRuleWithRetry = async (
  uaClient: UAClient,
  pathId: string,
  context: string,
  options?: { timeoutMs?: number; revision?: string },
) => {
  const maxAttempts = OVERVIEW_READ_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const request = options?.revision
        ? uaClient.readRule(pathId, options.revision)
        : uaClient.readRule(pathId);
      if (options?.timeoutMs && options.timeoutMs > 0) {
        return await Promise.race([
          request,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Overview read timeout')), options.timeoutMs);
          }),
        ]);
      }
      return await request;
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      cacheLogger.warn(
        `Overview readRule failed (${context}) path=${pathId} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Overview readRule failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(OVERVIEW_READ_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Overview readRule failed (${context}) for path=${pathId}`);
};

type OverviewState = {
  data: OverviewData | null;
  isBuilding: boolean;
  lastBuiltAt: string | null;
  lastDurationMs: number | null;
  expiresAtMs: number | null;
  lastError: string | null;
  buildId: number | null;
  cacheStats: CacheStats | null;
  progress: {
    phase: string | null;
    processed: number;
    total: number;
    unit: string;
  };
};

type OverviewCachePayload = {
  data: OverviewData;
  lastBuiltAt: string | null;
  lastDurationMs: number | null;
  expiresAtMs: number | null;
  buildId: number | null;
  cacheStats?: CacheStats | null;
};

const createEmptyCounts = (): OverviewCounts => ({
  files: 0,
  overrides: 0,
  objects: 0,
  variables: 0,
  evalObjects: 0,
  processorObjects: 0,
  literalObjects: 0,
});

const addCounts = (target: OverviewCounts, delta: OverviewCounts) => {
  target.files += delta.files;
  target.overrides += delta.overrides;
  target.objects += delta.objects;
  target.variables += delta.variables;
  target.evalObjects += delta.evalObjects;
  target.processorObjects += delta.processorObjects;
  target.literalObjects += delta.literalObjects;
};

const subtractCounts = (target: OverviewCounts, delta: OverviewCounts) => {
  target.files -= delta.files;
  target.overrides -= delta.overrides;
  target.objects -= delta.objects;
  target.variables -= delta.variables;
  target.evalObjects -= delta.evalObjects;
  target.processorObjects -= delta.processorObjects;
  target.literalObjects -= delta.literalObjects;
};

const classifyObject = (obj: any) => {
  const hasPreProcessors = Array.isArray(obj?.preProcessors) && obj.preProcessors.length > 0;
  const hasPostProcessors = Array.isArray(obj?.postProcessors) && obj.postProcessors.length > 0;
  const hasProcessorsArray = Array.isArray(obj?.processors) && obj.processors.length > 0;
  const hasProcessorArray = Array.isArray(obj?.processor) && obj.processor.length > 0;
  const hasProcessors =
    hasPreProcessors || hasPostProcessors || hasProcessorsArray || hasProcessorArray;

  const eventFields = obj?.event && typeof obj.event === 'object' ? Object.values(obj.event) : [];
  const hasEval = eventFields.some(
    (value: any) => value && typeof value === 'object' && typeof value.eval === 'string',
  );

  if (hasProcessors) {
    return 'processor';
  }
  if (hasEval) {
    return 'eval';
  }
  return 'literal';
};

const extractRuleText = (data: any) =>
  data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;

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
  return entries.filter((entry) => {
    const method = String(entry?.method || '').trim();
    if (!method) {
      return target === 'fcom';
    }
    return normalizeOverrideProtocol(method) === target;
  }).length;
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

const collectOverrideTargets = (
  processors: any[],
  objectName: string,
  targetKeys: Set<string>,
) => {
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

class OverviewIndexService {
  private states = new Map<string, OverviewState>();
  private hydratePromises = new Map<string, Promise<void>>();

  async ensureHydrated(serverId: string) {
    if (this.hydratePromises.has(serverId)) {
      await this.hydratePromises.get(serverId);
      return;
    }
    const promise = this.loadFromCache(serverId);
    this.hydratePromises.set(serverId, promise);
    await promise;
  }

  private getState(serverId: string): OverviewState {
    if (!this.states.has(serverId)) {
      this.states.set(serverId, {
        data: null,
        isBuilding: false,
        lastBuiltAt: null,
        lastDurationMs: null,
        expiresAtMs: null,
        lastError: null,
        buildId: null,
        cacheStats: null,
        progress: {
          phase: null,
          processed: 0,
          total: 0,
          unit: 'items',
        },
      });
    }
    return this.states.get(serverId)!;
  }

  private async loadFromCache(serverId: string) {
    if (!serverId) {
      return;
    }
    try {
      const client = await getRedisClient();
      const raw = await client.get(`${OVERVIEW_CACHE_PREFIX}${serverId}`);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed?.data) {
        return;
      }
      const payload = parsed as OverviewCachePayload;
      const state = this.getState(serverId);
      state.data = payload.data as OverviewData;
      state.lastBuiltAt = payload.lastBuiltAt ?? null;
      state.lastDurationMs = payload.lastDurationMs ?? null;
      state.expiresAtMs = typeof payload.expiresAtMs === 'number' ? payload.expiresAtMs : null;
      state.buildId = payload.buildId ?? null;
      state.cacheStats = payload.cacheStats ?? null;
      state.isBuilding = false;
      state.lastError = null;
      state.progress = {
        phase: 'Loaded',
        processed: 0,
        total: 0,
        unit: 'items',
      };
    } catch (error: any) {
      cacheLogger.warn(`Overview cache load failed: ${error?.message || 'read error'}`);
    }
  }

  private async persistToCache(serverId: string) {
    const state = this.getState(serverId);
    if (!state.data) {
      return;
    }
    try {
      const client = await getRedisClient();
      const sizeBytes = Buffer.byteLength(JSON.stringify(state.data), 'utf-8');
      state.cacheStats = {
        keyCount: 1,
        sizeBytes,
        updatedAt: new Date().toISOString(),
      };
      const payload: OverviewCachePayload = {
        data: state.data,
        lastBuiltAt: state.lastBuiltAt,
        lastDurationMs: state.lastDurationMs,
        expiresAtMs: state.expiresAtMs,
        buildId: state.buildId,
        cacheStats: state.cacheStats,
      };
      await client.set(`${OVERVIEW_CACHE_PREFIX}${serverId}`, JSON.stringify(payload));
    } catch (error: any) {
      cacheLogger.warn(`Overview cache persist failed: ${error?.message || 'write error'}`);
    }
  }

  getStatus(serverId: string): OverviewStatus {
    const state = this.getState(serverId);
    const isStale = this.isStale(serverId);
    if (!state.cacheStats && state.data) {
      state.cacheStats = {
        keyCount: 1,
        sizeBytes: Buffer.byteLength(JSON.stringify(state.data), 'utf-8'),
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      rootPath: PATH_PREFIX,
      isReady: !!state.data,
      isBuilding: state.isBuilding,
      isStale,
      buildId: state.buildId,
      lastBuiltAt: state.lastBuiltAt,
      lastDurationMs: state.lastDurationMs,
      nextRefreshAt: state.expiresAtMs ? new Date(state.expiresAtMs).toISOString() : null,
      lastError: state.lastError,
      progress: state.progress,
      counts: {
        protocols: state.data?.protocols.length || 0,
        vendors:
          state.data?.protocols.reduce((sum, protocol) => sum + protocol.vendors.length, 0) || 0,
        files: state.data?.totals.files || 0,
        objects: state.data?.totals.objects || 0,
      },
      cacheStats: state.cacheStats,
    };
  }

  isStale(serverId: string) {
    const state = this.getState(serverId);
    if (!state.data) {
      return false;
    }
    if (!state.expiresAtMs) {
      return true;
    }
    return Date.now() > state.expiresAtMs;
  }

  getData(serverId: string): OverviewData | null {
    return this.getState(serverId).data;
  }

  async rebuildIndex(
    serverId: string,
    uaClient: UAClient,
    trigger: 'startup' | 'manual' | 'auto' = 'manual',
  ) {
    await this.ensureHydrated(serverId);
    const state = this.getState(serverId);
    if (state.isBuilding) {
      return;
    }
    state.isBuilding = true;
    state.buildId = (state.buildId ?? 0) + 1;
    state.lastError = null;
    state.progress = {
      phase: 'Starting',
      processed: 0,
      total: 0,
      unit: 'items',
    };
    cacheLogger.info(`Overview index rebuild started (${trigger}) server=${serverId}`);
    const start = Date.now();
    try {
      state.data = await this.buildIndex(uaClient, state);
      state.lastBuiltAt = new Date().toISOString();
      state.lastDurationMs = Date.now() - start;
      state.expiresAtMs = Date.now() + CACHE_TTL_MS;
      state.progress = {
        phase: 'Completed',
        processed: state.progress.total || state.progress.processed,
        total: state.progress.total || state.progress.processed,
        unit: state.progress.unit,
      };
      cacheLogger.info(
        `Overview index COMPLETE (${trigger}) server=${serverId} took ${state.lastDurationMs}ms`,
      );
      await this.persistToCache(serverId);
    } catch (error: any) {
      state.lastError = error?.message || 'Overview index rebuild failed';
      cacheLogger.error(
        `Overview index rebuild error server=${serverId}: ${state.lastError}`,
      );
    } finally {
      state.isBuilding = false;
    }
  }

  requestRebuild(serverId: string, uaClient: UAClient, trigger: 'startup' | 'manual' | 'auto') {
    const state = this.getState(serverId);
    if (state.isBuilding) {
      return;
    }
    void this.rebuildIndex(serverId, uaClient, trigger);
  }

  private resolveProtocolVendor(node: string) {
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
    return { protocol, vendor };
  }

  async refreshNode(serverId: string, uaClient: UAClient, node: string) {
    await this.ensureHydrated(serverId);
    const state = this.getState(serverId);
    if (!state.data) {
      return;
    }
    const resolved = this.resolveProtocolVendor(node);
    if (!resolved) {
      return;
    }

    const { protocol, vendor } = resolved;
    const protocolName = protocol || 'fcom';

    const listDirectory = async (nodePath: string) => {
      const all: any[] = [];
      let start = 0;
      while (true) {
        const response = await listRulesWithRetry(
          uaClient,
          nodePath,
          start,
          'refresh-list',
        );
        const data = Array.isArray(response?.data) ? response.data : [];
        if (data.length === 0) {
          break;
        }
        all.push(...data);
        if (data.length < OVERVIEW_PAGE_LIMIT) {
          break;
        }
        start += data.length;
      }
      return all;
    };

    const isFolderEntry = (entry: any) => {
      const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
      return !name.endsWith('.json');
    };

    const buildFileCounts = async (pathId: string) => {
      const counts = createEmptyCounts();
      const response = await readRuleWithRetry(uaClient, pathId, 'refresh-read');
      const raw = extractRuleText(response);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const objects: any[] = Array.isArray(parsed?.objects) ? parsed.objects : [];
      counts.files = 1;
      counts.objects = objects.length;

      for (const obj of objects) {
        const variableCount = Array.isArray(obj?.trap?.variables) ? obj.trap.variables.length : 0;
        counts.variables += variableCount;

        const classification = classifyObject(obj);
        if (classification === 'processor') {
          counts.processorObjects += 1;
        } else if (classification === 'eval') {
          counts.evalObjects += 1;
        } else {
          counts.literalObjects += 1;
        }
      }
      return counts;
    };

    const buildOverrideCounts = async (pathId: string, protocol: string) => {
      const response = await readRuleWithRetry(uaClient, pathId, 'refresh-override', {
        timeoutMs: OVERVIEW_OVERRIDE_TIMEOUT_MS,
      });
      const raw = extractRuleText(response);
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
      const overrides = parseOverridePayload(text);
      return countOverridesForProtocol(overrides, protocol);
    };

    const overridesRoot = PATH_PREFIX.includes('/_objects')
      ? `${PATH_PREFIX.replace('/_objects', '')}/overrides`
      : `${PATH_PREFIX}/overrides`;

    const listDirectoryRecursive = async (nodePath: string) => {
      const entries = await listDirectory(nodePath);
      const all: any[] = [...entries];
      const folders = entries.filter((entry) => isFolderEntry(entry));
      for (const folder of folders) {
        const folderNode = String(folder?.PathID || folder?.PathName || '');
        if (!folderNode) {
          continue;
        }
        const nested = await listDirectoryRecursive(folderNode);
        all.push(...nested);
      }
      return all;
    };

    const listing = await listDirectory(node);
    const files = listing.filter((entry) => {
      const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
      return name.endsWith('.json');
    });

    const nextCounts = createEmptyCounts();
    for (const entry of files) {
      const pathId = String(entry?.PathID || entry?.PathName || '');
      if (!pathId) {
        continue;
      }
      const counts = await buildFileCounts(pathId);
      addCounts(nextCounts, counts);
    }

    if (overridesRoot) {
      const overrideListing = await listDirectoryRecursive(overridesRoot);
      const overrideFiles = overrideListing.filter((entry) => {
        const fileName = String(entry?.PathName || entry?.PathID || '').toLowerCase();
        if (!fileName.endsWith(OVERRIDE_SUFFIX)) {
          return false;
        }
        const baseName = path.posix.basename(fileName);
        return baseName.startsWith(`${vendor.toLowerCase()}.`);
      });
      let overrideCount = 0;
      for (const entry of overrideFiles) {
        const pathId = String(entry?.PathID || entry?.PathName || '');
        if (!pathId) {
          continue;
        }
        overrideCount += await buildOverrideCounts(pathId, protocolName);
      }
      nextCounts.overrides = overrideCount;
    }

    let protocolEntry = state.data.protocols.find(
      (entry) => entry.name.toLowerCase() === protocolName.toLowerCase(),
    );
    if (!protocolEntry) {
      protocolEntry = {
        name: protocolName,
        counts: createEmptyCounts(),
        vendors: [],
      };
      state.data.protocols.push(protocolEntry);
    }

    let vendorEntry = protocolEntry.vendors.find(
      (entry) => entry.name.toLowerCase() === vendor.toLowerCase(),
    );
    if (!vendorEntry) {
      vendorEntry = { name: vendor, counts: createEmptyCounts() };
      protocolEntry.vendors.push(vendorEntry);
    }

    subtractCounts(state.data.totals, vendorEntry.counts);
    subtractCounts(protocolEntry.counts, vendorEntry.counts);
    vendorEntry.counts = nextCounts;
    addCounts(protocolEntry.counts, nextCounts);
    addCounts(state.data.totals, nextCounts);

    state.lastBuiltAt = new Date().toISOString();
    state.lastError = null;
    state.progress = {
      phase: 'Targeted refresh',
      processed: files.length,
      total: files.length,
      unit: 'files',
    };
    await this.persistToCache(serverId);
  }

  private async buildIndex(uaClient: UAClient, state: OverviewState): Promise<OverviewData> {
    if (!PATH_PREFIX) {
      throw new Error('COMS_PATH_PREFIX is not configured');
    }
    const protocolMap = new Map<
      string,
      { counts: OverviewCounts; vendors: Map<string, OverviewCounts> }
    >();

    const recordCounts = (protocol: string, vendor: string, delta: OverviewCounts) => {
      if (!protocolMap.has(protocol)) {
        protocolMap.set(protocol, { counts: createEmptyCounts(), vendors: new Map() });
      }
      const protocolEntry = protocolMap.get(protocol)!;
      if (!protocolEntry.vendors.has(vendor)) {
        protocolEntry.vendors.set(vendor, createEmptyCounts());
      }
      addCounts(protocolEntry.counts, delta);
      addCounts(protocolEntry.vendors.get(vendor)!, delta);
    };

    const normalizePathString = (value: string) =>
      path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\/+/, '');

    const isFolderEntry = (entry: any) => {
      const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
      return !name.endsWith('.json');
    };

    const listDirectory = async (node: string) => {
      const all: any[] = [];
      let start = 0;
      while (true) {
        const response = await listRulesWithRetry(uaClient, node, start, 'build-list');
        const data = Array.isArray(response?.data) ? response.data : [];
        if (data.length === 0) {
          break;
        }
        all.push(...data);
        if (data.length < OVERVIEW_PAGE_LIMIT) {
          break;
        }
        start += data.length;
      }
      return all;
    };

    const listDirectoryRecursive = async (node: string) => {
      const entries = await listDirectory(node);
      const all: any[] = [...entries];
      const folders = entries.filter((entry) => isFolderEntry(entry));
      for (const folder of folders) {
        const folderNode = String(folder?.PathID || folder?.PathName || '');
        if (!folderNode) {
          continue;
        }
        const nested = await listDirectoryRecursive(folderNode);
        all.push(...nested);
      }
      return all;
    };

    const buildFileCounts = async (pathId: string) => {
      const counts = createEmptyCounts();
      const response = await readRuleWithRetry(uaClient, pathId, 'build-read');
      const raw = extractRuleText(response);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const objects: any[] = Array.isArray(parsed?.objects) ? parsed.objects : [];
      counts.files = 1;
      counts.objects = objects.length;

      for (const obj of objects) {
        const variableCount = Array.isArray(obj?.trap?.variables) ? obj.trap.variables.length : 0;
        counts.variables += variableCount;

        const classification = classifyObject(obj);
        if (classification === 'processor') {
          counts.processorObjects += 1;
        } else if (classification === 'eval') {
          counts.evalObjects += 1;
        } else {
          counts.literalObjects += 1;
        }
      }
      return counts;
    };

    const buildOverrideCounts = async (pathId: string) => {
      const response = await readRuleWithRetry(uaClient, pathId, 'build-override', {
        timeoutMs: OVERVIEW_OVERRIDE_TIMEOUT_MS,
      });
      const raw = extractRuleText(response);
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
      return parseOverridePayload(text);
    };

    const normalizeVendorName = (value: string) => value.trim().toLowerCase();
    const overrideCountsByProtocolVendor = new Map<
      string,
      { name: string; count: number; protocol: string }
    >();
    const rootOverrideCounts = new Map<string, number>();
    const appliedOverrides = new Set<string>();
    let unassignedOverrideCount = 0;
    const applyVendorOverride = (protocol: string, vendor: string) => {
      const vendorKey = normalizeVendorName(vendor);
      const lookupKey = `${protocol.toLowerCase()}::${vendorKey}`;
      const entry = overrideCountsByProtocolVendor.get(lookupKey);
      if (!entry || entry.count <= 0) {
        return;
      }
      if (appliedOverrides.has(lookupKey)) {
        return;
      }
      appliedOverrides.add(lookupKey);
      recordCounts(protocol, vendor, {
        ...createEmptyCounts(),
        overrides: entry.count,
      });
    };

    const overridesRoot = PATH_PREFIX.includes('/_objects')
      ? `${PATH_PREFIX.replace('/_objects', '')}/overrides`
      : `${PATH_PREFIX}/overrides`;
    try {
      const overrideListing = await listDirectoryRecursive(overridesRoot);
      const overridesRootNormalized = normalizePathString(overridesRoot);
      const overrideFiles = overrideListing.filter((entry) => {
        const fileName = normalizePathString(String(entry?.PathID || entry?.PathName || ''));
        return fileName && path.posix.basename(fileName).toLowerCase().endsWith(OVERRIDE_SUFFIX);
      });
      state.progress.phase = 'Scanning overrides';
      state.progress.processed = 0;
      state.progress.total = overrideFiles.length;
      state.progress.unit = 'overrides';
      const runOverridePool = async (items: typeof overrideFiles, concurrency: number) => {
        let cursor = 0;
        const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
          while (cursor < items.length) {
            const idx = cursor;
            cursor += 1;
            const overrideEntry = items[idx];
            const fileName = normalizePathString(
              String(overrideEntry?.PathID || overrideEntry?.PathName || ''),
            );
            if (!fileName) {
              state.progress.processed += 1;
              continue;
            }
            const baseName = path.posix.basename(fileName);
            const relative = path.posix.relative(overridesRootNormalized, fileName);
            if (!relative || relative.startsWith('..')) {
              state.progress.processed += 1;
              continue;
            }
            const baseStem =
              baseName.replace(new RegExp(`${OVERRIDE_SUFFIX}$`, 'i'), '') || '(root)';
            const nameParts = baseStem.split('.').filter(Boolean);
            const relativeParts = relative.split('/').filter(Boolean);
            const folderProtocol =
              relativeParts.length > 1 ? relativeParts[relativeParts.length - 2] : '';
            const protocol = ['trap', 'syslog'].includes(folderProtocol.toLowerCase())
              ? folderProtocol
              : null;
            const vendorName = nameParts.length > 0 ? nameParts[0] : baseStem;
            const overrides = await buildOverrideCounts(
              String(overrideEntry?.PathID || fileName),
            );
            const entries = overrides.filter(
              (entry: any) => entry && typeof entry === 'object',
            );
            entries.forEach((entry: any) => {
              const method = String(entry?.method || '').trim();
              const methodProtocol = method ? normalizeOverrideProtocol(method) : '';
              const protocolName = methodProtocol || (protocol ? normalizeOverrideProtocol(protocol) : 'fcom');
              if (protocolName) {
                const key = `${protocolName.toLowerCase()}::${normalizeVendorName(vendorName)}`;
                const existing = overrideCountsByProtocolVendor.get(key);
                const nextCount = (existing?.count || 0) + 1;
                overrideCountsByProtocolVendor.set(key, {
                  name: vendorName,
                  count: nextCount,
                  protocol: protocolName,
                });
              } else {
                const vendorKey = normalizeVendorName(vendorName);
                const existingCount = rootOverrideCounts.get(vendorKey) || 0;
                rootOverrideCounts.set(vendorKey, existingCount + 1);
              }
            });
            state.progress.processed += 1;
          }
        });
        await Promise.all(workers);
      };

      await runOverridePool(overrideFiles, OVERVIEW_OVERRIDE_CONCURRENCY);
    } catch (error: any) {
      cacheLogger.warn(
        `Overview overrides not found for ${overridesRoot}: ${error?.message || 'unknown error'}`,
      );
    }

    state.progress = {
      phase: 'Scanning folders',
      processed: 0,
      total: 0,
      unit: 'folders',
    };

    const protocolEntries = await listDirectory(PATH_PREFIX);
    const protocolFolders = protocolEntries.filter((entry) => isFolderEntry(entry));
    state.progress.total = protocolFolders.length;
    const fileEntries: Array<{ pathId: string; protocol: string; vendor: string }> = [];
    const vendorPairs: Array<{ protocol: string; vendor: string }> = [];
    const vendorKeySet = new Set<string>();

    for (const protocolEntry of protocolFolders) {
      const protocolName =
        String(protocolEntry?.PathName || protocolEntry?.PathID || '')
          .split('/')
          .pop() || '';
      if (!protocolName || protocolName.toLowerCase() === 'overrides') {
        state.progress.processed += 1;
        continue;
      }
      const protocolNode = String(protocolEntry?.PathID || `${PATH_PREFIX}/${protocolName}`);

      const protocolListing = await listDirectory(protocolNode);

      for (const entry of protocolListing) {
        const entryName = String(entry?.PathName || entry?.PathID || '');
        if (entryName.toLowerCase() === 'overrides') {
          continue;
        }
        if (isFolderEntry(entry)) {
          const vendorName = entryName;
          const vendorNode = String(entry?.PathID || `${protocolNode}/${vendorName}`);
          const vendorListing = await listDirectory(vendorNode);
          const vendorKey = `${protocolName}::${vendorName}`;
          if (!vendorKeySet.has(vendorKey)) {
            vendorKeySet.add(vendorKey);
            vendorPairs.push({ protocol: protocolName, vendor: vendorName });
          }
          for (const vendorEntry of vendorListing) {
            const vendorEntryName = String(vendorEntry?.PathName || vendorEntry?.PathID || '');
            if (!vendorEntryName.toLowerCase().endsWith('.json')) {
              continue;
            }
            fileEntries.push({
              pathId: String(vendorEntry?.PathID || vendorEntryName),
              protocol: protocolName,
              vendor: vendorName,
            });
          }
        } else if (entryName.toLowerCase().endsWith('.json')) {
          fileEntries.push({
            pathId: String(entry?.PathID || entryName),
            protocol: protocolName,
            vendor: '(root)',
          });
        }
      }

      state.progress.processed += 1;
    }

    state.progress.phase = 'Scanning objects';
    state.progress.processed = 0;
    state.progress.total = fileEntries.length;
    state.progress.unit = 'files';

    const runPool = async (items: typeof fileEntries, concurrency: number) => {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
          const idx = cursor;
          cursor += 1;
          const entry = items[idx];
          const counts = await buildFileCounts(entry.pathId);
          recordCounts(entry.protocol, entry.vendor, counts);
          state.progress.processed += 1;
        }
      });
      await Promise.all(workers);
    };

    await runPool(fileEntries, OVERVIEW_CONCURRENCY);

    for (const pair of vendorPairs) {
      applyVendorOverride(pair.protocol, pair.vendor);
    }

    for (const [vendorKey, count] of rootOverrideCounts.entries()) {
      const targetVendorKey = vendorKey;
      const match = vendorPairs.find(
        (pair) => normalizeVendorName(pair.vendor) === targetVendorKey,
      );
      if (match) {
        recordCounts(match.protocol, match.vendor, {
          ...createEmptyCounts(),
          overrides: count,
        });
        continue;
      }
      unassignedOverrideCount += count;
    }

    const protocols: ProtocolEntry[] = Array.from(protocolMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => ({
        name,
        counts: data.counts,
        vendors: Array.from(data.vendors.entries())
          .map(([vendorName, vendorCounts]) => ({ name: vendorName, counts: vendorCounts }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));

    const totals = createEmptyCounts();
    for (const protocol of protocols) {
      addCounts(totals, protocol.counts);
    }
    if (unassignedOverrideCount > 0) {
      totals.overrides += unassignedOverrideCount;
    }

    return { totals, protocols };
  }
}

const overviewIndexService = new OverviewIndexService();

export const getOverviewStatus = (serverId: string) => overviewIndexService.getStatus(serverId);
export const requestOverviewRebuild = (
  serverId: string,
  uaClient: UAClient,
  trigger: 'startup' | 'manual' | 'auto' = 'manual',
) => overviewIndexService.requestRebuild(serverId, uaClient, trigger);
export const refreshOverviewNode = (serverId: string, uaClient: UAClient, node: string) =>
  overviewIndexService.refreshNode(serverId, uaClient, node);
export const overviewIndex = () => overviewIndexService;

export type { OverviewCounts, OverviewData, OverviewStatus };
