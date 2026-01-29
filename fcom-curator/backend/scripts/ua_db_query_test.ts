/**
 * Purpose: Execute a UA Database Query tool request via REST.
 * Usage:
 *   npx tsx scripts/ua_db_query_test.ts --host <host> --port <port> --auth basic --username <user> --password <pass> --query "DESCRIBE Event.Events" [--insecure true]
 *   npx tsx scripts/ua_db_query_test.ts --host <host> --port <port> --auth certificate --cert <path> --key <path> [--ca <path>] --query "DESCRIBE Event.Events"
 * Notes:
 *   - Default endpoint: /api/db/Query/execute
 *   - Override with --endpoint if your UA install differs.
 */
import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';

interface Args {
  host?: string;
  port?: string;
  auth?: 'basic' | 'certificate';
  username?: string;
  password?: string;
  cert?: string;
  key?: string;
  ca?: string;
  endpoint?: string;
  query?: string;
  timeout?: string;
  insecure?: string;
}

const parseArgs = (): Args => {
  const args: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key.startsWith('--')) continue;
    const name = key.replace(/^--/, '');
    (args as any)[name] = val;
    i++;
  }
  return args;
};

const main = async () => {
  const args = parseArgs();

  const host = args.host;
  const port = args.port || '8080';
  const auth = args.auth;
  const endpoint = args.endpoint || '/api/db/Query/execute';
  const query = args.query || 'DESCRIBE Event.Events';
  const timeout = Number(args.timeout || '20000');
  const insecure = args.insecure === 'true' || args.insecure === '1' || args.insecure === 'yes';

  if (!host || !auth) {
    console.error('Missing required args: --host and --auth');
    process.exit(1);
  }

  const baseURL = (port === '443' || port === '80')
    ? `https://${host}`
    : `https://${host}:${port}`;
  const config: AxiosRequestConfig = {
    baseURL,
    timeout,
  };

  if (auth === 'basic') {
    if (!args.username || !args.password) {
      console.error('Missing --username or --password for basic auth');
      process.exit(1);
    }
    config.auth = {
      username: args.username,
      password: args.password,
    };
  }

  if (auth === 'certificate') {
    if (!args.cert || !args.key) {
      console.error('Missing --cert or --key for certificate auth');
      process.exit(1);
    }
    const httpsAgent = new https.Agent({
      cert: fs.readFileSync(args.cert),
      key: fs.readFileSync(args.key),
      ca: args.ca ? fs.readFileSync(args.ca) : undefined,
      rejectUnauthorized: !insecure,
    });
    config.httpsAgent = httpsAgent;
  }

  if (auth === 'basic' && insecure) {
    config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }

  try {
    const response = await axios.post(endpoint, { query }, config);
    console.log('DB query SUCCESS');
    console.log(`POST ${baseURL}${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data || error?.message || 'Unknown error';
    console.error('DB query FAILED');
    console.error(`POST ${baseURL}${endpoint}`);
    console.error(`Status: ${status ?? 'N/A'}`);
    console.error('Error:', message);
    process.exit(2);
  }
};

main();
