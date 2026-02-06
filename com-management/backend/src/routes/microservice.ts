import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer, getSession } from '../services/sessionStore';

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
  return match ? String(match) : undefined;
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

const matchesTarget = (entry: Record<string, any>, target: string): boolean => {
  const candidates = [
    pickEntryValue(entry, ['ReleaseName', 'releaseName', 'release_name']),
    pickEntryValue(entry, ['Helmchart', 'helmchart', 'chart', 'chartName', 'helmChart']),
    pickEntryValue(entry, ['Name', 'name']),
  ].filter(Boolean);
  return candidates.some((value) => value.toLowerCase().includes(target));
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

const buildDeployId = (target: { name: string; namespace: string; cluster: string }) => {
  if (!target.name || !target.namespace || !target.cluster) {
    return '';
  }
  return `id-${target.name}-=-${target.namespace}-=-${target.cluster}`;
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

    const installed = await uaClient.getInstalledHelmCharts(1, 0, 25);
    const entries = extractInstalledEntries(installed);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No installed Helm charts found' });
    }

    const targetName = (
      process.env.FCOM_PROCESSOR_RELEASE_NAME ||
      process.env.FCOM_PROCESSOR_HELM_CHART ||
      'fcom-processor'
    ).toLowerCase();

    const targetEntry = entries.find((entry) => {
      if (!matchesTarget(entry, targetName)) {
        return false;
      }
      if (!namespaceOverride) {
        return true;
      }
      return pickEntryValue(entry, ['Namespace', 'namespace']) === namespaceOverride;
    });
    if (!targetEntry) {
      return res.status(404).json({
        error: 'FCOM Processor release not found',
        action: 'Deploy fcom-processor to continue',
      });
    }

    const targetMeta = getTargetMeta(targetEntry);
    if (!targetMeta.cluster) {
      targetMeta.cluster = clusterName;
    }
    if (namespaceOverride) {
      targetMeta.namespace = namespaceOverride;
    }
    if (!targetMeta.namespace || !namespaces.includes(targetMeta.namespace)) {
      return res.status(400).json({ error: 'Installed chart namespace not found in cluster namespaces' });
    }
    const deployId = buildDeployId({
      name: targetMeta.name,
      namespace: targetMeta.namespace,
      cluster: targetMeta.cluster,
    });
    if (!deployId) {
      return res.status(400).json({ error: 'Missing deploy id for FCOM Processor' });
    }

    let customValues: string | undefined;
    try {
      const valuesResponse = await uaClient.getHelmChartValues({
        cluster: targetMeta.cluster,
        namespace: targetMeta.namespace,
        helmchart: targetMeta.chartName || targetMeta.chartRaw,
        releaseName: targetMeta.name,
        version: targetMeta.chartVersion,
      });
      customValues = extractCustomValues(valuesResponse);
    } catch (error: any) {
      logger.warn(`FCOM redeploy values lookup failed: ${error?.message || 'unknown error'}`);
    }
    if (!customValues) {
      return res.status(400).json({
        error: 'Missing CustomValues for FCOM Processor',
      });
    }

    const payload: {
      Cluster: string;
      Namespace: string;
      Helmchart: string;
      ReleaseName: string;
      Version: string;
      CustomValues?: string;
    } = {
      Cluster: pickEntryValue(targetEntry, ['Cluster', 'cluster']),
      Namespace: pickEntryValue(targetEntry, ['Namespace', 'namespace']),
      Helmchart: targetMeta.chartName || targetMeta.chartRaw,
      ReleaseName: pickEntryValue(targetEntry, [
        'ReleaseName',
        'releaseName',
        'release_name',
        'name',
      ]),
      Version:
        targetMeta.chartVersion ||
        pickEntryValue(targetEntry, ['Version', 'version', 'chartVersion', 'revision']),
      CustomValues: customValues,
    };

    const missing = Object.entries(payload)
      .filter(([key, value]) => ['CustomValues'].indexOf(key) === -1 && !value)
      .map(([key]) => key);
    if (missing.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing required deploy fields: ${missing.join(', ')}` });
    }

    const deleteResult = await uaClient.uninstallHelmChart(deployId);
    if (!deleteResult?.success) {
      return res.status(400).json({ error: 'Failed to uninstall FCOM Processor' });
    }

    const deployResult = await uaClient.deployHelmChart(payload);
    if (!deployResult?.success) {
      return res.status(400).json({ error: 'Failed to redeploy FCOM Processor' });
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

export default router;
