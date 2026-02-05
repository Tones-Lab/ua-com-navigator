import fs from 'fs';
import path from 'path';

const [baseArg, limitArg] = process.argv.slice(2);
const baseDir = baseArg ? path.resolve(baseArg) : path.resolve(process.cwd(), '..', '..', 'coms');
const limit = Number(limitArg) || 10;

const splitCommandLine = (input: string) => {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaping = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
};

const normalizeTrapType = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (!raw) {
    return 's';
  }
  if (['s', 'i', 'u', 't', 'o'].includes(raw)) {
    return raw;
  }
  if (raw.startsWith('str')) {
    return 's';
  }
  if (raw.startsWith('int')) {
    return 'i';
  }
  if (raw.startsWith('tim')) {
    return 't';
  }
  if (raw.startsWith('oid')) {
    return 'o';
  }
  if (raw.startsWith('u')) {
    return 'u';
  }
  return 's';
};

const stripQuotes = (value: string) => value.replace(/^(['"])(.*)\1$/, '$2');

const extractModuleFromOid = (value: string) => {
  const parts = value.split('::');
  return parts.length > 1 ? parts[0] : '';
};

const parseTrapTestCommand = (command: string) => {
  const tokens = splitCommandLine(command);
  const cleaned = tokens.filter((token) => token && token !== '$SNMPTRAPCMD');
  if (cleaned[0] === 'snmptrap') {
    cleaned.shift();
  }

  let version: string | undefined;
  let community: string | undefined;
  let mibModule: string | undefined;
  let host: string | undefined;
  let trapOid: string | undefined;
  const varbinds: Array<{ oid: string; type: string; value: string }> = [];

  let index = 0;
  while (index < cleaned.length) {
    const token = cleaned[index];
    if (token === '-v' && cleaned[index + 1]) {
      version = cleaned[index + 1];
      index += 2;
      continue;
    }
    if (token === '-c' && cleaned[index + 1]) {
      community = cleaned[index + 1];
      index += 2;
      continue;
    }
    if (token === '-m' && cleaned[index + 1]) {
      mibModule = cleaned[index + 1];
      index += 2;
      continue;
    }
    if (token === '-M' && cleaned[index + 1]) {
      index += 2;
      continue;
    }
    if (token.startsWith('-')) {
      index += 1;
      continue;
    }
    break;
  }

  const remaining = cleaned.slice(index);
  let cursor = 0;
  if (remaining.length >= 3 && remaining[1] === '0') {
    host = remaining[0];
    trapOid = remaining[2];
    cursor = 3;
  } else if (remaining[0] === '0' && remaining[1]) {
    trapOid = remaining[1];
    cursor = 2;
  } else if (remaining[0]) {
    trapOid = remaining[0];
    cursor = 1;
  }

  for (let i = cursor; i + 2 < remaining.length; i += 3) {
    const oid = remaining[i];
    const type = normalizeTrapType(remaining[i + 1]);
    const value = stripQuotes(remaining[i + 2]);
    if (oid) {
      varbinds.push({ oid, type, value });
    }
  }

  const inferredModule = trapOid ? extractModuleFromOid(trapOid) : '';
  if (!mibModule && inferredModule) {
    mibModule = inferredModule;
  }

  return {
    version,
    community,
    host,
    trapOid,
    mibModule,
    varbinds,
  };
};

const listJsonFiles = (dir: string) => {
  const results: string[] = [];
  const walk = (current: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        return;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        results.push(full);
      }
    });
  };
  walk(dir);
  return results;
};

const shuffle = (list: string[]) => {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

if (!fs.existsSync(baseDir)) {
  // eslint-disable-next-line no-console
  console.error(`Directory not found: ${baseDir}`);
  process.exit(1);
}

const files = shuffle(listJsonFiles(baseDir)).slice(0, limit);
let totalTests = 0;

files.forEach((filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const objects = Array.isArray(json?.content?.objects)
      ? json.content.objects
      : Array.isArray(json?.objects)
        ? json.objects
        : [];
    const tests = objects
      .map((obj: any) => obj?.test)
      .filter((value: any) => typeof value === 'string');

    if (tests.length === 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`\n${filePath}`);
    tests.forEach((test: string) => {
      totalTests += 1;
      const parsed = parseTrapTestCommand(test);
      // eslint-disable-next-line no-console
      console.log(`  test: ${test}`);
      // eslint-disable-next-line no-console
      console.log(`  parsed: ${JSON.stringify(parsed)}`);
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(`Failed to parse ${filePath}: ${error.message}`);
  }
});

// eslint-disable-next-line no-console
console.log(`\nTotal test commands parsed: ${totalTests}`);
