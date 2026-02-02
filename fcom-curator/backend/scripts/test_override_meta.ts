/**
 * Purpose: Verify override metadata (modified by/time/revision) via UA API history and listing.
 * Usage: tsx scripts/test_override_meta.ts --server-id lab-ua-tony02 --auth basic --username api --password secret --file-id /core/default/processing/event/fcom/trap/aruba/ARUBA-WEBHOOK-FCOM.json
 * Notes: Requires network access to UA and valid credentials. Use --insecure to skip TLS verification.
 */
import UAClient from '../src/services/ua';
import { getServerById } from '../src/services/serverRegistry';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';

const parseArgs = (argv: string[]) => {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) {
      continue;
    }
    const normalized = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[normalized] = true;
      continue;
    }
    args[normalized] = next;
    i += 1;
  }
  return args;
};

const normalizePath = (pathValue: string) => pathValue.replace(/^\/+/, '').replace(/\/+$/, '');

const resolveOverrideLocation = (fileId: string) => {
  const normalized = normalizePath(fileId);
  const parts = normalized.split('/').filter(Boolean);
  const fcomIndex = parts.lastIndexOf('fcom');
  if (fcomIndex === -1) {
    throw new Error('File path does not include fcom');
  }

  const basePath = parts.slice(0, fcomIndex + 1).join('/');
  const methodIndex = parts.findIndex((segment, idx) => idx > fcomIndex && (segment === 'trap' || segment === 'syslog'));
  const method = methodIndex !== -1 ? parts[methodIndex] : undefined;
  const vendor = methodIndex !== -1
    ? parts[methodIndex + 1]
    : parts[fcomIndex + 1];

  if (!vendor) {
    throw new Error('Unable to resolve vendor from file path');
  }

  const overrideRoot = `${basePath}/overrides`;
  const overrideFileName = `${vendor}.override.json`;
  const overridePath = `${overrideRoot}/${overrideFileName}`;

  return {
    basePath,
    vendor,
    method,
    overrideRoot,
    overrideFileName,
    overridePath,
  };
};

