/**
 * Purpose: Create and verify a test override via UA APIs.
 * Usage:
 *   tsx scripts/override_create_test.ts --host <ua-host> --username <user> --password <pass>
 * Notes: Defaults to admin/admin and uses basic auth unless overridden.
 */
import UAClient from '../src/services/ua';

interface Args {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  path?: string;
  name?: string;
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
  const path = args.path || 'core/default/processing/event/fcom/overrides';
  const name = args.name || 'copilot-test.trap.override.json';
  const insecure = args.insecure === 'true' || args.insecure === '1' || args.insecure === 'yes';

  if (!host) {
    console.error('Missing required args: --host');
    process.exit(1);
  }

  if (!args.username || !args.password) {
    console.warn('Using default credentials: admin/admin');
  }

  const uaClient = new UAClient({
    hostname: host,
    port,
    auth_method: 'basic',
    username,
    password,
    insecure_tls: insecure,
  });

  const content = {
    name: 'Copilot CLI Override',
    description: 'CLI test override create',
    domain: 'fault',
    method: 'trap',
    scope: 'post',
    '@objectName': 'CLI::Test',
    _type: 'override',
    processors: [],
  };

  const pathId = `${path}/${name}`;

  try {
    console.log(`Creating override: ${pathId}`);
    const createResp = await uaClient.createRule(name, content, path, 'CLI override create test');
    console.log('Create response:', JSON.stringify(createResp));

    console.log(`Reading override: ${pathId}`);
    const readResp = await uaClient.readRule(pathId, 'HEAD');
    const ruleText =
      readResp?.content?.data?.[0]?.RuleText ??
      readResp?.data?.[0]?.RuleText ??
      readResp?.RuleText ??
      null;
    console.log('Read RuleText present:', typeof ruleText === 'string');

    console.log(`Listing overrides: ${path}`);
    const listResp = await uaClient.listRules('/', 50, path, true);
    const entries = Array.isArray(listResp?.data) ? listResp.data : [];
    const found = entries.find(
      (entry: any) => entry?.PathName === name || String(entry?.PathID || '').endsWith(`/${name}`),
    );
    console.log('Listing found:', Boolean(found));
    if (found) {
      console.log('Listing entry PathID:', found.PathID || found.PathName);
    }
  } catch (error: any) {
    console.error('CLI override create test FAILED');
    console.error(error?.response?.data || error?.message || error);
    process.exit(2);
  }
};

main();
