/**
 * Purpose: Probe candidate override folders and test createRule.
 * Usage:
 *   tsx scripts/override_path_probe.ts --host <ua-host> --username <user> --password <pass>
 * Notes: Uses basic auth; accepts --insecure to disable TLS verification.
 */
import UAClient from '../src/services/ua';

interface Args {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  insecure?: string;
}

const parseArgs = (): Args => {
  const args: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key.startsWith('--')) {
      continue;
    }
    const name = key.replace(/^--/, '');
    (args as any)[name] = val;
    i += 1;
  }
  return args;
};

const main = async () => {
  const args = parseArgs();
  const host = args.host;
  const port = Number(args.port || '443');
  const username = args.username || 'admin';
  const password = args.password || 'admin';
  const insecure = args.insecure === 'true' || args.insecure === '1' || args.insecure === 'yes';

  if (!host) {
    console.error('Missing required args: --host');
    process.exit(1);
  }

  const uaClient = new UAClient({
    hostname: host,
    port,
    auth_method: 'basic',
    username,
    password,
    insecure_tls: insecure,
  });

  const candidates = [
    'core/default/processing/event/fcom/overrides',
    'id-core/default/processing/event/fcom/overrides',
    '/core/default/processing/event/fcom/overrides',
    '/id-core/default/processing/event/fcom/overrides',
  ];

  console.log('Probing override nodes...');
  const okNodes: string[] = [];
  for (const node of candidates) {
    try {
      const resp = await uaClient.listRules('/', 5, node, true);
      const entries = Array.isArray(resp?.data) ? resp.data : [];
      console.log(`OK listRules node=${node} entries=${entries.length}`);
      okNodes.push(node);
      if (entries.length > 0) {
        const sample = entries[0];
        console.log(`  sample PathID=${sample?.PathID || sample?.PathName || 'n/a'}`);
      }
    } catch (error: any) {
      console.log(`FAIL listRules node=${node} error=${error?.response?.data?.error || error?.message}`);
    }
  }

  const targetNodes = okNodes.length > 0 ? okNodes : candidates;
  const fileName = `copilot-probe.${Date.now()}.trap.override.json`;
  const payload = {
    name: 'Copilot Probe Override',
    description: 'Override path probe',
    domain: 'fault',
    method: 'trap',
    scope: 'post',
    '@objectName': 'CLI::Probe',
    _type: 'override',
    processors: [],
  };

  console.log(`\nAttempting createRule for ${fileName}...`);
  for (const node of targetNodes) {
    try {
      const resp = await uaClient.createRule(fileName, payload, node, 'CLI probe override');
      const success = resp?.success !== false;
      console.log(`createRule node=${node} success=${success}`);
      if (!success) {
        console.log(`  message=${resp?.message || 'unknown error'}`);
      } else {
        console.log('  create returned success');
      }
    } catch (error: any) {
      console.log(
        `createRule node=${node} error=${error?.response?.data?.error || error?.message}`,
      );
    }
  }
};

main();