const getLatestHistoryEntry = (history: any) => {
  const entries = Array.isArray(history?.data)
    ? history.data
    : Array.isArray(history?.history)
      ? history.history
      : Array.isArray(history?.entries)
        ? history.entries
        : Array.isArray(history)
          ? history
          : [];
  return entries[0];
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const serverId = String(args['server-id'] || '').trim();
  const auth = String(args.auth || '').trim();
  const fileId = String(args['file-id'] || '').trim();
  const username = args.username ? String(args.username) : undefined;
  const password = args.password ? String(args.password) : undefined;
  const certPath = args['cert-path'] ? String(args['cert-path']) : undefined;
  const keyPath = args['key-path'] ? String(args['key-path']) : undefined;
  const caPath = args['ca-path'] ? String(args['ca-path']) : undefined;
  const insecure = Boolean(args.insecure);

  if (!serverId || !auth || !fileId) {
    console.error('Missing required args: --server-id, --auth, --file-id');
    process.exit(1);
  }

  const server = getServerById(serverId);
  if (!server) {
    console.error(`Unknown server_id: ${serverId}`);
    process.exit(1);
  }

  const resolved = resolveOverrideLocation(fileId);
  const client = new UAClient({
    hostname: server.hostname,
    port: server.port,
    auth_method: auth === 'certificate' ? 'certificate' : 'basic',
    username,
    password,
    cert_path: certPath,
    key_path: keyPath,
    ca_cert_path: caPath,
    insecure_tls: insecure,
  });

  const createRestClient = (): AxiosInstance => {
    const baseURL = `https://${server.hostname}:${server.port}/api`;
    const axiosConfig: AxiosRequestConfig = {
      baseURL,
      timeout: 15000,
    };

    if (auth === 'basic') {
      axiosConfig.auth = {
        username: username || '',
        password: password || '',
      };
      if (insecure) {
        axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }
    } else {
      if (!certPath || !keyPath) {
        throw new Error('Certificate and key paths required for certificate auth');
      }
      const httpsAgent = new https.Agent({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        ca: caPath ? fs.readFileSync(caPath) : undefined,
        rejectUnauthorized: !insecure,
      });
      axiosConfig.httpAgent = httpsAgent;
      axiosConfig.httpsAgent = httpsAgent;
    }
    return axios.create(axiosConfig);
  };

  const restClient = createRestClient();

  const overridePath = resolved.overridePath;
  const overridePathWithSlash = `/${overridePath}`;
  const overrideRoot = resolved.overrideRoot;
  const overrideRootWithSlash = `/${overrideRoot}`;

  console.log('Resolved override path:', overridePath);

  const readTargets = [overridePath, overridePathWithSlash];
  for (const target of readTargets) {
    try {
      const data = await client.readRule(target, 'HEAD');
      console.log(`\nreadRule(${target}) ok:`, Boolean(data));
    } catch (error: any) {
      console.log(`\nreadRule(${target}) failed:`, error?.message || error);
    }
  }

  const historyTargets = [overridePath, overridePathWithSlash];
  for (const target of historyTargets) {
    try {
      const history = await client.getHistory(target, 5, 0);
      const latest = getLatestHistoryEntry(history);
      console.log(`\nLatest history entry (${target}):`, latest || '—');
      if (latest) {
        console.log('History author fields:', {
          ModifiedBy: latest.ModifiedBy,
          LastModifiedBy: latest.LastModifiedBy,
          Modifier: latest.Modifier,
          User: latest.User,
          Author: latest.Author,
          author: latest.author,
          username: latest.username,
          user: latest.user,
        });
      }
    } catch (error: any) {
      console.log(`\nHistory (${target}) failed:`, error?.message || error);
    }
  }

  const listAttempts: Array<{ label: string; path?: string; node?: string }> = [
    { label: 'node overrideRoot', node: overrideRoot },
    { label: 'node /overrideRoot', node: overrideRootWithSlash },
    { label: 'path overrideRoot', path: overrideRootWithSlash },
    { label: 'path basePath', path: `/${resolved.basePath}` },
  ];

  let listingMatch: any = null;

  for (const attempt of listAttempts) {
    try {
      const listing = attempt.node
        ? await client.listRules('/', 500, attempt.node, true)
        : await client.listRules(attempt.path || '/', 500, undefined, true);
      const entries = Array.isArray(listing?.data) ? listing.data : [];
      const match = entries.find((item: any) => (
        item?.PathName === resolved.overrideFileName
        || item?.PathID === overridePath
        || item?.PathID === overridePathWithSlash
        || String(item?.PathID || '').endsWith(`/${resolved.overrideFileName}`)
      ));
      console.log(`\nListing (${attempt.label}) entries:`, entries.length);
      console.log('Listing entry:', match || '—');
      if (!listingMatch && match) {
        listingMatch = match;
      }
      if (match) {
        console.log('Listing author fields:', {
          ModifiedBy: match.ModifiedBy,
          LastModifiedBy: match.LastModifiedBy,
          Modifier: match.Modifier,
          User: match.User,
        });
      }
    } catch (error: any) {
      console.log(`\nListing (${attempt.label}) failed:`, error?.message || error);
    }
  }

  if (listingMatch?.PathID) {
    const pathId = String(listingMatch.PathID);
    const historyTargetsFromListing = [pathId, pathId.replace(/^id-/, '')];
    for (const target of historyTargetsFromListing) {
      try {
        const history = await client.getHistory(target, 5, 0);
        const latest = getLatestHistoryEntry(history);
        console.log(`\nLatest history entry (${target}):`, latest || '—');
        if (latest) {
          console.log('History message fields:', {
            Message: latest.Message,
            CommitLog: latest.CommitLog,
            Comment: latest.Comment,
            message: latest.message,
            comment: latest.comment,
          });
          console.log('History author fields:', {
            ModifiedBy: latest.ModifiedBy,
            LastModifiedBy: latest.LastModifiedBy,
            Modifier: latest.Modifier,
            User: latest.User,
            Author: latest.Author,
            author: latest.author,
            username: latest.username,
            user: latest.user,
          });
        }
      } catch (error: any) {
        console.log(`\nHistory (${target}) failed:`, error?.message || error);
      }
    }
  }

  const revisionTargets: Array<{ label: string; id: string }> = [];
  if (listingMatch?.PathID) {
    revisionTargets.push({ label: 'PathID', id: String(listingMatch.PathID) });
    revisionTargets.push({ label: 'PathID-no-id', id: String(listingMatch.PathID).replace(/^id-/, '') });
  }
  revisionTargets.push({ label: 'overridePath', id: overridePath });
  revisionTargets.push({ label: 'overridePathWithSlash', id: overridePathWithSlash });

  for (const target of revisionTargets) {
    try {
      const diff = await client.diffRules(target.id, 'HEAD', 'HEAD');
      console.log(`\nDiff (${target.label}) result keys:`, diff ? Object.keys(diff) : '—');
    } catch (error: any) {
      console.log(`\nDiff (${target.label}) failed:`, error?.message || error);
    }
  }

  const rawHistoryParams: Array<{ label: string; params: Record<string, string> }> = [];
  if (listingMatch?.PathID) {
    rawHistoryParams.push({ label: 'id=PathID', params: { id: String(listingMatch.PathID) } });
    rawHistoryParams.push({ label: 'node=PathID', params: { node: String(listingMatch.PathID) } });
  }
  if (listingMatch?.PathName) {
    rawHistoryParams.push({ label: 'id=PathName', params: { id: String(listingMatch.PathName) } });
    rawHistoryParams.push({ label: 'PathName=PathName', params: { PathName: String(listingMatch.PathName) } });
  }
  rawHistoryParams.push({ label: 'id=overridePath', params: { id: overridePath } });
  rawHistoryParams.push({ label: 'id=/overridePath', params: { id: overridePathWithSlash } });
  rawHistoryParams.push({ label: 'node=overridePath', params: { node: overridePath } });
  rawHistoryParams.push({ label: 'node=/overridePath', params: { node: overridePathWithSlash } });
  rawHistoryParams.push({ label: 'path=overridePath', params: { path: overridePath } });
  rawHistoryParams.push({ label: 'path=/overridePath', params: { path: overridePathWithSlash } });
  if (listingMatch?.PathID) {
    rawHistoryParams.push({ label: 'PathID=PathID', params: { PathID: String(listingMatch.PathID) } });
  }

  console.log('\nRaw readRevisionHistory probes:');
  for (const probe of rawHistoryParams) {
    try {
      const response = await restClient.get('/rule/Rules/readRevisionHistory', {
        params: { ...probe.params, limit: 5, offset: 0 },
      });
      const data = response.data;
      const entries = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.history)
          ? data.history
          : Array.isArray(data?.entries)
            ? data.entries
            : [];
      const latest = entries[0];
      console.log(`\nreadRevisionHistory (${probe.label}) entries:`, entries.length);
      if (latest) {
        const revisionName = latest.RevisionName ?? latest.revisionName ?? latest.RevisionLabel ?? latest.revisionLabel;
        const revisionText = typeof revisionName === 'string' ? revisionName : '';
        const revisionMatch = revisionText.match(/r(\d+)/i);
        const bracketMatches = revisionText.match(/\[([^\]]+)\]/g) || [];
        const bracketValues = bracketMatches.map((entry) => entry.replace(/[\[\]]/g, '').trim());
        const parsedRevision = revisionMatch ? revisionMatch[1] : undefined;
        const parsedDate = bracketValues.length > 0 ? bracketValues[0] : undefined;
        const parsedUser = bracketValues.length > 1 ? bracketValues[1] : undefined;
        console.log('Latest history fields:', {
          Revision: latest.Revision ?? latest.revision ?? latest.LastRevision ?? latest.Rev,
          Date: latest.Date ?? latest.date ?? latest.ModificationTime ?? latest.Modified,
          Author: latest.Author ?? latest.author ?? latest.User ?? latest.ModifiedBy ?? latest.LastModifiedBy,
          Message: latest.Message ?? latest.message ?? latest.Comment ?? latest.comment ?? latest.CommitLog,
          RevisionName: revisionName,
          ParsedRevision: parsedRevision,
          ParsedDate: parsedDate,
          ParsedUser: parsedUser,
        });
        const message = String(latest.Message ?? latest.message ?? latest.Comment ?? latest.comment ?? latest.CommitLog ?? '');
        const bracketUserMatch = message.match(/\[([^\]]+)\]/) || (revisionName ? String(revisionName).match(/\[([^\]]+)\]/) : null);
        if (bracketUserMatch) {
          console.log('First bracket token from message:', bracketUserMatch[1].trim());
        }
      } else {
        console.log('Latest history entry: —');
      }
    } catch (error: any) {
      console.log(`\nreadRevisionHistory (${probe.label}) failed:`, error?.message || error);
    }
  }
};

main().catch((err) => {
  console.error('Override metadata test failed:', err?.message || err);
  process.exit(1);
});
