/**
 * Purpose: Fetch CastleRock v3 overrides and emit a best-effort v2 equivalent.
 * Usage:
 *   UA_HOSTNAME=... UA_USERNAME=... UA_PASSWORD=... \
 *   OVERRIDE_NODE=core/default/processing/event/fcom/overrides \
 *   tsx scripts/override_castlerock_v3_to_v2.ts
 * Notes:
 *   - Defaults to admin/admin if UA_USERNAME/UA_PASSWORD are not provided.
 *   - Prints converted v2 override JSON to stdout.
 */
import dotenv from 'dotenv';
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
  username: process.env.UA_USERNAME || 'admin',
  password: process.env.UA_PASSWORD || 'admin',
  cert_path: process.env.UA_TLS_CERT_PATH || process.env.UA_CERT_PATH,
  key_path: process.env.UA_TLS_KEY_PATH || process.env.UA_KEY_PATH,
  ca_cert_path: process.env.UA_TLS_CA_PATH || process.env.UA_CA_PATH,
  insecure_tls: (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true',
};

const overrideNode = process.env.OVERRIDE_NODE || 'core/default/processing/event/fcom/overrides';

const client = new UAClient(uaConfig);

const extractRuleText = (data: any) =>
  data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;

const parseOverridePayload = (ruleText: string) => {
  const trimmed = ruleText.trim();
  if (!trimmed) {
    return [] as any[];
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    if (Object.keys(parsed).length === 0) {
      return [] as any[];
    }
    return [parsed];
  }
  return [] as any[];
};

const getEntryPath = (entry: any) =>
  entry?.PathID || entry?.PathName || entry?.Path || entry?.path || entry?.name || '';

const decodePointerSegment = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

const jsonPointerToEventField = (path: string) => {
  const normalized = path.startsWith('#') ? path.slice(1) : path;
  if (!normalized.startsWith('/event/')) {
    return null;
  }
  const parts = normalized
    .split('/')
    .slice(2)
    .map(decodePointerSegment)
    .filter(Boolean);
  if (!parts.length) {
    return null;
  }
  return `$.event.${parts.join('.')}`;
};

const isProcessorObject = (value: any) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }
  const known = new Set([
    'append',
    'convert',
    'copy',
    'date',
    'discard',
    'foreach',
    'grok',
    'if',
    'interpolate',
    'kv',
    'length',
    'log',
    'lookup',
    'math',
    'regex',
    'remove',
    'rename',
    'replace',
    'set',
    'setOutputStream',
    'sort',
    'split',
    'strcase',
    'substr',
    'switch',
    'trim',
  ]);
  return known.has(keys[0]);
};

const convertPatchOpsToV2Processors = (ops: any[]) => {
  const processors: any[] = [];
  const skipped: string[] = [];

  for (const op of ops || []) {
    if (!op || typeof op !== 'object') {
      continue;
    }
    const operation = op.op;
    const path = typeof op.path === 'string' ? op.path : '';

    if ((operation === 'add' || operation === 'replace') && isProcessorObject(op.value)) {
      processors.push(op.value);
      continue;
    }

    if ((operation === 'add' || operation === 'replace') && path.startsWith('/event/')) {
      const targetField = jsonPointerToEventField(path);
      if (targetField) {
        processors.push({
          set: {
            source: op.value,
            targetField,
          },
        });
        continue;
      }
    }

    skipped.push(JSON.stringify(op));
  }

  return { processors, skipped };
};

const main = async () => {
  if (!process.env.UA_USERNAME || !process.env.UA_PASSWORD) {
    console.warn('UA_USERNAME/UA_PASSWORD not set. Using default admin/admin.');
  }

  const listResp = await client.listRules('/', 5000, overrideNode, true);
  const entries = Array.isArray(listResp?.data) ? listResp.data : [];

  const castleRockEntries = entries.filter((entry) =>
    getEntryPath(entry).toLowerCase().includes('castlerock'),
  );

  if (!castleRockEntries.length) {
    console.log(`No CastleRock override files found under node: ${overrideNode}`);
    return;
  }

  for (const entry of castleRockEntries) {
    const path = getEntryPath(entry);
    if (!path) {
      continue;
    }

    const readResp = await client.readRule(path, 'HEAD');
    const raw = extractRuleText(readResp);
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
    const overrides = parseOverridePayload(text);

    const v3Overrides = overrides.filter((override) => override?.version === 'v3');
    if (!v3Overrides.length) {
      continue;
    }

    const target = v3Overrides[0];
    const { processors, skipped } = convertPatchOpsToV2Processors(target.processors || []);

    const v2Override = {
      name: `${target.name || 'CastleRock Override'} (v2 copy)`,
      description: target.description || 'Converted from v3 override for UI testing',
      domain: target.domain || 'fault',
      method: target.method || 'trap',
      scope: target.scope || 'post',
      '@objectName': target['@objectName'] || 'GLOBAL',
      _type: 'override',
      version: 'v2',
      processors,
    };

    console.log(`Source v3 override: ${path}`);
    if (skipped.length) {
      console.log(`Skipped ${skipped.length} patch ops (could not convert):`);
      skipped.forEach((entryText) => console.log(`  - ${entryText}`));
    }

    console.log('\nConverted v2 override JSON:');
    console.log(JSON.stringify(v2Override, null, 2));
    return;
  }

  console.log('No v3 CastleRock overrides found to convert.');
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
