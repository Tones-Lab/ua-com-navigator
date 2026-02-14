export type BreadcrumbItem = { label: string; node: string | null };

export const normalizePathId = (pathId?: string | null) =>
  pathId ? pathId.replace(/^\/+/, '') : '';

export const normalizeRulesPath = (pathId?: string | null) => {
  const cleaned = normalizePathId(pathId);
  if (!cleaned) {
    return '';
  }
  if (cleaned.startsWith('id-core/rules/')) {
    return `id-core/${cleaned.slice('id-core/rules/'.length)}`;
  }
  if (cleaned.startsWith('rules/')) {
    return `id-core/${cleaned.slice('rules/'.length)}`;
  }
  return cleaned;
};

export const ensureCorePrefix = (pathId?: string | null) => {
  const normalized = normalizeRulesPath(pathId);
  if (!normalized) {
    return '';
  }
  if (normalized.startsWith('id-')) {
    return normalized;
  }
  return normalized;
};

export const formatRelativeAge = (timestamp?: string | null) => {
  if (!timestamp) {
    return '—';
  }
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return '—';
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const formatDisplayPath = (pathId?: string | null) => {
  if (!pathId) {
    return '/';
  }
  const cleaned = pathId.replace(/^\/+/, '');
  if (!cleaned) {
    return '/';
  }
  const segments = cleaned.split('/');
  if (segments[0]?.startsWith('id-')) {
    segments[0] = segments[0].replace(/^id-/, '');
  }
  return `/${segments.join('/')}`;
};

export const getVendorFromPath = (pathId?: string | null) => {
  if (!pathId) {
    return '';
  }
  const parts = pathId.replace(/^\/+/, '').split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    return '';
  }
  const methodIndex = parts.findIndex(
    (segment, idx) => idx > fcomIndex && (segment === 'trap' || segment === 'syslog'),
  );
  const vendorIndex = methodIndex !== -1 ? methodIndex + 1 : fcomIndex + 1;
  return parts[vendorIndex] || '';
};

export const buildBreadcrumbsFromNode = (node: string | null): BreadcrumbItem[] => {
  if (!node) {
    return [{ label: '/', node: null }];
  }
  const segments = node.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [{ label: '/', node: null }];
  let acc = '';
  segments.forEach((segment, index) => {
    acc = acc ? `${acc}/${segment}` : segment;
    const label =
      index === 0 && segment.startsWith('id-') ? segment.replace(/^id-/, '') : segment;
    crumbs.push({ label, node: acc });
  });
  return crumbs;
};

export const buildBreadcrumbsFromPath = (pathId: string): BreadcrumbItem[] =>
  buildBreadcrumbsFromNode(pathId || null);
