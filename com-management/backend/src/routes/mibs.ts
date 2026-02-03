import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import os from 'os';
import logger from '../utils/logger';
import { getSession } from '../services/sessionStore';

const router = Router();

const A1_BASEDIR = process.env.A1BASEDIR || '/opt/assure1';
const MIB_ROOT = process.env.UA_MIB_DIR || path.join(A1_BASEDIR, 'distrib', 'mibs');
const MIB2FCOM_BIN = process.env.UA_MIB2FCOM_BIN || path.join(A1_BASEDIR, 'bin', 'sdk', 'MIB2FCOM');
const TRAP_CMD = process.env.UA_SNMP_TRAP_CMD || 'snmptrap';

const requireEditPermission = (req: Request, res: Response): boolean => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    res.status(401).json({ error: 'No active session' });
    return false;
  }
  const session = getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: 'Session not found or expired' });
    return false;
  }
  if (!session.can_edit_rules) {
    res.status(403).json({ error: 'Read-only access' });
    return false;
  }
  return true;
};

const resolveSafePath = (targetPath: string) => {
  const normalized = path.resolve(MIB_ROOT, targetPath.replace(/^\/+/, ''));
  if (!normalized.startsWith(path.resolve(MIB_ROOT))) {
    throw new Error('Invalid path');
  }
  return normalized;
};

const listEntries = async (dirPath: string) => {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const entries = await Promise.all(items.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const stats = await fs.stat(fullPath);
    return {
      name: entry.name,
      path: fullPath.replace(path.resolve(MIB_ROOT), '') || '/',
      isDir: entry.isDirectory(),
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };
  }));
  return entries.sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

const parseMibDefinitions = (content: string) => {
  const lines = content.split(/\r?\n/);
  const definitions: Array<{
    name: string;
    kind: string;
    oid?: string;
    description?: string;
    module?: string;
    syntax?: string;
    access?: string;
    status?: string;
    defval?: string;
    index?: string;
  }> = [];
  const matcher = /^(\w+)\s+(OBJECT-TYPE|NOTIFICATION-TYPE|TRAP-TYPE)\b/;
  let moduleName = '';

  for (let i = 0; i < Math.min(lines.length, 80); i += 1) {
    const headerMatch = lines[i].match(/^(\w[\w-]*)\s+DEFINITIONS\s+::=\s+BEGIN/i);
    if (headerMatch) {
      moduleName = headerMatch[1];
      break;
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(matcher);
    if (!match) {
      continue;
    }
    const name = match[1];
    const kind = match[2];
    let oid: string | undefined;
    let description: string | undefined;
    let syntax: string | undefined;
    let access: string | undefined;
    let status: string | undefined;
    let defval: string | undefined;
    let index: string | undefined;

    for (let j = i + 1; j < Math.min(lines.length, i + 120); j += 1) {
      const next = lines[j];
      const oidMatch = next.match(/::=\s*\{([^}]+)\}/);
      if (oidMatch) {
        oid = oidMatch[1].trim();
      }
      const syntaxMatch = next.match(/^\s*SYNTAX\s+(.+)$/i);
      if (syntaxMatch && !syntax) {
        syntax = syntaxMatch[1].trim();
      }
      const accessMatch = next.match(/^\s*(MAX-ACCESS|ACCESS)\s+(.+)$/i);
      if (accessMatch && !access) {
        access = accessMatch[2].trim();
      }
      const statusMatch = next.match(/^\s*STATUS\s+(.+)$/i);
      if (statusMatch && !status) {
        status = statusMatch[1].trim();
      }
      const defvalMatch = next.match(/^\s*DEFVAL\s+\{([^}]+)\}/i);
      if (defvalMatch && !defval) {
        defval = defvalMatch[1].trim();
      }
      const indexMatch = next.match(/^\s*(INDEX|AUGMENTS)\s*\{([^}]+)\}/i);
      if (indexMatch && !index) {
        index = indexMatch[2].trim();
      }
      if (next.includes('DESCRIPTION')) {
        const descParts: string[] = [];
        let foundQuote = false;
        for (let k = j; k < Math.min(lines.length, j + 20); k += 1) {
          const segment = lines[k];
          const quoteIndex = segment.indexOf('"');
          if (quoteIndex >= 0 && !foundQuote) {
            foundQuote = true;
            const after = segment.slice(quoteIndex + 1);
            const endIndex = after.indexOf('"');
            if (endIndex >= 0) {
              descParts.push(after.slice(0, endIndex));
              break;
            }
            descParts.push(after);
          } else if (foundQuote) {
            const endIndex = segment.indexOf('"');
            if (endIndex >= 0) {
              descParts.push(segment.slice(0, endIndex));
              break;
            }
            descParts.push(segment);
          }
        }
        if (descParts.length > 0) {
          description = descParts.join(' ').replace(/\s+/g, ' ').trim();
        }
      }
      if (oid && description && syntax && access && status) {
        break;
      }
      if (/^\s*$/.test(next)) {
        if (oid || description) {
          break;
        }
      }
    }

    definitions.push({
      name,
      kind,
      oid,
      description,
      module: moduleName || undefined,
      syntax,
      access,
      status,
      defval,
      index,
    });
  }
  return definitions;
};

