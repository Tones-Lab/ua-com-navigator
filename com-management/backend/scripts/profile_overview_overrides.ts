import path from 'path';
import { UAClient } from '../src/services/ua';

const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const OVERRIDE_SUFFIX = '.override.json';
const PAGE_LIMIT = Number(process.env.OVERVIEW_PAGE_LIMIT || 500);

const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const uaClient = new UAClient({
  hostname: requiredEnv('UA_HOSTNAME'),
  port: Number(process.env.UA_PORT || process.env.UA_DEFAULT_PORT || 443),
  auth_method: (process.env.UA_AUTH_METHOD || 'basic') as 'basic' | 'certificate',
  username: process.env.UA_USERNAME,
  password: process.env.UA_PASSWORD,
  cert_path: process.env.UA_TLS_CERT_PATH || process.env.UA_CERT_PATH,
  key_path: process.env.UA_TLS_KEY_PATH || process.env.UA_KEY_PATH,
  ca_cert_path: process.env.UA_TLS_CA_PATH || process.env.UA_CA_PATH,
  insecure_tls: (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true',
});

const normalizePathString = (value: string) =>
  path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\/+/, '');

const overridesRoot = PATH_PREFIX.includes('/_objects')
  ? `${PATH_PREFIX.replace('/_objects', '')}/overrides`
  : `${PATH_PREFIX}/overrides`;

const timings = {
  listCalls: 0,
  listMs: 0,
  readCalls: 0,
  readMs: 0,
};

const listDirectory = async (node: string) => {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const t0 = Date.now();
    const response = await uaClient.listRules('/', PAGE_LIMIT, node, true, start);
    timings.listCalls += 1;
    timings.listMs += Date.now() - t0;
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

const extractRuleText = (data: any) =>
  data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;

const main = async () => {
  const start = Date.now();
  const overrideListing = await listDirectoryRecursive(overridesRoot);
  const overridesRootNormalized = normalizePathString(overridesRoot);
  const overrideFiles = overrideListing.filter((entry) => {
    const fileName = normalizePathString(String(entry?.PathName || entry?.PathID || ''));
    if (!fileName) {
      return false;
    }
    return path.posix.basename(fileName).toLowerCase().endsWith(OVERRIDE_SUFFIX);
  });

  for (const overrideEntry of overrideFiles) {
    const fileName = normalizePathString(
      String(overrideEntry?.PathName || overrideEntry?.PathID || ''),
    );
    if (!fileName) {
      continue;
    }
    const relative = path.posix.relative(overridesRootNormalized, fileName);
    if (!relative || relative.startsWith('..')) {
      continue;
    }
    const t0 = Date.now();
    const response = await uaClient.readRule(String(overrideEntry?.PathID || fileName));
    void extractRuleText(response);
    timings.readCalls += 1;
    timings.readMs += Date.now() - t0;
  }

  const totalMs = Date.now() - start;
  const avgList = timings.listCalls ? Math.round(timings.listMs / timings.listCalls) : 0;
  const avgRead = timings.readCalls ? Math.round(timings.readMs / timings.readCalls) : 0;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        overridesRoot,
        overrideFiles: overrideFiles.length,
        listCalls: timings.listCalls,
        listMs: timings.listMs,
        avgListMs: avgList,
        readCalls: timings.readCalls,
        readMs: timings.readMs,
        avgReadMs: avgRead,
        totalMs,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error?.message || error);
  process.exit(1);
});
