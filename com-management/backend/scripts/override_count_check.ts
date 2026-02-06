/**
 * Purpose: Check override target counts for a specific override file.
 * Usage:
 *   UA_HOSTNAME=... UA_USERNAME=... UA_PASSWORD=... \
 *   OVERRIDE_PATH=id-core/default/processing/event/fcom/overrides/CastleRock.trap.override.json \
 *   tsx scripts/override_count_check.ts
 * Notes: Requires UA_* env vars and OVERRIDE_PATH.
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

const overridePath = requireEnv('OVERRIDE_PATH');

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

const decodeJsonPointerSegment = (segment: string) =>
  segment.replace(/~1/g, '/').replace(/~0/g, '~');

const getJsonPointerEventPath = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  if (!normalized.startsWith('/event')) {
    return null;
  }
  const remainder = normalized.slice('/event'.length);
  if (!remainder) {
    return '$.event';
  }
  const parts = remainder
    .split('/')
    .filter(Boolean)
    .map(decodeJsonPointerSegment);
  if (parts.length === 0) {
    return '$.event';
  }
  return `$.event.${parts.join('.')}`;
};

const getProcessorTargetField = (processor: any) => {
  if (!processor || typeof processor !== 'object') {
    return null;
  }
  const keys = [
    'set',
    'copy',
    'replace',
    'convert',
    'eval',
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

const collectOverrideTargets = (processors: any[], objectName: string, targetKeys: Set<string>) => {
  (processors || []).forEach((processor: any) => {
    if (!processor || typeof processor !== 'object') {
      return;
    }
    const patchTarget = getJsonPointerEventPath(processor?.path);
    if (patchTarget) {
      targetKeys.add(`${objectName}::${patchTarget}`);
    }
    if (processor.if) {
      const payload = processor.if;
      collectOverrideTargets(
        Array.isArray(payload.processors) ? payload.processors : [],
        objectName,
        targetKeys,
      );
      collectOverrideTargets(
        Array.isArray(payload.else) ? payload.else : [],
        objectName,
        targetKeys,
      );
    }
    if (processor.foreach?.processors) {
      collectOverrideTargets(
        Array.isArray(processor.foreach.processors) ? processor.foreach.processors : [],
        objectName,
        targetKeys,
      );
    }
    if (Array.isArray(processor.switch?.case)) {
      processor.switch.case.forEach((entry: any) => {
        collectOverrideTargets(
          Array.isArray(entry?.then)
            ? entry.then
            : Array.isArray(entry?.processors)
              ? entry.processors
              : [],
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

const collectEventOverrideTargets = (entry: any, objectName: string, targetKeys: Set<string>) => {
  if (!entry || typeof entry !== 'object') {
    return;
  }
  const eventPayload = entry.event;
  if (!eventPayload || typeof eventPayload !== 'object') {
    return;
  }
  Object.keys(eventPayload).forEach((key) => {
    if (!key) {
      return;
    }
    targetKeys.add(`${objectName}::$.event.${key}`);
  });
};

const main = async () => {
  const response = await client.readRule(overridePath, 'HEAD');
  const raw = extractRuleText(response);
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
  const overrides = parseOverridePayload(text);
  const targetKeys = new Set<string>();
  overrides.forEach((entry: any) => {
    const objectName = entry?.['@objectName'] || '__global__';
    const processors = Array.isArray(entry?.processors) ? entry.processors : [];
    collectOverrideTargets(processors, objectName, targetKeys);
    collectEventOverrideTargets(entry, objectName, targetKeys);
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        overridePath,
        overrides: overrides.length,
        targetCount: targetKeys.size,
        targets: Array.from(targetKeys.values()).sort(),
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