router.get('/browse', async (req: Request, res: Response) => {
  try {
    const requestedPath = String(req.query.path || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const limit = Math.max(1, Number(req.query.limit) || 30);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const basePath = requestedPath ? resolveSafePath(requestedPath) : path.resolve(MIB_ROOT);
    if (!existsSync(basePath)) {
      return res.status(404).json({ error: 'MIB path not found' });
    }
    const entries = await listEntries(basePath);
    const total = entries.length;
    const filtered = search
      ? entries.filter((entry) => entry.name.toLowerCase().includes(search))
      : entries;
    const filteredTotal = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredTotal;
    res.json({
      root: MIB_ROOT,
      path: basePath.replace(path.resolve(MIB_ROOT), '') || '/',
      entries: paged,
      total,
      filtered_total: filteredTotal,
      limit,
      offset,
      hasMore,
    });
  } catch (error: any) {
    logger.error(`MIB browse error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to browse MIBs' });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    const limit = Math.max(1, Number(req.query.limit) || 30);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const needle = query.toLowerCase();
    const results: Array<{ name: string; path: string; isDir: boolean; size: number; modified: string }> = [];
    let matches = 0;
    let hasMore = false;

    const walk = async (dir: string) => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await walk(fullPath);
          if (hasMore) {
            return;
          }
          continue;
        }
        if (!item.name.toLowerCase().includes(needle)) {
          continue;
        }
        matches += 1;
        if (matches <= offset) {
          continue;
        }
        if (results.length >= limit) {
          hasMore = true;
          return;
        }
        const stats = await fs.stat(fullPath);
        results.push({
          name: item.name,
          path: fullPath.replace(path.resolve(MIB_ROOT), '') || '/',
          isDir: false,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    };

    await walk(path.resolve(MIB_ROOT));

    res.json({
      root: MIB_ROOT,
      query,
      entries: results,
      matches,
      limit,
      offset,
      hasMore,
      truncated: hasMore,
    });
  } catch (error: any) {
    logger.error(`MIB search error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to search MIBs' });
  }
});

router.get('/read', async (req: Request, res: Response) => {
  try {
    const requestedPath = String(req.query.path || '').trim();
    if (!requestedPath) {
      return res.status(400).json({ error: 'Missing path' });
    }
    const safePath = resolveSafePath(requestedPath);
    const content = await fs.readFile(safePath, 'utf-8');
    res.json({ path: requestedPath, content });
  } catch (error: any) {
    logger.error(`MIB read error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to read MIB' });
  }
});

router.get('/parse', async (req: Request, res: Response) => {
  try {
    const requestedPath = String(req.query.path || '').trim();
    if (!requestedPath) {
      return res.status(400).json({ error: 'Missing path' });
    }
    const safePath = resolveSafePath(requestedPath);
    const content = await fs.readFile(safePath, 'utf-8');
    const definitions = parseMibDefinitions(content);
    res.json({ path: requestedPath, definitions });
  } catch (error: any) {
    logger.error(`MIB parse error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to parse MIB' });
  }
});

router.post('/mib2fcom', async (req: Request, res: Response) => {
  try {
    if (!requireEditPermission(req, res)) {
      return;
    }
    const { inputPath, outputName, useParentMibs } = req.body || {};
    if (!inputPath) {
      return res.status(400).json({ error: 'Missing inputPath' });
    }
    if (!existsSync(MIB2FCOM_BIN)) {
      return res.status(500).json({ error: `MIB2FCOM not found at ${MIB2FCOM_BIN}` });
    }
    const resolvedInput = resolveSafePath(String(inputPath));
    const stat = await fs.stat(resolvedInput);
    const outName = outputName || `${path.basename(resolvedInput).replace(/\.(mib|txt)$/i, '')}-FCOM.json`;
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mib2fcom-'));
    const outPath = path.join(outDir, outName);

    const args = [
      `--in=${stat.isDirectory() ? '.' : resolvedInput}`,
      `--out=${outPath}`,
    ];
    if (useParentMibs) {
      args.push('--use_parent_mibs');
    }

    const cwd = stat.isDirectory() ? resolvedInput : undefined;
    await new Promise<void>((resolve, reject) => {
      execFile(MIB2FCOM_BIN, args, { cwd }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const outputContent = await fs.readFile(outPath, 'utf-8');
    res.json({ outputPath: outPath, outputName: outName, content: outputContent });
  } catch (error: any) {
    logger.error(`MIB2FCOM error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to run MIB2FCOM' });
  }
});

router.post('/trap/send', async (req: Request, res: Response) => {
  try {
    const { host, port, community, version, trapOid, varbinds, mibModule } = req.body || {};
    if (!host || !trapOid) {
      return res.status(400).json({ error: 'Missing host or trapOid' });
    }
    const snmpVersion = version || '2c';
    if (snmpVersion !== '2c') {
      return res.status(400).json({ error: 'Only SNMP v2c is supported in this release' });
    }
    const targetHost = port ? `${host}:${port}` : host;
    const normalizeOid = (value: string) => value.trim().replace(/\s+/g, '.');
    const args = ['-v', '2c', '-c', community || 'public'];
    if (mibModule) {
      args.push('-M', MIB_ROOT, '-m', String(mibModule));
    }
    args.push(targetHost);
    args.push('0', normalizeOid(String(trapOid)));
    (Array.isArray(varbinds) ? varbinds : []).forEach((entry: any) => {
      if (!entry?.oid) {
        return;
      }
      args.push(normalizeOid(String(entry.oid)));
      args.push(entry.type || 's');
      args.push(String(entry.value ?? ''));
    });

    const buildArgs = (overrideType?: string) => {
      const nextArgs = ['-v', '2c', '-c', community || 'public'];
      if (mibModule) {
        nextArgs.push('-M', MIB_ROOT, '-m', String(mibModule));
      }
      nextArgs.push(targetHost);
      nextArgs.push('0', normalizeOid(String(trapOid)));
      (Array.isArray(varbinds) ? varbinds : []).forEach((entry: any) => {
        if (!entry?.oid) {
          return;
        }
        nextArgs.push(normalizeOid(String(entry.oid)));
        const fallbackType = overrideType || entry.type || 's';
        nextArgs.push(fallbackType);
        nextArgs.push(String(entry.value ?? ''));
      });
      return nextArgs;
    };

    const execTrap = (trapArgs: string[]) => new Promise<void>((resolve, reject) => {
      execFile(TRAP_CMD, trapArgs, {
        env: {
          ...process.env,
          MIBDIRS: MIB_ROOT,
          MIBS: mibModule ? String(mibModule) : (process.env.MIBS || ''),
        },
      }, (error, stdout, stderr) => {
        if (error) {
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
          return;
        }
        resolve();
      });
    });

    const inferTypeFromError = (stderr: string) => {
      const match = stderr.match(/Type of attribute is\s+([A-Za-z0-9\-\s]+),/i);
      if (!match) {
        return null;
      }
      const raw = match[1].trim().toLowerCase();
      if (raw.includes('counter') || raw.includes('gauge') || raw.includes('unsigned')) {
        return 'u';
      }
      if (raw.includes('integer')) {
        return 'i';
      }
      if (raw.includes('timeticks') || raw.includes('time ticks')) {
        return 't';
      }
      if (raw.includes('object identifier') || raw === 'oid') {
        return 'o';
      }
      if (raw.includes('octet')) {
        return 's';
      }
      return null;
    };

    try {
      await execTrap(buildArgs());
    } catch (error: any) {
      const trimmedStderr = String(error?.stderr || '').trim();
      const trimmedStdout = String(error?.stdout || '').trim();
      const inferredType = inferTypeFromError(trimmedStderr);
      if (inferredType) {
        try {
          logger.warn('Trap send retry with inferred type', {
            trapOid,
            targetHost,
            mibModule,
            inferredType,
          });
          await execTrap(buildArgs(inferredType));
          return res.json({ success: true, retried: true, inferredType });
        } catch (retryError: any) {
          logger.error('Trap send failed after retry', {
            message: retryError.message,
            code: (retryError as any).code,
            signal: (retryError as any).signal,
            trapOid,
            targetHost,
            mibModule,
            varbindCount: Array.isArray(varbinds) ? varbinds.length : 0,
            stderr: String(retryError?.stderr || '').trim() || undefined,
            stdout: String(retryError?.stdout || '').trim() || undefined,
          });
          throw retryError;
        }
      }
      logger.error('Trap send failed', {
        message: error.message,
        code: (error as any).code,
        signal: (error as any).signal,
        trapOid,
        targetHost,
        mibModule,
        varbindCount: Array.isArray(varbinds) ? varbinds.length : 0,
        stderr: trimmedStderr || undefined,
        stdout: trimmedStdout || undefined,
      });
      throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`Trap send error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to send trap' });
  }
});

export default router;
