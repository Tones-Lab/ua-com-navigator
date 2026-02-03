import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const DEFAULT_COMS_ROOT = path.resolve(process.cwd(), '..', '..', 'coms');
const IGNORED_DIRS = new Set(['.git', '.svn', 'node_modules']);
const OVERRIDE_SUFFIX = '.override.json';

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
  lastError: string | null;
  counts: {
    protocols: number;
    vendors: number;
    files: number;
    objects: number;
  };
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

const classifyObject = (obj: any) => {
  const hasPreProcessors = Array.isArray(obj?.preProcessors) && obj.preProcessors.length > 0;
  const hasPostProcessors = Array.isArray(obj?.postProcessors) && obj.postProcessors.length > 0;
  const hasProcessorsArray = Array.isArray(obj?.processors) && obj.processors.length > 0;
  const hasProcessorArray = Array.isArray(obj?.processor) && obj.processor.length > 0;
  const hasProcessors = hasPreProcessors || hasPostProcessors || hasProcessorsArray || hasProcessorArray;

  const eventFields = obj?.event && typeof obj.event === 'object'
    ? Object.values(obj.event)
    : [];
  const hasEval = eventFields.some((value: any) => (
    value && typeof value === 'object' && typeof value.eval === 'string'
  ));

  if (hasProcessors) {
    return 'processor';
  }
  if (hasEval) {
    return 'eval';
  }
  return 'literal';
};

class OverviewIndexService {
  private rootPath: string;
  private data: OverviewData | null = null;
  private isBuilding = false;
  private lastBuiltAt: string | null = null;
  private lastDurationMs: number | null = null;
  private lastError: string | null = null;

  constructor(rootPath?: string) {
    this.rootPath = rootPath || process.env.COMS_ROOT || DEFAULT_COMS_ROOT;
  }

  start() {
    if (this.isBuilding) {
      return;
    }
    void this.rebuildIndex('startup');
  }

  getStatus(): OverviewStatus {
    return {
      rootPath: this.rootPath,
      isReady: !!this.data,
      isBuilding: this.isBuilding,
      lastBuiltAt: this.lastBuiltAt,
      lastDurationMs: this.lastDurationMs,
      lastError: this.lastError,
      counts: {
        protocols: this.data?.protocols.length || 0,
        vendors: this.data?.protocols.reduce((sum, protocol) => sum + protocol.vendors.length, 0) || 0,
        files: this.data?.totals.files || 0,
        objects: this.data?.totals.objects || 0,
      },
    };
  }

  getData(): OverviewData | null {
    return this.data;
  }

  async rebuildIndex(trigger: 'startup' | 'manual' = 'manual') {
    if (this.isBuilding) {
      return;
    }
    this.isBuilding = true;
    this.lastError = null;
    const start = Date.now();
    try {
      this.data = await this.buildIndex();
      this.lastBuiltAt = new Date().toISOString();
      this.lastDurationMs = Date.now() - start;
      logger.info(`Overview index rebuilt (${trigger}) in ${this.lastDurationMs}ms`);
    } catch (error: any) {
      this.lastError = error?.message || 'Overview index rebuild failed';
      logger.error(`Overview index rebuild error: ${this.lastError}`);
    } finally {
      this.isBuilding = false;
    }
  }

  requestRebuild() {
    if (this.isBuilding) {
      return;
    }
    void this.rebuildIndex('manual');
  }

  private async buildIndex(): Promise<OverviewData> {
    const protocolMap = new Map<string, { counts: OverviewCounts; vendors: Map<string, OverviewCounts> }>();

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

    const walk = async (dirPath: string, relativePath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        const absolutePath = path.join(dirPath, entry.name);
        const nextRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(absolutePath, nextRelative);
          continue;
        }
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) {
          continue;
        }

        const parts = nextRelative.split('/').filter(Boolean);
        if (parts.length === 0) {
          continue;
        }

        let protocol = parts[0];
        const fileName = parts[parts.length - 1];
        const overrideIndex = parts.indexOf('overrides');
        let vendor = '(root)';
        let isOverride = fileName.toLowerCase().endsWith(OVERRIDE_SUFFIX);

        if (overrideIndex >= 0) {
          protocol = overrideIndex > 0 ? parts[0] : 'overrides';
          const vendorCandidate = parts[overrideIndex + 1];
          vendor = vendorCandidate
            ? vendorCandidate.replace(new RegExp(`${OVERRIDE_SUFFIX}$`, 'i'), '')
            : '(root)';
          isOverride = true;
        } else if (parts.length >= 3) {
          vendor = parts[1];
        }

        if (isOverride) {
          recordCounts(protocol, vendor, {
            ...createEmptyCounts(),
            overrides: 1,
          });
          continue;
        }

        let raw: string;
        try {
          raw = await fs.readFile(absolutePath, 'utf-8');
        } catch (error: any) {
          logger.warn(`Overview index skipped ${absolutePath}: ${error?.message || 'read error'}`);
          continue;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch (error: any) {
          logger.warn(`Overview index failed to parse ${absolutePath}: ${error?.message || 'parse error'}`);
          continue;
        }

        const objects: any[] = Array.isArray(parsed?.objects) ? parsed.objects : [];
        const counts = createEmptyCounts();
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

        recordCounts(protocol, vendor, counts);
      }
    };

    await walk(this.rootPath, '');

    const protocols: ProtocolEntry[] = Array.from(protocolMap.entries())
      .map(([name, data]) => ({
        name,
        counts: data.counts,
        vendors: Array.from(data.vendors.entries())
          .map(([vendorName, vendorCounts]) => ({ name: vendorName, counts: vendorCounts }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const totals = createEmptyCounts();
    for (const protocol of protocols) {
      addCounts(totals, protocol.counts);
    }

    return { totals, protocols };
  }
}

const overviewIndexService = new OverviewIndexService();

export const startOverviewIndexing = () => overviewIndexService.start();
export const getOverviewStatus = () => overviewIndexService.getStatus();
export const requestOverviewRebuild = () => overviewIndexService.requestRebuild();
export const overviewIndex = () => overviewIndexService;

export type { OverviewCounts, OverviewData, OverviewStatus };
