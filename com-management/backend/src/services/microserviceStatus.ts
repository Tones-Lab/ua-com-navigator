import UAClient from './ua';

export type MicroserviceServiceStatus = {
  name: string;
  label: string;
  installed: boolean;
  available: boolean;
  running: boolean;
  cluster: string;
  namespace: string;
  workload: {
    ready: string;
    available: string;
    uptodate: string;
  } | null;
};

export type MicroserviceStatusSummary = {
  success: boolean;
  chainReady: boolean;
  required: MicroserviceServiceStatus[];
  missing: string[];
  installedCount: number;
  catalogCount: number;
  updatedAt: string;
};

const REQUIRED_CHAIN = [
  { key: 'trap-collector', label: 'Trap Collector', hints: ['trap-collector', 'trap collector'] },
  { key: 'fcom-processor', label: 'FCOM Processor', hints: ['fcom-processor', 'fcom processor'] },
  { key: 'event-sink', label: 'Event Sink', hints: ['event-sink', 'event sink'] },
];

const normalizeEntry = (entry: Record<string, any>) => {
  const map = new Map<string, any>();
  Object.keys(entry || {}).forEach((key) => {
    map.set(key.toLowerCase(), entry[key]);
  });
  return map;
};

const pickEntryValue = (entry: Record<string, any>, keys: string[]): string => {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const map = normalizeEntry(entry);
  for (const key of keys) {
    if (entry[key] !== undefined && entry[key] !== null) {
      return String(entry[key]);
    }
    const lower = key.toLowerCase();
    if (map.has(lower)) {
      const value = map.get(lower);
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }
  return '';
};

const extractEntries = (result: any): Array<Record<string, any>> => {
  if (!result) {
    return [];
  }
  const data = result.data || result.results || result.rows || result.items;
  if (Array.isArray(data)) {
    return data as Array<Record<string, any>>;
  }
  if (data && typeof data === 'object') {
    const nested = (data as any).data || (data as any).results || (data as any).rows || (data as any).items;
    if (Array.isArray(nested)) {
      return nested as Array<Record<string, any>>;
    }
  }
  return [];
};

const matchesTarget = (entry: Record<string, any>, target: string): boolean => {
  const candidates = [
    pickEntryValue(entry, ['ReleaseName', 'releaseName', 'release_name']),
    pickEntryValue(entry, ['Helmchart', 'helmchart', 'chart', 'chartName', 'helmChart']),
    pickEntryValue(entry, ['Name', 'name']),
  ].filter(Boolean);
  return candidates.some((value) => value.toLowerCase().includes(target));
};

const matchesCatalogTarget = (entry: Record<string, any>, target: string): boolean => {
  const name = pickEntryValue(entry, ['name', 'Name', 'chart', 'Chart', 'helmchart', 'Helmchart']);
  if (!name) {
    return false;
  }
  return name.toLowerCase().includes(target);
};

const findMatch = (
  entries: Array<Record<string, any>>,
  hints: string[],
  matcher: (entry: Record<string, any>, hint: string) => boolean,
): Record<string, any> | undefined =>
  entries.find((entry) => hints.some((hint) => matcher(entry, hint)));

const parseNumber = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseReady = (value: any): { ready: number; total: number } => {
  if (typeof value === 'string' && value.includes('/')) {
    const [readyRaw, totalRaw] = value.split('/');
    return { ready: parseNumber(readyRaw), total: parseNumber(totalRaw) };
  }
  const ready = parseNumber(value);
  return { ready, total: ready };
};

const isWorkloadRunning = (entry: Record<string, any> | undefined): boolean => {
  if (!entry) {
    return false;
  }
  const { ready, total } = parseReady(entry.ready);
  const available = parseNumber(entry.available);
  return ready > 0 && (total === 0 || ready >= total) && available > 0;
};

const fetchInstalledEntries = async (uaClient: UAClient): Promise<Array<Record<string, any>>> => {
  const entries: Array<Record<string, any>> = [];
  const limit = 200;
  for (let page = 1; page <= 10; page += 1) {
    const start = (page - 1) * limit;
    const installed = await uaClient.getInstalledHelmCharts(page, start, limit);
    const batch = extractEntries(installed);
    if (batch.length === 0) {
      break;
    }
    entries.push(...batch);
    if (batch.length < limit) {
      break;
    }
  }
  return entries;
};

const fetchCatalogEntries = async (uaClient: UAClient): Promise<Array<Record<string, any>>> => {
  const entries: Array<Record<string, any>> = [];
  const limit = 500;
  for (let start = 0; start <= 2000; start += limit) {
    const catalogs = await uaClient.getMicroserviceCatalogs(start, limit);
    const batch = extractEntries(catalogs);
    if (batch.length === 0) {
      break;
    }
    entries.push(...batch);
    if (batch.length < limit) {
      break;
    }
  }
  return entries;
};

const fetchWorkloadEntries = async (
  uaClient: UAClient,
  cluster: string,
  namespace: string,
): Promise<Array<Record<string, any>>> => {
  if (!cluster || !namespace) {
    return [];
  }
  const node = `/${cluster}/${namespace}`;
  const workload = await uaClient.getMicroserviceWorkloadTree(node, 'deployment');
  return extractEntries(workload);
};

const buildWorkloadMap = async (
  uaClient: UAClient,
  entries: Array<Record<string, any>>,
): Promise<Map<string, Map<string, Record<string, any>>>> => {
  const namespaces = new Map<string, { cluster: string; namespace: string }>();
  entries.forEach((entry) => {
    const cluster = pickEntryValue(entry, ['Cluster', 'cluster']);
    const namespace = pickEntryValue(entry, ['Namespace', 'namespace']);
    if (cluster && namespace) {
      const key = `${cluster}::${namespace}`;
      namespaces.set(key, { cluster, namespace });
    }
  });

  const workloadMap = new Map<string, Map<string, Record<string, any>>>();
  const workloadEntries = await Promise.all(
    Array.from(namespaces.values()).map(async ({ cluster, namespace }) => {
      const data = await fetchWorkloadEntries(uaClient, cluster, namespace);
      return { key: `${cluster}::${namespace}`, data };
    }),
  );

  workloadEntries.forEach(({ key, data }) => {
    const map = new Map<string, Record<string, any>>();
    data.forEach((entry) => {
      const name = pickEntryValue(entry, ['name', 'Name']);
      if (name) {
        map.set(name, entry);
      }
    });
    workloadMap.set(key, map);
  });

  return workloadMap;
};

const buildServiceStatus = (
  installed: Array<Record<string, any>>,
  catalogs: Array<Record<string, any>>,
  workloads: Map<string, Map<string, Record<string, any>>>,
  service: { key: string; label: string; hints: string[] },
): MicroserviceServiceStatus => {
  const hints = service.hints.map((item) => item.toLowerCase());
  const installedEntry = findMatch(installed, hints, matchesTarget);
  const catalogEntry = findMatch(catalogs, hints, matchesCatalogTarget);
  const cluster = installedEntry ? pickEntryValue(installedEntry, ['Cluster', 'cluster']) : '';
  const namespace = installedEntry ? pickEntryValue(installedEntry, ['Namespace', 'namespace']) : '';
  const workloadKey = `${cluster}::${namespace}`;
  const workloadMap = workloads.get(workloadKey);
  const workloadEntry = workloadMap
    ? Array.from(workloadMap.values()).find((entry) =>
        hints.some((hint) => matchesCatalogTarget(entry, hint)),
      )
    : undefined;
  return {
    name: service.key,
    label: service.label,
    installed: Boolean(installedEntry),
    available: Boolean(catalogEntry),
    running: Boolean(installedEntry) ? isWorkloadRunning(workloadEntry) : false,
    cluster,
    namespace,
    workload: workloadEntry
      ? {
          ready: String(workloadEntry.ready ?? ''),
          available: String(workloadEntry.available ?? ''),
          uptodate: String(workloadEntry.uptodate ?? ''),
        }
      : null,
  };
};

export const getMicroserviceStatus = async (
  uaClient: UAClient,
): Promise<MicroserviceStatusSummary> => {
  const [installedEntries, catalogEntries] = await Promise.all([
    fetchInstalledEntries(uaClient),
    fetchCatalogEntries(uaClient),
  ]);

  const workloadMap = await buildWorkloadMap(uaClient, installedEntries);
  const required = REQUIRED_CHAIN.map((service) =>
    buildServiceStatus(installedEntries, catalogEntries, workloadMap, service),
  );
  const missing = required.filter((entry) => !entry.installed).map((entry) => entry.name);
  const chainReady = missing.length === 0 && required.every((entry) => entry.running);

  return {
    success: true,
    chainReady,
    required,
    missing,
    installedCount: installedEntries.length,
    catalogCount: catalogEntries.length,
    updatedAt: new Date().toISOString(),
  };
};
