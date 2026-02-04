/**
 * Purpose: Debug override review by scanning override files and counting overrides per file.
 * Usage:
 *   UA_HOSTNAME=... UA_USERNAME=... UA_PASSWORD=... \
 *   COMS_PATH_PREFIX=id-core/default/processing/event/fcom/_objects \
 *   tsx scripts/override_review_harness.ts
 * Notes:
 * - Uses UA REST API via UAClient.
 * - Outputs per-file counts and summary diagnostics.
 */
import dotenv from 'dotenv';
import path from 'path';
import { UAClient } from '../src/services/ua';

dotenv.config();

type UaConfig = {
  hostname: string;
  port: number;
  auth_method: 'basic' | 'certificate';
  username?: string;
  password?: string;
  cert_path?: string;
  key_path?: string;
  ca_cert_path?: string;
  insecure_tls?: boolean;
};

const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PAGE_LIMIT = Number(process.env.OVERRIDE_REVIEW_PAGE_LIMIT || 500);
const OVERRIDE_SUFFIX = '.override.json';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

const uaConfig: UaConfig = {
  hostname: requireEnv('UA_HOSTNAME'),
  port: Number(process.env.UA_PORT || process.env.UA_DEFAULT_PORT || 443),
  auth_method: (process.env.UA_AUTH_METHOD || 'basic') as 'basic' | 'certificate',
  username: process.env.UA_USERNAME,
  password: process.env.UA_PASSWORD,
  cert_path: process.env.UA_TLS_CERT_PATH || process.env.UA_CERT_PATH,
  key_path: process.env.UA_TLS_KEY_PATH || process.env.UA_KEY_PATH,
  ca_cert_path: process.env.UA_TLS_CA_PATH || process.env.UA_CA_PATH,
  insecure_tls: (process.env.UA_TLS_INSECURE || 'false').toLowerCase() === 'true',
};

const client = new UAClient(uaConfig);

const normalizePathString = (value: string) => (
  path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\/+/, '')
);

const extractRuleText = (data: any) => (
  data?.content?.data?.[0]?.RuleText
  ?? data?.data?.[0]?.RuleText
  ?? data?.RuleText
  ?? data
);

const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return { overrides: [], format: 'array' as const };
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { overrides: parsed, format: 'array' as const };
  }
  if (parsed && typeof parsed === 'object') {
    return { overrides: [parsed], format: 'object' as const };
  }
  throw new Error('Override file must be a JSON array or object at the root');
};

const getProcessorTargetField = (processor: any) => {
  if (!processor || typeof processor !== 'object') {
    return null;
  }
  const keys = [
    'add',
    'drop',
    'tag',
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
      collectOverrideTargets(Array.isArray(payload.processors) ? payload.processors : [], objectName, targetKeys);
      collectOverrideTargets(Array.isArray(payload.else) ? payload.else : [], objectName, targetKeys);
    }
    if (processor.foreach?.processors) {
      collectOverrideTargets(Array.isArray(processor.foreach.processors) ? processor.foreach.processors : [], objectName, targetKeys);
    }
    if (Array.isArray(processor.switch?.case)) {
      processor.switch.case.forEach((entry: any) => {
        collectOverrideTargets(
          Array.isArray(entry?.then) ? entry.then : Array.isArray(entry?.processors) ? entry.processors : [],
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

const listDirectory = async (node: string) => {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const response = await client.listRules('/', PAGE_LIMIT, node, true, start);
    const data = Array.isArray(response?.data) ? response.data : [];
    if (data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < PAGE_LIMIT) {
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

const main = async () => {
  const pathPrefix = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
  const primaryOverridesRoot = `${pathPrefix}/overrides`;
  const legacyOverridesRoot = pathPrefix.includes('/_objects')
    ? `${pathPrefix.replace('/_objects', '')}/overrides`
    : `${pathPrefix}/overrides`;
  const overrideRoots = Array.from(new Set([primaryOverridesRoot, legacyOverridesRoot]));

  const results: Array<{
    file: string;
    root: string;
    overrides: number;
    objectNames: number;
    targetFields: number;
    format: string;
    error?: string;
  }> = [];

  const errors: Array<{ file: string; error: string }> = [];

  for (const overridesRoot of overrideRoots) {
    const overrideListing = await listDirectoryRecursive(overridesRoot);
    const overridesRootNormalized = normalizePathString(overridesRoot);
    const overrideFiles = overrideListing.filter((entry) => {
      const fileName = normalizePathString(String(entry?.PathName || entry?.PathID || ''));
      return fileName && path.posix.basename(fileName).toLowerCase().endsWith(OVERRIDE_SUFFIX);
    });

    for (const overrideEntry of overrideFiles) {
      const fileName = normalizePathString(String(overrideEntry?.PathName || overrideEntry?.PathID || ''));
      const pathId = String(overrideEntry?.PathID || fileName);
      if (!fileName) {
        continue;
      }
      const relative = path.posix.relative(overridesRootNormalized, fileName);
      if (!relative || relative.startsWith('..')) {
        continue;
      }
      try {
        const response = await client.readRule(pathId);
        const raw = extractRuleText(response);
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
        const parsed = parseOverridePayload(text);
        const overrides = parsed.overrides;
        const objectNames = new Set<string>();
        const targetKeys = new Set<string>();
        overrides.forEach((entry: any) => {
          const objectName = entry?.['@objectName'] || '__global__';
          objectNames.add(objectName);
          const processors = Array.isArray(entry?.processors) ? entry.processors : [];
          collectOverrideTargets(processors, objectName, targetKeys);
        });
        results.push({
          file: fileName,
          root: overridesRoot,
          overrides: overrides.length,
          objectNames: objectNames.size,
          targetFields: targetKeys.size,
          format: parsed.format,
        });
      } catch (error: any) {
        const message = error?.message || String(error);
        errors.push({ file: fileName, error: message });
        results.push({
          file: fileName,
          root: overridesRoot,
          overrides: 0,
          objectNames: 0,
          targetFields: 0,
          format: 'error',
          error: message,
        });
      }
    }
  }

  const summary = {
    overrideRoots,
    overrideFiles: results.length,
    parseErrors: errors.length,
    totalOverrides: results.reduce((sum, row) => sum + row.overrides, 0),
    totalTargetFields: results.reduce((sum, row) => sum + row.targetFields, 0),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ summary, results, errors }, null, 2));
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Override review harness failed:', error?.message || error);
  process.exit(1);
});
