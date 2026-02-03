/**
 * Purpose: Verify vendor override files align with protocol folders in the UA rules path.
 * Usage: node dist/scripts/check_override_vendor_map.js (build required)
 * Notes: Requires UA_* env vars; supports UA_AUTH_METHOD=basic|certificate.
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
const OVERRIDE_SUFFIX = '.override.json';
const PAGE_LIMIT = Number(process.env.OVERRIDE_CHECK_PAGE_LIMIT || 500);

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

const buildUaConfig = (): UaConfig => {
  const auth_method = (process.env.UA_AUTH_METHOD || 'basic') as 'basic' | 'certificate';
  const hostname = process.env.UA_HOSTNAME || requireEnv('UA_HOSTNAME');
  const port = Number(process.env.UA_PORT || 443);
  const insecure_tls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';

  if (auth_method === 'basic') {
    return {
      hostname,
      port,
      auth_method,
      username: process.env.UA_USERNAME || requireEnv('UA_USERNAME'),
      password: process.env.UA_PASSWORD || requireEnv('UA_PASSWORD'),
      insecure_tls,
    };
  }

  return {
    hostname,
    port,
    auth_method,
    cert_path: process.env.UA_CERT_PATH || requireEnv('UA_CERT_PATH'),
    key_path: process.env.UA_KEY_PATH || requireEnv('UA_KEY_PATH'),
    ca_cert_path: process.env.UA_CA_PATH,
    insecure_tls,
  };
};

const normalizeVendor = (value: string) => value.trim().toLowerCase();

const getBaseName = (value: string) => {
  const cleaned = value.replace(/\\/g, '/');
  return path.posix.basename(cleaned);
};

const isFolderEntry = (entry: any) => {
  const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
  return !name.endsWith('.json');
};

const listDirectory = async (client: UAClient, node: string) => {
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

const main = async () => {
  const config = buildUaConfig();
  const client = new UAClient(config);
  const pathPrefix = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
  const primaryOverridesRoot = `${pathPrefix}/overrides`;
  const legacyOverridesRoot = pathPrefix.includes('/_objects')
    ? `${pathPrefix.replace('/_objects', '')}/overrides`
    : `${pathPrefix}/overrides`;
  const overrideRoots = Array.from(new Set([primaryOverridesRoot, legacyOverridesRoot]));

  const overrideVendors = new Map<string, { name: string; file: string; root: string }>();
  for (const overridesRoot of overrideRoots) {
    const overrideListing = await listDirectory(client, overridesRoot);
    overrideListing.forEach((entry) => {
      const rawName = String(entry?.PathName || entry?.PathID || '');
      const baseName = getBaseName(rawName);
      if (!baseName.toLowerCase().endsWith(OVERRIDE_SUFFIX)) {
        return;
      }
      const vendorName = baseName.replace(new RegExp(`${OVERRIDE_SUFFIX}$`, 'i'), '');
      overrideVendors.set(normalizeVendor(vendorName), { name: vendorName, file: baseName, root: overridesRoot });
    });
  }

  const protocolListing = await listDirectory(client, pathPrefix);
  const protocolFolders = protocolListing.filter((entry) => isFolderEntry(entry));
  const vendorToProtocols = new Map<string, Set<string>>();

  for (const protocolEntry of protocolFolders) {
    const protocolName = String(protocolEntry?.PathName || protocolEntry?.PathID || '').split('/').pop() || '';
    if (!protocolName || protocolName.toLowerCase() === 'overrides') {
      continue;
    }
    const protocolNode = String(protocolEntry?.PathID || `${pathPrefix}/${protocolName}`);
    const protocolContents = await listDirectory(client, protocolNode);
    for (const entry of protocolContents) {
      if (!isFolderEntry(entry)) {
        continue;
      }
      const vendorName = String(entry?.PathName || entry?.PathID || '');
      const key = normalizeVendor(vendorName);
      if (!vendorToProtocols.has(key)) {
        vendorToProtocols.set(key, new Set());
      }
      vendorToProtocols.get(key)!.add(protocolName);
    }
  }

  const unmatchedOverrides = Array.from(overrideVendors.entries())
    .filter(([key]) => !vendorToProtocols.has(key))
    .map(([, entry]) => entry);

  const matchedCount = Array.from(overrideVendors.keys()).filter((key) => vendorToProtocols.has(key)).length;

  // Output summary
  // eslint-disable-next-line no-console
  console.log(`Overrides folders: ${overrideRoots.join(', ')}`);
  // eslint-disable-next-line no-console
  console.log(`Override files found: ${overrideVendors.size}`);
  // eslint-disable-next-line no-console
  console.log(`Matched vendors: ${matchedCount}`);
  // eslint-disable-next-line no-console
  console.log(`Unmatched override vendors: ${unmatchedOverrides.length}`);

  if (unmatchedOverrides.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Unmatched override files:');
    unmatchedOverrides.forEach((entry) => {
      // eslint-disable-next-line no-console
      console.log(`- ${entry.name} (${entry.file}) in ${entry.root}`);
    });
  }
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exit(1);
});
