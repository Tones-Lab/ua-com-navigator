/**
 * @file Manages FCOM/PCOM override logic.
 *
 * This service will be responsible for the business logic of reading,
 * applying, and writing override files. It will use the domain model
 * to provide a clean, abstract interface for override operations.
 */

export const normalizeOverrideSegment = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/::/g, '.')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^-+|-+$/g, '')
    .replace(/^\.+|\.+$/g, '');

export const splitObjectName = (objectName: string) => {
  const [mib, obj] = String(objectName || '').split('::');
  return {
    mib: mib || 'unknown',
    object: obj || mib || 'object',
  };
};

const normalizeOverridePath = (pathValue: string) =>
  String(pathValue || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

export const resolveOverrideLocation = (fileId: string) => {
  const normalized = normalizeOverridePath(fileId);
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    throw new Error('File path does not include fcom');
  }

  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  const methodIndex = parts.findIndex(
    (segment, idx) => idx > fcomIndex && (segment === 'trap' || segment === 'syslog'),
  );
  const method = methodIndex !== -1 ? parts[methodIndex] : undefined;
  const vendor = methodIndex !== -1 ? parts[methodIndex + 1] : parts[fcomIndex + 1];

  if (!vendor) {
    throw new Error('Unable to resolve vendor from file path');
  }

  const overrideRoot = `${basePath}/overrides`;
  const overrideFileName = `${vendor}.override.json`;
  const overridePath = `${overrideRoot}/${overrideFileName}`;

  return {
    basePath,
    vendor,
    method,
    overrideRoot,
    overrideFileName,
    overridePath,
  };
};

export const buildOverrideFileName = (vendor: string, objectName: string) => {
  const { mib, object } = splitObjectName(objectName);
  const vendorPart = normalizeOverrideSegment(vendor) || 'vendor';
  const mibPart = normalizeOverrideSegment(mib) || 'mib';
  const objectPart = normalizeOverrideSegment(object) || 'object';
  return `${vendorPart}.${mibPart}.${objectPart}.override.json`;
};

export const buildLegacyOverrideFileNames = (vendor: string, method?: string | null) => {
  const vendorPart = normalizeOverrideSegment(vendor) || 'vendor';
  const methodPart = method ? normalizeOverrideSegment(method) : '';
  const names = [`${vendorPart}.override.json`];
  if (methodPart) {
    names.unshift(`${vendorPart}.${methodPart}.override.json`);
  }
  return Array.from(new Set(names));
};

export const extractRuleText = (data: any) => {
  const ruleText =
    data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;
  return typeof ruleText === 'string' ? ruleText : JSON.stringify(ruleText ?? []);
};

export const buildRuleTextDiagnostics = (data: any) => {
  const ruleText =
    data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText;
  const responseKeys = data && typeof data === 'object' ? Object.keys(data) : [];
  return {
    responseKeys,
    hasRuleText: typeof ruleText === 'string',
    ruleTextType: typeof ruleText,
  };
};

export const isOverrideEntry = (entry: any) =>
  entry && typeof entry === 'object' && String(entry._type || '').toLowerCase() === 'override';

export const isLikelyListResponse = (data: any) => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!Array.isArray(data?.data)) {
    return false;
  }
  const hasMessage = typeof data?.message === 'string' || typeof data?.Message === 'string';
  const hasSuccess = typeof data?.success === 'boolean' || typeof data?.Success === 'boolean';
  return hasMessage || hasSuccess;
};

export const isValidOverridePayload = (payload: any) => {
  if (Array.isArray(payload)) {
    return payload.every(isOverrideEntry);
  }
  return isOverrideEntry(payload);
};

export const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return { overrides: [], format: 'object' as const };
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { overrides: parsed, format: 'array' as const };
  }
  if (parsed && typeof parsed === 'object') {
    if (Object.keys(parsed).length === 0) {
      return { overrides: [], format: 'object' as const };
    }
    return { overrides: [parsed], format: 'object' as const };
  }
  throw new Error('Override file must be a JSON array or object at the root');
};

export const extractRuleObjects = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return [] as any[];
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed?.objects)) {
    return parsed.objects;
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }
  return [] as any[];
};

export const isPatchOperation = (processor: any) => {
  const op = processor?.op;
  const path = processor?.path;
  if (!op || !path) {
    return false;
  }
  const allowed = new Set(['add', 'replace', 'test', 'remove', 'move', 'copy']);
  return typeof op === 'string' && allowed.has(op) && typeof path === 'string';
};

export const normalizeOverrideEntry = (entry: any, objectName: string, method: string) => ({
  name: entry?.name || `${objectName} Override`,
  description: entry?.description || `Overrides for ${objectName}`,
  domain: entry?.domain || 'fault',
  method: entry?.method || method || 'trap',
  scope: entry?.scope || 'post',
  '@objectName': objectName,
  _type: 'override',
  processors: Array.isArray(entry?.processors) ? entry.processors : [],
});

export const parseRevisionName = (revisionName: string) => {
  const revisionMatch = revisionName.match(/r(\d+)/i);
  const bracketMatches = revisionName.match(/\[([^\]]+)\]/g) || [];
  const bracketValues = bracketMatches.map((entry) => entry.replace(/[\[\]]/g, '').trim());
  return {
    revision: revisionMatch ? revisionMatch[1] : undefined,
    date: bracketValues.length > 0 ? bracketValues[0] : undefined,
    user: bracketValues.length > 1 ? bracketValues[1] : undefined,
  };
};

export const isMissingRule = (error: any) => {
  const status = error?.response?.status;
  if (status === 404) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  return message.includes('not found');
};

export const extractHistoryEntries = (history: any) => {
  if (Array.isArray(history?.data)) {
    return history.data;
  }
  if (Array.isArray(history?.history)) {
    return history.history;
  }
  if (Array.isArray(history?.entries)) {
    return history.entries;
  }
  if (Array.isArray(history)) {
    return history;
  }
  return [];
};

export const buildOverrideMetaFromHistory = (history: any, resolved: any) => {
  const entries = extractHistoryEntries(history);
  const latest = entries[0];
  if (!latest) {
    return null;
  }
  return {
    pathId: resolved.overridePath,
    pathName: resolved.overrideFileName,
    revision:
      latest.LastRevision ?? latest.Revision ?? latest.Rev ?? latest.revision ?? latest.commit_id,
    modified:
      latest.ModificationTime ??
      latest.LastModified ??
      latest.Modified ??
      latest.Date ??
      latest.date ??
      latest.timestamp,
    modifiedBy:
      latest.ModifiedBy ??
      latest.LastModifiedBy ??
      latest.Modifier ??
      latest.User ??
      latest.Author ??
      latest.author ??
      latest.username ??
      latest.user,
  };
};

export const mergeOverrideMeta = (base: any, next: any) => {
  if (!next) {
    return base;
  }
  if (!base) {
    return next;
  }
  return {
    ...next,
    ...base,
    revision: base.revision ?? next.revision,
    modified: base.modified ?? next.modified,
    modifiedBy: base.modifiedBy ?? next.modifiedBy,
  };
};


