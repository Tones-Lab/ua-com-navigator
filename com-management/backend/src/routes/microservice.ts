import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';
import { getMicroserviceStatus } from '../services/microserviceStatus';
import {
  getCachedMicroserviceStatus,
  getMicroserviceStatusPollMs,
  setCachedMicroserviceStatus,
} from '../services/microserviceStatusCache';

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

const parseChartInfo = (chart: string, appVersion: string) => {
  const trimmed = String(chart || '').trim();
  const versionMatch = trimmed.match(/^(.*)-([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)$/);
  if (versionMatch) {
    return { helmchart: versionMatch[1], version: versionMatch[2] };
  }
  const appMatch = String(appVersion || '')
    .replace(/^v/i, '')
    .match(/([0-9]+\.[0-9]+\.[0-9]+)/);
  return { helmchart: trimmed, version: appMatch ? appMatch[1] : '' };
};

const isTransientUaError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || error?.errno || '').toLowerCase();
  return (
    message.includes('socket hang up') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    code === 'econnreset' ||
    code === 'etimedout'
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withUaRetry = async <T>(
  label: string,
  operation: () => Promise<T>,
  attempts: number = 3,
): Promise<T> => {
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (!isTransientUaError(error) || attempt >= attempts) {
        throw error;
      }
      const delayMs = attempt * 500;
      logger.warn(
        `[Microservice] ${label} transient failure attempt ${attempt}/${attempts}: ${error?.message || 'unknown error'}`,
      );
      await wait(delayMs);
    }
  }
  throw lastError;
};

