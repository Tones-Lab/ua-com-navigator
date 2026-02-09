/**
 * Purpose: List override files and show which contain v3 override objects.
 * Usage:
 *   UA_HOSTNAME=... UA_USERNAME=... UA_PASSWORD=... \
 *   OVERRIDE_NODE=core/default/processing/event/fcom/overrides \
 *   tsx scripts/override_list_v3.ts
 * Notes:
 *   - Uses basic or certificate auth based on UA_AUTH_METHOD.
 *   - OVERRIDE_NODE defaults to core/default/processing/event/fcom/overrides.
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
  username: process.env.UA_USERNAME,
  password: process.env.UA_PASSWORD,
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

const main = async () => {
  const listResp = await client.listRules('/', 5000, overrideNode, true);
  const entries = Array.isArray(listResp?.data) ? listResp.data : [];

  if (!entries.length) {
    console.log(`No override files found under node: ${overrideNode}`);
    return;
  }

  let v3FileCount = 0;
  let v3ObjectCount = 0;

  for (const entry of entries) {
    const path = getEntryPath(entry);
    if (!path) {
      continue;
    }

    const readResp = await client.readRule(path, 'HEAD');
    const raw = extractRuleText(readResp);
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
    const overrides = parseOverridePayload(text);

    const v3Objects = overrides.filter((override) => override?.version === 'v3');
    if (v3Objects.length > 0) {
      v3FileCount += 1;
      v3ObjectCount += v3Objects.length;
      const objectNames = v3Objects
        .map((override) => override?.['@objectName'])
        .filter(Boolean)
        .join(', ');
      console.log(`v3: ${path}${objectNames ? ` (objects: ${objectNames})` : ''}`);
    }
  }

  console.log(`\nSummary: ${v3FileCount} files with v3 overrides, ${v3ObjectCount} v3 objects.`);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
