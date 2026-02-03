/**
 * Purpose: Validate Unified Assurance REST API authentication (basic or certificate).
 * Usage:
 *   npx tsx scripts/ua_auth_test.ts --host <host> --port <port> --auth basic --username <user> --password <pass> [--insecure true]
 *   npx tsx scripts/ua_auth_test.ts --host <host> --port <port> --auth certificate --cert <path> --key <path> [--ca <path>] [--insecure true]
 * Notes/Environment:
 *   - Calls a UA REST endpoint to verify authentication. Default endpoint is /api/device/devices.
 *   - You can override the endpoint with --endpoint (e.g., /api/rule/Rules/read).
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
  const endpoint = args.endpoint || '/api/device/devices';
  const query = args.query || '';
  const timeout = Number(args.timeout || '10000');
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
    const endpointWithQuery = query
      ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`
      : endpoint;
    const response = await axios.get(endpointWithQuery, config);
    console.log('Auth test SUCCESS');
    console.log(`GET ${baseURL}${endpointWithQuery}`);
    console.log(`Status: ${response.status}`);
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.message || 'Unknown error';
    console.error('Auth test FAILED');
    const endpointWithQuery = query
      ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`
      : endpoint;
    console.error(`GET ${baseURL}${endpointWithQuery}`);
    console.error(`Status: ${status ?? 'N/A'}`);
    console.error(`Error: ${message}`);
    process.exit(2);
  }
};

main();
