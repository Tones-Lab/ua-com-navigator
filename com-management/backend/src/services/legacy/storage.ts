import fs from 'fs';
import path from 'path';

export type LegacyUploadEntry = {
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt: string;
};

const defaultLegacyUploadRoot = () =>
  path.resolve(process.cwd(), '..', '..', 'rules', 'legacy', 'uploads');

export const getLegacyUploadRoot = () =>
  process.env.LEGACY_UPLOAD_DIR ? path.resolve(process.env.LEGACY_UPLOAD_DIR) : defaultLegacyUploadRoot();

export const ensureLegacyUploadRoot = () => {
  const root = getLegacyUploadRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
};

export const resolveLegacyPath = (relativePath: string) => {
  const root = getLegacyUploadRoot();
  const normalized = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(root)) {
    throw new Error('Invalid legacy upload path.');
  }
  return resolved;
};

export const listLegacyEntries = (root: string) => {
  const entries: LegacyUploadEntry[] = [];
  const walk = (current: string) => {
    const stat = fs.statSync(current);
    const relative = path.relative(root, current) || '.';
    if (stat.isDirectory()) {
      if (relative !== '.') {
        entries.push({
          path: relative,
          type: 'folder',
          size: 0,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
      fs.readdirSync(current).forEach((child) => walk(path.join(current, child)));
      return;
    }
    entries.push({
      path: relative,
      type: 'file',
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  };

  if (fs.existsSync(root)) {
    walk(root);
  }

  return entries;
};

export const sanitizeLegacySubdir = (value: string) => {
  const trimmed = value.trim().replace(/^\/+/, '');
  if (!trimmed) {
    return '';
  }
  const normalized = path.normalize(trimmed);
  if (normalized.startsWith('..') || path.isAbsolute(normalized) || normalized.includes('..')) {
    throw new Error('Invalid legacy upload subdirectory.');
  }
  return normalized;
};