const extractCustomValues = (result: any): string | undefined => {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const candidates = [
    result.CustomValues,
    result.customValues,
    result.values,
    result.Value,
    result.value,
    result.data?.CustomValues,
    result.data?.customValues,
    result.data?.values,
    result.data?.Value,
    result.data?.value,
  ];
  if (Array.isArray(result.data) && result.data.length > 0) {
    const first = result.data[0];
    if (first && typeof first === 'object') {
      candidates.push(
        first.CustomValues,
        first.customValues,
        first.values,
        first.Value,
        first.value,
      );
    }
  }
  const match = candidates.find((item) => typeof item === 'string' && item.trim().length > 0);
  if (match) {
    return String(match);
  }
  const structured = candidates.find(
    (item) => item && typeof item === 'object' && !Array.isArray(item),
  );
  if (structured) {
    try {
      const serialized = JSON.stringify(structured);
      return serialized.length > 0 ? serialized : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const resolveCustomValuesForRedeploy = async (
  uaClient: UAClient,
  targetEntry: Record<string, any>,
  targetMeta: ReturnType<typeof getTargetMeta>,
  valuesResponse: any,
): Promise<string | undefined> => {
  const fromValuesResponse = extractCustomValues(valuesResponse);
  if (fromValuesResponse) {
    return fromValuesResponse;
  }

  const fromInstalledEntry = extractCustomValues(targetEntry);
  if (fromInstalledEntry) {
    logger.warn(
      '[Microservice] Helm values response missing CustomValues; using installed entry fallback',
    );
    return fromInstalledEntry;
  }

  const chartName = targetMeta.chartName || targetMeta.chartRaw;
  const chartVersion = targetMeta.chartVersion;
  if (chartName && chartVersion) {
    try {
      const catalogValues = await withUaRetry(
        'catalog-values',
        () => uaClient.getCatalogHelmChartValues(chartName, chartVersion),
        3,
      );
      const fromCatalog = extractCustomValues(catalogValues);
      if (fromCatalog) {
        logger.warn(
          '[Microservice] Helm values response missing CustomValues; using catalog values fallback',
        );
        return fromCatalog;
      }
    } catch (error: any) {
      logger.warn(
        `[Microservice] Catalog values fallback failed for ${chartName}@${chartVersion}: ${error?.message || 'unknown error'}`,
      );
    }
  }

  logger.warn('[Microservice] CustomValues unavailable from all sources; using empty-object fallback');
  return '{}';
};

const extractInstalledEntries = (result: any): Array<Record<string, any>> => {
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

const extractCatalogEntries = (result: any): Array<Record<string, any>> => {
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

const extractWorkloadEntries = (result: any): Array<Record<string, any>> => {
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

const REQUIRED_CHAIN = [
  { key: 'trap-collector', label: 'Trap Collector', hints: ['trap-collector', 'trap collector'] },
  { key: 'fcom-processor', label: 'FCOM Processor', hints: ['fcom-processor', 'fcom processor'] },
  { key: 'event-sink', label: 'Event Sink', hints: ['event-sink', 'event sink'] },
];

const SERVICE_KEYS = new Set(REQUIRED_CHAIN.map((entry) => entry.key));

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

const _buildServiceStatus = (
  installed: Array<Record<string, any>>,
  catalogs: Array<Record<string, any>>,
  workloads: Map<string, Map<string, Record<string, any>>>,
  service: { key: string; label: string; hints: string[] },
) => {
  const hints = service.hints.map((item) => item.toLowerCase());
  const installedEntry = findMatch(installed, hints, matchesTarget);
  const catalogEntry = findMatch(catalogs, hints, matchesCatalogTarget);
  const cluster = installedEntry ? pickEntryValue(installedEntry, ['Cluster', 'cluster']) : '';
  const namespace = installedEntry
    ? pickEntryValue(installedEntry, ['Namespace', 'namespace'])
    : '';
  const workloadKey = `${cluster}::${namespace}`;
  const workloadEntry = workloads.get(workloadKey)?.get(service.key);
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
          ready: workloadEntry.ready ?? '',
          available: workloadEntry.available ?? '',
          uptodate: workloadEntry.uptodate ?? '',
        }
      : null,
  };
};

const fetchInstalledEntries = async (uaClient: UAClient): Promise<Array<Record<string, any>>> => {
  const entries: Array<Record<string, any>> = [];
  const limit = 200;
  for (let page = 1; page <= 10; page += 1) {
    const start = (page - 1) * limit;
    const installed = await uaClient.getInstalledHelmCharts(page, start, limit);
    const batch = extractInstalledEntries(installed);
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
    const batch = extractCatalogEntries(catalogs);
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
  return extractWorkloadEntries(workload);
};

const pickClusterName = (result: any, preferred: string = 'primary-cluster'): string => {
  const entries = extractInstalledEntries(result);
  const names = entries
    .map((entry) =>
      pickEntryValue(entry, ['ClusterName', 'cluster', 'Cluster', 'name', 'Name']),
    )
    .filter(Boolean);
  if (names.includes(preferred)) {
    return preferred;
  }
  return names[0] || '';
};

const pickNamespaceList = (result: any): string[] => {
  const entries = extractInstalledEntries(result);
  return entries
    .map((entry) => pickEntryValue(entry, ['namespace', 'Namespace', 'name', 'Name']))
    .filter(Boolean);
};

const getTargetMeta = (entry: Record<string, any>) => {
  const chartRaw = pickEntryValue(entry, ['Helmchart', 'helmchart', 'chart', 'chartName']);
  const appVersion = pickEntryValue(entry, ['app_version', 'appVersion']);
  const chartInfo = parseChartInfo(chartRaw, appVersion);
  return {
    name: pickEntryValue(entry, ['ReleaseName', 'releaseName', 'release_name', 'name']),
    namespace: pickEntryValue(entry, ['Namespace', 'namespace']),
    cluster: pickEntryValue(entry, ['Cluster', 'cluster']),
    chartRaw,
    chartName: chartInfo.helmchart || chartRaw,
    chartVersion: chartInfo.version,
  };
};

const pickCatalogVersion = (entries: Array<Record<string, any>>): Record<string, any> | undefined => {
  if (!entries.length) {
    return undefined;
  }
  const scored = entries
    .map((entry) => {
      const created = pickEntryValue(entry, ['created', 'createdDate', 'Created', 'CreatedDate']);
      const score = created ? Date.parse(created) : 0;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.entry;
};

const resolveCatalogEntry = (
  catalogs: Array<Record<string, any>>,
  hints: string[],
): Record<string, any> | undefined => {
  const matches = catalogs.filter((entry) => hints.some((hint) => matchesCatalogTarget(entry, hint)));
  return pickCatalogVersion(matches) || matches[0];
};

const resolveNamespace = (
  serviceKey: string,
  installed: Array<Record<string, any>>,
  namespaces: string[],
): string => {
  if (serviceKey === 'fcom-processor') {
    const override = String(process.env.FCOM_PROCESSOR_NAMESPACE || '').trim();
    if (override && namespaces.includes(override)) {
      return override;
    }
  }
  const trapEntry = findMatch(installed, ['trap-collector'], matchesTarget);
  const eventEntry = findMatch(installed, ['event-sink'], matchesTarget);
  const fallbackEntry = trapEntry || eventEntry;
  const fallbackNamespace = fallbackEntry
    ? pickEntryValue(fallbackEntry, ['Namespace', 'namespace'])
    : '';
  if (fallbackNamespace && namespaces.includes(fallbackNamespace)) {
    return fallbackNamespace;
  }
  return namespaces[0] || '';
};

const buildDeployPayload = (
  entry: Record<string, any>,
  meta: ReturnType<typeof getTargetMeta>,
  customValues?: string,
) => ({
  Cluster: pickEntryValue(entry, ['Cluster', 'cluster']) || meta.cluster,
  Namespace: pickEntryValue(entry, ['Namespace', 'namespace']) || meta.namespace,
  Helmchart: meta.chartName || meta.chartRaw,
  ReleaseName: pickEntryValue(entry, ['ReleaseName', 'releaseName', 'release_name', 'name']),
  Version:
    meta.chartVersion ||
    pickEntryValue(entry, ['Version', 'version', 'chartVersion', 'revision']),
  CustomValues: customValues,
});

const buildCatalogDeployPayload = (
  cluster: string,
  namespace: string,
  chartName: string,
  version: string,
  customValues?: string,
) => ({
  Cluster: cluster,
  Namespace: namespace,
  Helmchart: chartName,
  ReleaseName: chartName,
  Version: version,
  CustomValues: customValues,
});

const deployServiceFromCatalog = async (params: {
  uaClient: UAClient;
  serviceKey: string;
  clusterName: string;
  namespaces: string[];
  installedEntries: Array<Record<string, any>>;
}) => {
  const { uaClient, serviceKey, clusterName, namespaces, installedEntries } = params;
  const catalogEntries = await fetchCatalogEntries(uaClient);
  const serviceHints = REQUIRED_CHAIN.find((entry) => entry.key === serviceKey)?.hints || [serviceKey];
  const catalogEntry = resolveCatalogEntry(
    catalogEntries,
    serviceHints.map((item) => item.toLowerCase()),
  );
  if (!catalogEntry) {
    throw new Error('Helm chart not found in catalog');
  }

  const chartName = pickEntryValue(catalogEntry, ['name', 'Name', 'Helmchart', 'helmchart', 'chart', 'Chart']);
  const version = pickEntryValue(catalogEntry, ['version', 'Version']);
  if (!chartName || !version) {
    throw new Error('Missing catalog chart name or version');
  }

  const namespace = resolveNamespace(serviceKey, installedEntries, namespaces);
  if (!namespace) {
    throw new Error('Unable to select namespace for deployment');
  }

  const valuesResponse = await withUaRetry(
    'catalog-default-values',
    () => uaClient.getCatalogHelmChartValues(chartName, version),
    3,
  );
  const customValues = extractCustomValues(valuesResponse) || '{}';
  const payload = buildCatalogDeployPayload(clusterName, namespace, chartName, version, customValues);

  const missing = Object.entries(payload)
    .filter(([key, value]) => ['CustomValues'].indexOf(key) === -1 && !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required deploy fields: ${missing.join(', ')}`);
  }

  const deployResult = await withUaRetry('deploy-helm-from-catalog', () => uaClient.deployHelmChart(payload), 3);
  if (!deployResult?.success) {
    throw new Error('Failed to deploy microservice');
  }
  return { deployResult, payload };
};

const buildDeployId = (target: { name: string; namespace: string; cluster: string }) => {
  if (!target.name || !target.namespace || !target.cluster) {
    return '';
  }
  return `id-${target.name}-=-${target.namespace}-=-${target.cluster}`;
};

const _buildWorkloadMap = async (
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
      try {
        const data = await fetchWorkloadEntries(uaClient, cluster, namespace);
        return { key: `${cluster}::${namespace}`, data };
      } catch (error: any) {
        logger.warn(`Workload fetch failed for ${cluster}/${namespace}: ${error?.message || 'unknown'}`);
        return { key: `${cluster}::${namespace}`, data: [] as Array<Record<string, any>> };
      }
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

const redeployInstalledEntry = async (
  uaClient: UAClient,
  targetEntry: Record<string, any>,
  clusterName: string,
  namespaces: string[],
  namespaceOverride?: string,
) => {
  const targetMeta = getTargetMeta(targetEntry);
  if (!targetMeta.cluster) {
    targetMeta.cluster = clusterName;
  }
  if (namespaceOverride) {
    targetMeta.namespace = namespaceOverride;
  }
  if (!targetMeta.namespace || !namespaces.includes(targetMeta.namespace)) {
    throw new Error('Installed chart namespace not found in cluster namespaces');
  }

  const deployId = buildDeployId({
    name: targetMeta.name,
    namespace: targetMeta.namespace,
    cluster: targetMeta.cluster,
  });
  if (!deployId) {
    throw new Error('Missing deploy id');
  }

  const valuesResponse = await withUaRetry(
    'deploy-values',
    () =>
      uaClient.getHelmChartValues({
        cluster: targetMeta.cluster,
        namespace: targetMeta.namespace,
        helmchart: targetMeta.chartName || targetMeta.chartRaw,
        releaseName: targetMeta.name,
        version: targetMeta.chartVersion,
      }),
    3,
  );
  const customValues = await resolveCustomValuesForRedeploy(
    uaClient,
    targetEntry,
    targetMeta,
    valuesResponse,
  );

  const payload = buildDeployPayload(targetEntry, targetMeta, customValues);
  const missing = Object.entries(payload)
    .filter(([key, value]) => ['CustomValues'].indexOf(key) === -1 && !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required deploy fields: ${missing.join(', ')}`);
  }

  const deleteResult = await withUaRetry('uninstall-helm', () => uaClient.uninstallHelmChart(deployId), 3);
  if (!deleteResult?.success) {
    throw new Error('Failed to uninstall');
  }

  const deployResult = await withUaRetry('deploy-helm', () => uaClient.deployHelmChart(payload), 3);
  if (!deployResult?.success) {
    throw new Error('Failed to redeploy');
  }
  return deployResult;
};

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.post('/redeploy-fcom', async (req: Request, res: Response) => {
  if (!(await requireEditPermission(req, res))) {
    return;
  }

  try {
    const uaClient = await getUaClientFromSession(req);

    const clusters = await uaClient.getMicroserviceClusters(0, 100);
    const clusterName = pickClusterName(clusters);
    if (!clusterName) {
      return res.status(400).json({ error: 'No clusters found' });
    }

    const namespacesResult = await uaClient.getClusterNamespaces(clusterName, 0, 200);
    const namespaces = pickNamespaceList(namespacesResult);
    if (namespaces.length === 0) {
      return res.status(400).json({ error: 'No namespaces found for cluster' });
    }

    const namespaceOverride = String(process.env.FCOM_PROCESSOR_NAMESPACE || '').trim();
    if (namespaceOverride && !namespaces.includes(namespaceOverride)) {
      return res.status(400).json({ error: 'Provided namespace not found in cluster namespaces' });
    }

    const entries = await fetchInstalledEntries(uaClient);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No installed Helm charts found' });
    }

    const configuredTarget = String(
      process.env.FCOM_PROCESSOR_RELEASE_NAME || process.env.FCOM_PROCESSOR_HELM_CHART || '',
    )
      .trim()
      .toLowerCase();
    const targetHints = Array.from(
      new Set([configuredTarget, 'fcom-processor'].filter((value) => value.length > 0)),
    );

    const pickTargetEntry = (enforceNamespace: boolean): Record<string, any> | undefined =>
      entries.find((entry) => {
        if (!targetHints.some((hint) => matchesTarget(entry, hint))) {
          return false;
        }
        if (!enforceNamespace || !namespaceOverride) {
          return true;
        }
        return pickEntryValue(entry, ['Namespace', 'namespace']) === namespaceOverride;
      });

    const targetEntry = pickTargetEntry(true) || pickTargetEntry(false);
    if (!targetEntry) {
      try {
        const deployment = await deployServiceFromCatalog({
          uaClient,
          serviceKey: 'fcom-processor',
          clusterName,
          namespaces,
          installedEntries: entries,
        });
        return res.json({
          success: true,
          deployed: true,
          message: 'FCOM Processor was not installed; deployed from catalog.',
          deployResult: deployment.deployResult,
        });
      } catch (deployError: any) {
        return res.status(404).json({
          error: 'FCOM Processor release not found',
          action: 'Deploy fcom-processor to continue',
          detail: deployError?.message || 'Catalog deployment fallback failed',
        });
      }
    }

    let deployResult: any;
    try {
      deployResult = await redeployInstalledEntry(
        uaClient,
        targetEntry,
        clusterName,
        namespaces,
        namespaceOverride,
      );
    } catch (error: any) {
      const message = error?.message || 'Failed to redeploy FCOM Processor';
      if (message.includes('Missing deploy id')) {
        return res.status(400).json({ error: 'Missing deploy id for FCOM Processor' });
      }
      if (message.includes('uninstall')) {
        return res.status(400).json({ error: 'Failed to uninstall FCOM Processor' });
      }
      if (message.includes('redeploy')) {
        return res.status(400).json({ error: 'Failed to redeploy FCOM Processor' });
      }
      if (message.toLowerCase().includes('socket hang up')) {
        return res.status(502).json({ error: 'Transient UA connection error during FCOM redeploy' });
      }
      return res.status(400).json({ error: message });
    }

    res.json({
      success: true,
      deployResult,
    });
  } catch (error: any) {
    logger.error(`FCOM redeploy error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to redeploy FCOM Processor' });
  }
});

router.post('/deploy-service', async (req: Request, res: Response) => {
  if (!(await requireEditPermission(req, res))) {
    return;
  }

  try {
    const serviceKey = String(req.body?.name || '').trim();
    if (!SERVICE_KEYS.has(serviceKey)) {
      return res.status(400).json({ error: 'Unsupported microservice' });
    }

    const uaClient = await getUaClientFromSession(req);
    const clusters = await uaClient.getMicroserviceClusters(0, 100);
    const clusterName = pickClusterName(clusters);
    if (!clusterName) {
      return res.status(400).json({ error: 'No clusters found' });
    }

    const namespacesResult = await uaClient.getClusterNamespaces(clusterName, 0, 200);
    const namespaces = pickNamespaceList(namespacesResult);
    if (namespaces.length === 0) {
      return res.status(400).json({ error: 'No namespaces found for cluster' });
    }

    const installedEntries = await fetchInstalledEntries(uaClient);
    const existingEntry = findMatch(installedEntries, [serviceKey], matchesTarget);
    if (existingEntry) {
      return res.json({ success: true, alreadyInstalled: true });
    }

    const catalogEntries = await fetchCatalogEntries(uaClient);
    const serviceHints = REQUIRED_CHAIN.find((entry) => entry.key === serviceKey)?.hints || [serviceKey];
    const catalogEntry = resolveCatalogEntry(
      catalogEntries,
      serviceHints.map((item) => item.toLowerCase()),
    );
    if (!catalogEntry) {
      return res.status(404).json({ error: 'Helm chart not found in catalog' });
    }

    const chartName = pickEntryValue(catalogEntry, ['name', 'Name', 'Helmchart', 'helmchart', 'chart', 'Chart']);
    const version = pickEntryValue(catalogEntry, ['version', 'Version']);
    if (!chartName || !version) {
      return res.status(400).json({ error: 'Missing catalog chart name or version' });
    }

    const namespace = resolveNamespace(serviceKey, installedEntries, namespaces);
    if (!namespace) {
      return res.status(400).json({ error: 'Unable to select namespace for deployment' });
    }

    const valuesResponse = await uaClient.getCatalogHelmChartValues(chartName, version);
    const customValues = extractCustomValues(valuesResponse);
    const payload = buildCatalogDeployPayload(clusterName, namespace, chartName, version, customValues);

    const missing = Object.entries(payload)
      .filter(([key, value]) => ['CustomValues'].indexOf(key) === -1 && !value)
      .map(([key]) => key);
    if (missing.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing required deploy fields: ${missing.join(', ')}` });
    }

    const deployResult = await uaClient.deployHelmChart(payload);
    if (!deployResult?.success) {
      return res.status(400).json({ error: 'Failed to deploy microservice' });
    }

    res.json({ success: true, deployResult });
  } catch (error: any) {
    logger.error(`Microservice deploy error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to deploy microservice' });
  }
});

router.post('/redeploy-service', async (req: Request, res: Response) => {
  if (!(await requireEditPermission(req, res))) {
    return;
  }

  try {
    const serviceKey = String(req.body?.name || '').trim();
    if (!SERVICE_KEYS.has(serviceKey)) {
      return res.status(400).json({ error: 'Unsupported microservice' });
    }

    const uaClient = await getUaClientFromSession(req);
    const clusters = await uaClient.getMicroserviceClusters(0, 100);
    const clusterName = pickClusterName(clusters);
    if (!clusterName) {
      return res.status(400).json({ error: 'No clusters found' });
    }

    const namespacesResult = await uaClient.getClusterNamespaces(clusterName, 0, 200);
    const namespaces = pickNamespaceList(namespacesResult);
    if (namespaces.length === 0) {
      return res.status(400).json({ error: 'No namespaces found for cluster' });
    }

    const installedEntries = await fetchInstalledEntries(uaClient);
    const targetEntry = findMatch(installedEntries, [serviceKey], matchesTarget);
    if (!targetEntry) {
      return res.status(404).json({ error: 'Microservice release not found' });
    }

    let deployResult: any;
    try {
      deployResult = await redeployInstalledEntry(uaClient, targetEntry, clusterName, namespaces);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Failed to redeploy microservice' });
    }

    res.json({ success: true, deployResult });
  } catch (error: any) {
    logger.error(`Microservice redeploy error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to redeploy microservice' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  const server = sessionId ? await getServer(sessionId) : null;
  const serverId = server?.server_id ?? null;
  const refresh = String(req.query?.refresh || '').trim() === '1';
  const cached = getCachedMicroserviceStatus();
  const pollMs = getMicroserviceStatusPollMs();
  const updatedAtMs = cached.updatedAt ? Date.parse(cached.updatedAt) : 0;
  const ageMs = updatedAtMs ? Date.now() - updatedAtMs : Number.MAX_SAFE_INTEGER;
  const isFresh = cached.data && ageMs < pollMs;
  const isSameServer = cached.serverId && serverId && cached.serverId === serverId;
  const preferSession = Boolean(sessionId) && cached.source === 'bootstrap';

  if (!refresh && cached.data && isFresh && isSameServer && !preferSession) {
    return res.json({
      ...cached.data,
      cache: {
        source: cached.source || 'cache',
        updatedAt: cached.updatedAt,
        lastAttemptAt: cached.lastAttemptAt,
        serverId: cached.serverId,
        ageSeconds: Math.floor(ageMs / 1000),
        stale: false,
        error: cached.error,
        refreshAttempted: false,
        refreshError: null,
      },
    });
  }

  try {
    const uaClient = await getUaClientFromSession(req);
    const data = await getMicroserviceStatus(uaClient);
    setCachedMicroserviceStatus(data, 'session', serverId);
    return res.json({
      ...data,
      cache: {
        source: 'session',
        updatedAt: data.updatedAt,
        lastAttemptAt: data.updatedAt,
        serverId,
        ageSeconds: 0,
        stale: false,
        error: null,
        refreshAttempted: refresh,
        refreshError: null,
      },
    });
  } catch (error: any) {
    logger.error(`Microservice status error: ${error.message}`);
    if (cached.data) {
      return res.json({
        ...cached.data,
        cache: {
          source: cached.source || 'cache',
          updatedAt: cached.updatedAt,
          lastAttemptAt: cached.lastAttemptAt,
          serverId: cached.serverId,
          ageSeconds: updatedAtMs ? Math.floor(ageMs / 1000) : null,
          stale: true,
          error: error.message || 'Failed to refresh microservice status',
          refreshAttempted: refresh,
          refreshError: error.message || 'Failed to refresh microservice status',
        },
      });
    }
    return res.status(500).json({ error: error.message || 'Failed to retrieve microservice status' });
  }
});

export default router;
