import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import { UAClient } from './ua';

const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const OVERVIEW_PAGE_LIMIT = Number(process.env.OVERVIEW_PAGE_LIMIT || 500);
const OVERRIDE_SUFFIX = '.override.json';
const DEFAULT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const OVERVIEW_REFRESH_INTERVAL_MS = Number(
  process.env.OVERVIEW_REFRESH_INTERVAL_MS || DEFAULT_REFRESH_INTERVAL_MS,
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
const CACHE_DIR = process.env.COM_CACHE_DIR || path.resolve(process.cwd(), 'cache');
const OVERVIEW_CACHE_FILE = path.join(CACHE_DIR, 'overview_index_cache.json');

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
};

type OverviewState = {
  data: OverviewData | null;
  isBuilding: boolean;
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
  refreshTimer: NodeJS.Timeout | null;
};

const alignToNextMinute = (timestampMs: number) => {
  const minuteMs = 60 * 1000;
  return Math.ceil(timestampMs / minuteMs) * minuteMs;
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

const collectOverrideTargets = (
  processors: any[],
  objectName: string,
  targetKeys: Set<string>,
) => {
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

class OverviewIndexService {
  private states = new Map<string, OverviewState>();

  hydrateFromDisk(
    payload: Record<
      string,
      { data: OverviewData; lastBuiltAt?: string | null; lastDurationMs?: number | null }
    >,
  ) {
    Object.entries(payload).forEach(([serverId, value]) => {
      if (!value?.data) {
        return;
      }
      const state = this.getState(serverId);
      state.data = value.data;
      state.lastBuiltAt = value.lastBuiltAt ?? null;
      state.lastDurationMs = value.lastDurationMs ?? null;
      state.isBuilding = false;
      state.lastError = null;
      state.progress = {
        phase: 'Loaded',
        processed: 0,
        total: 0,
        unit: 'items',
      };
    });
  }

  snapshotForDisk() {
    const payload: Record<
      string,
      { data: OverviewData; lastBuiltAt: string | null; lastDurationMs: number | null }
    > = {};
    for (const [serverId, state] of this.states.entries()) {
      if (!state.data) {
        continue;
      }
      payload[serverId] = {
        data: state.data,
        lastBuiltAt: state.lastBuiltAt,
        lastDurationMs: state.lastDurationMs,
      };
    }
    return payload;
  }

  private getState(serverId: string): OverviewState {
    if (!this.states.has(serverId)) {
      this.states.set(serverId, {
        data: null,
        isBuilding: false,
        lastBuiltAt: null,
        lastDurationMs: null,
        nextRefreshAt: null,
        lastError: null,
        progress: {
          phase: null,
          processed: 0,
          total: 0,
          unit: 'items',
        },
        refreshTimer: null,
      });
    }
    return this.states.get(serverId)!;
  }

  getStatus(serverId: string): OverviewStatus {
    const state = this.getState(serverId);
    return {
      rootPath: PATH_PREFIX,
      isReady: !!state.data,
      isBuilding: state.isBuilding,
      lastBuiltAt: state.lastBuiltAt,
      lastDurationMs: state.lastDurationMs,
      nextRefreshAt: state.nextRefreshAt,
      lastError: state.lastError,
      progress: state.progress,
      counts: {
        protocols: state.data?.protocols.length || 0,
        vendors:
          state.data?.protocols.reduce((sum, protocol) => sum + protocol.vendors.length, 0) || 0,
        files: state.data?.totals.files || 0,
        objects: state.data?.totals.objects || 0,
      },
    };
  }

  getData(serverId: string): OverviewData | null {
    return this.getState(serverId).data;
  }

  async rebuildIndex(
    serverId: string,
    uaClient: UAClient,
    trigger: 'startup' | 'manual' | 'schedule' = 'manual',
  ) {
    const state = this.getState(serverId);
    if (state.isBuilding) {
      return;
    }
    state.isBuilding = true;
    state.lastError = null;
    state.progress = {
      phase: 'Starting',
      processed: 0,
      total: 0,
      unit: 'items',
    };
    const start = Date.now();
    try {
      state.data = await this.buildIndex(uaClient, state);
      state.lastBuiltAt = new Date().toISOString();
      state.lastDurationMs = Date.now() - start;
      state.progress = {
        phase: 'Completed',
        processed: state.progress.total || state.progress.processed,
        total: state.progress.total || state.progress.processed,
        unit: state.progress.unit,
      };
      this.scheduleNextRefresh(state, serverId, uaClient);
      logger.info(`Overview index rebuilt (${trigger}) in ${state.lastDurationMs}ms`);
      persistOverviewCacheToDisk();
    } catch (error: any) {
      state.lastError = error?.message || 'Overview index rebuild failed';
      logger.error(`Overview index rebuild error: ${state.lastError}`);
    } finally {
      state.isBuilding = false;
    }
  }

  requestRebuild(serverId: string, uaClient: UAClient) {
    const state = this.getState(serverId);
    if (state.isBuilding) {
      return;
    }
    void this.rebuildIndex(serverId, uaClient, 'manual');
  }

  private scheduleNextRefresh(state: OverviewState, serverId: string, uaClient: UAClient) {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
    }
    const intervalMs = OVERVIEW_REFRESH_INTERVAL_MS;
    const nextAt = alignToNextMinute(Date.now() + intervalMs);
    state.nextRefreshAt = new Date(nextAt).toISOString();
    state.refreshTimer = setTimeout(
      () => {
        void this.rebuildIndex(serverId, uaClient, 'schedule');
      },
      Math.max(0, nextAt - Date.now()),
    );
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
        const response = await uaClient.listRules('/', OVERVIEW_PAGE_LIMIT, nodePath, true, start);
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

    const buildFileCounts = async (pathId: string) => {
      const counts = createEmptyCounts();
      try {
        const response = await uaClient.readRule(pathId);
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
      } catch (error: any) {
        logger.warn(`Overview index skipped ${pathId}: ${error?.message || 'read error'}`);
      }
      return counts;
    };

    const buildOverrideCounts = async (pathId: string) => {
      try {
        const response = await (OVERVIEW_OVERRIDE_TIMEOUT_MS
          ? Promise.race([
              uaClient.readRule(pathId),
              new Promise((_, reject) => {
                setTimeout(
                  () => reject(new Error('Override read timeout')),
                  OVERVIEW_OVERRIDE_TIMEOUT_MS,
                );
              }),
            ])
          : uaClient.readRule(pathId));
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
      } catch (error: any) {
        logger.warn(`Overview index override skipped ${pathId}: ${error?.message || 'read error'}`);
        return 0;
      }
    };

    const resolveOverridePath = () => {
      const basePath = PATH_PREFIX.includes('/_objects')
        ? PATH_PREFIX.replace('/_objects', '')
        : PATH_PREFIX;
      if (!basePath) {
        return null;
      }
      if (protocol) {
        return `${basePath}/overrides/${protocol}/${vendor}.override.json`;
      }
      return `${basePath}/overrides/${vendor}.override.json`;
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

    const overridePath = resolveOverridePath();
    if (overridePath) {
      nextCounts.overrides = await buildOverrideCounts(overridePath);
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
    persistOverviewCacheToDisk();
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
        const response = await uaClient.listRules('/', OVERVIEW_PAGE_LIMIT, node, true, start);
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
      try {
        const response = await uaClient.readRule(pathId);
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
      } catch (error: any) {
        logger.warn(`Overview index skipped ${pathId}: ${error?.message || 'read error'}`);
      }
      return counts;
    };

    const buildOverrideCounts = async (pathId: string) => {
      try {
        const response = await (OVERVIEW_OVERRIDE_TIMEOUT_MS
          ? Promise.race([
              uaClient.readRule(pathId),
              new Promise((_, reject) => {
                setTimeout(
                  () => reject(new Error('Override read timeout')),
                  OVERVIEW_OVERRIDE_TIMEOUT_MS,
                );
              }),
            ])
          : uaClient.readRule(pathId));
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
      } catch (error: any) {
        logger.warn(`Overview index override skipped ${pathId}: ${error?.message || 'read error'}`);
        return 0;
      }
    };

    const normalizeVendorName = (value: string) => value.trim().toLowerCase();
    const overrideCountsByProtocolVendor = new Map<
      string,
      { name: string; count: number; protocol: string }
    >();
    const rootOverrideCounts: Array<{ name: string; count: number }> = [];
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
            const parts = relative.split('/').filter(Boolean);
            const protocol = parts.length > 1 ? parts[0] : null;
            const vendorName =
              baseName.replace(new RegExp(`${OVERRIDE_SUFFIX}$`, 'i'), '') || '(root)';
            const overrideCount = await buildOverrideCounts(
              String(overrideEntry?.PathID || fileName),
            );
            if (protocol) {
              const key = `${protocol.toLowerCase()}::${normalizeVendorName(vendorName)}`;
              overrideCountsByProtocolVendor.set(key, {
                name: vendorName,
                count: overrideCount,
                protocol,
              });
            } else {
              rootOverrideCounts.push({ name: vendorName, count: overrideCount });
            }
            state.progress.processed += 1;
          }
        });
        await Promise.all(workers);
      };

      await runOverridePool(overrideFiles, OVERVIEW_OVERRIDE_CONCURRENCY);
    } catch (error: any) {
      logger.warn(
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

    for (const entry of rootOverrideCounts) {
      const targetVendorKey = normalizeVendorName(entry.name);
      const match = vendorPairs.find(
        (pair) => normalizeVendorName(pair.vendor) === targetVendorKey,
      );
      if (match) {
        recordCounts(match.protocol, match.vendor, {
          ...createEmptyCounts(),
          overrides: entry.count,
        });
        continue;
      }
      unassignedOverrideCount += entry.count;
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

const ensureCacheDir = () => {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
};

const loadOverviewCacheFromDisk = () => {
  try {
    if (!fs.existsSync(OVERVIEW_CACHE_FILE)) {
      return;
    }
    const raw = fs.readFileSync(OVERVIEW_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.states) {
      overviewIndexService.hydrateFromDisk(parsed.states);
    }
  } catch {
    // ignore
  }
};

const persistOverviewCacheToDisk = () => {
  try {
    ensureCacheDir();
    const payload = {
      states: overviewIndexService.snapshotForDisk(),
    };
    fs.writeFileSync(OVERVIEW_CACHE_FILE, JSON.stringify(payload));
  } catch (error: any) {
    logger.warn(`Overview cache persist failed: ${error?.message || 'write error'}`);
  }
};

loadOverviewCacheFromDisk();

export const getOverviewStatus = (serverId: string) => overviewIndexService.getStatus(serverId);
export const requestOverviewRebuild = (serverId: string, uaClient: UAClient) =>
  overviewIndexService.requestRebuild(serverId, uaClient);
export const refreshOverviewNode = (serverId: string, uaClient: UAClient, node: string) =>
  overviewIndexService.refreshNode(serverId, uaClient, node);
export const overviewIndex = () => overviewIndexService;

export type { OverviewCounts, OverviewData, OverviewStatus };
