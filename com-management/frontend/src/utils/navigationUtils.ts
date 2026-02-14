import { ensureCorePrefix, normalizeRulesPath } from './pathUtils';

type NavigationAppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

type ResolveDeepLinkDeps = {
  fileId: string;
  nodeParam?: string | null;
  browsePath: string;
  readFile: (fileId: string) => Promise<{ data: any }>;
  browsePathFn: (path: string, filters: { node?: string }) => Promise<{ data: any }>;
  isFileReadPayload: (payload: any) => boolean;
  isFolder: (entry: any) => boolean;
};

const DEFAULT_FCOM_NODE = 'id-core/default/processing/event/fcom';
const DEFAULT_PCOM_NODE = 'id-core/default/collection/metric/snmp/_objects/pcom';

export const inferAppFromPath = (pathId?: string | null): 'fcom' | 'pcom' | 'mib' | null => {
  if (!pathId) {
    return null;
  }
  const normalized = `/${pathId}`.toLowerCase();
  if (normalized.includes('/fcom/')) {
    return 'fcom';
  }
  if (normalized.includes('/pcom/')) {
    return 'pcom';
  }
  if (normalized.includes('/mib/')) {
    return 'mib';
  }
  return null;
};

export const getDefaultBrowseNode = (app: NavigationAppTab) => {
  if (app === 'fcom') {
    return DEFAULT_FCOM_NODE;
  }
  if (app === 'pcom') {
    return DEFAULT_PCOM_NODE;
  }
  return null;
};

export const resolveDeepLinkFileId = async ({
  fileId,
  nodeParam,
  browsePath,
  readFile,
  browsePathFn,
  isFileReadPayload,
  isFolder,
}: ResolveDeepLinkDeps) => {
  const cleanedFile = normalizeRulesPath(fileId);
  if (!cleanedFile) {
    return null;
  }
  const fileName = cleanedFile.split('/').pop() || cleanedFile;
  const parentFromFile = cleanedFile.split('/').slice(0, -1).join('/');
  const nodeCandidates = new Set<string>();
  if (nodeParam) {
    nodeCandidates.add(normalizeRulesPath(nodeParam));
  }
  if (parentFromFile) {
    nodeCandidates.add(parentFromFile);
  }
  Array.from(nodeCandidates).forEach((node) => {
    const normalized = ensureCorePrefix(node);
    if (normalized) {
      nodeCandidates.add(normalized);
    }
  });

  const fileNameLower = fileName.toLowerCase();
  const fileCandidates = new Set<string>();
  fileCandidates.add(cleanedFile);
  const prefixed = ensureCorePrefix(cleanedFile);
  if (prefixed) {
    fileCandidates.add(prefixed);
  }
  if (cleanedFile.startsWith('id-core/')) {
    fileCandidates.add(cleanedFile.replace(/^id-core\//, ''));
  }

  for (const candidate of fileCandidates) {
    try {
      const resp = await readFile(candidate);
      if (isFileReadPayload(resp.data)) {
        return candidate;
      }
    } catch {
      // ignore read failures, try next candidate
    }
  }
  for (const node of nodeCandidates) {
    const normalizedNode = ensureCorePrefix(node);
    if (!normalizedNode) {
      continue;
    }
    try {
      const resp = await browsePathFn(browsePath, { node: normalizedNode });
      const items = Array.isArray(resp.data?.data) ? resp.data.data : [];
      const match = items.find((entry: any) => {
        if (!entry || isFolder(entry)) {
          return false;
        }
        const pathName = String(entry?.PathName || '').toLowerCase();
        const pathId = String(entry?.PathID || '').toLowerCase();
        return pathName === fileNameLower || pathId.endsWith(`/${fileNameLower}`);
      });
      if (match?.PathID) {
        return String(match.PathID);
      }
    } catch {
      // ignore browse resolution errors
    }
  }

  return ensureCorePrefix(cleanedFile) || cleanedFile;
};
