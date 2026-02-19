import fs from 'fs';
import path from 'path';

export type LegacyRuleType = 'fault' | 'performance' | 'unknown';

export type LegacyFunctionBlock = {
  name: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type LegacyFileAnalysis = {
  filePath: string;
  fileType: 'rules' | 'pl' | 'other';
  size: number;
  functionBlocks: LegacyFunctionBlock[];
  oids: string[];
  eventFields: string[];
  summaryPatterns: string[];
  helpKeys: string[];
  nodeValues: string[];
  subNodeValues: string[];
  performanceHints: string[];
  severityAssignments: Array<{ severity?: string; eventCategory?: string }>;
  severityMaps: Record<string, { severity: string; eventCategory: string }>;
  lookupPairs: Array<{ key: string; value: string }>;
  variableMappingsByFunction: Record<string, Record<string, string>>;
  snmpHints: string[];
};

export type LegacyFileClassification = {
  filePath: string;
  ruleType: LegacyRuleType;
  confidence: number;
  evidence: {
    eventFields: string[];
    oidCount: number;
    snmpHints: string[];
    performanceHints: string[];
  };
};

export type LegacyObject = {
  id: string;
  sourceFile: string;
  ruleFunction: string;
  ruleType: LegacyRuleType;
  oids: string[];
  eventFields: string[];
  summaryPatterns: string[];
  helpKeys: string[];
  nodeValues: string[];
  subNodeValues: string[];
  performanceHints: string[];
  classificationHints: string[];
  traversal?: LegacyObjectTraversal;
  severityAssignments: Array<{ severity?: string; eventCategory?: string }>;
};

export type LegacyOverrideProposal = {
  objectName: string;
  sourceFile: string;
  ruleFunction: string;
  fields: Record<string, string>;
  reason: string;
};

export type LegacyStubStatus = 'direct' | 'conditional' | 'manual';

export type LegacyProcessorStub = {
  objectName: string;
  sourceFile: string;
  ruleFunction: string;
  targetField: string;
  expression: string;
  status: LegacyStubStatus;
  recommendedProcessor: 'set' | 'copy' | 'replace' | 'regex' | 'if' | 'lookup' | 'manual';
  template?: Record<string, any>;
  requiredMappings: string[];
  notes: string[];
  documentationRefs: string[];
  confidence?: {
    score: number;
    level: 'high' | 'medium' | 'low';
    rationale: string;
  };
};

export type LegacyLookupStub = {
  sourceFile: string;
  lookupName: string;
  status: LegacyStubStatus;
  entryCount: number;
  template: Record<string, any>;
  notes: string[];
  documentationRefs: string[];
};

export type LegacyConversionStubs = {
  processorStubs: LegacyProcessorStub[];
  lookupStubs: LegacyLookupStub[];
  summary: {
    processorTotal: number;
    processorDirect: number;
    processorConditional: number;
    processorManual: number;
    lookupTotal: number;
    lookupDirect: number;
    lookupConditional: number;
    lookupManual: number;
  };
};

export type LegacyMatchDiff = {
  legacyObjectId: string;
  legacyObjectName: string;
  sourceFile: string;
  matchMethod?: 'oid' | 'name' | 'heuristic';
  matchScore?: number;
  matchedObject?: {
    name: string;
    source: 'fcom' | 'pcom' | 'mib';
    path?: string;
  };
  diffs: Array<{ field: string; legacyValue?: string; existingValue?: string }>;
};

export type LegacyMatchStats = {
  indexEntries: number;
  indexFiles: number;
  indexBuiltAt: string;
  indexAgeMs: number;
  cacheHit: boolean;
  vendor?: string;
};

export type LegacyOverrideBundle = {
  manifest: {
    runId: string;
    createdAt: string;
    totalOverrides: number;
    inputs: string[];
    vendor?: string;
  };
  overrides: LegacyOverrideProposal[];
};

type ComMatchSource = 'fcom' | 'pcom' | 'mib';

type ComMatchEntry = {
  objectName: string;
  source: ComMatchSource;
  path: string;
  event: Record<string, any>;
  oids: string[];
};

type ComIndex = {
  byOid: Map<string, ComMatchEntry[]>;
  byName: Map<string, ComMatchEntry[]>;
  count: number;
};

export type LegacyTraversalEntry = {
  kind: 'dispatch' | 'include' | 'standalone' | 'fallback';
  root: string;
  filePath: string;
  functionName?: string;
  condition?: string;
};

export type LegacyTraversalInclude = {
  name: string;
  path: string;
  resolvedPath?: string;
  exists: boolean;
};

export type LegacyObjectTraversal = {
  kind: LegacyTraversalEntry['kind'];
  root: string;
  condition?: string;
  functionName?: string;
};

export type LegacyTraversalResult = {
  orderedFiles: string[];
  entries: LegacyTraversalEntry[];
  missingFunctions: string[];
  includeEntries: LegacyTraversalInclude[];
  loadCalls: string[];
  missingLoadCalls: string[];
  missingIncludePaths: string[];
  missingLookupFiles: string[];
};

type SeverityAssignment = { severity?: string; eventCategory?: string };

export type LegacyConversionReport = {
  runId: string;
  startedAt: string;
  inputs: string[];
  vendor?: string;
  options?: {
    useMibs?: boolean;
    useLlm?: boolean;
  };
  traversal: LegacyTraversalResult;
  bundle: LegacyOverrideBundle;
  files: LegacyFileAnalysis[];
  classifications: LegacyFileClassification[];
  legacyObjects: LegacyObject[];
  overrideProposals: LegacyOverrideProposal[];
  stubs: LegacyConversionStubs;
  matchDiffs: LegacyMatchDiff[];
  matchStats?: LegacyMatchStats | null;
  summaries: {
    byFolder: Array<{
      folder: string;
      totalObjects: number;
      faultObjects: number;
      performanceObjects: number;
      unknownObjects: number;
    }>;
    byFile: Array<{
      filePath: string;
      totalObjects: number;
      faultObjects: number;
      performanceObjects: number;
      unknownObjects: number;
    }>;
  };
  summary: {
    totalFiles: number;
    totalLegacyObjects: number;
    faultFiles: number;
    performanceFiles: number;
    unknownFiles: number;
    totalOids: number;
    totalOverrides: number;
    totalProcessorStubs: number;
    directProcessorStubs: number;
    conditionalProcessorStubs: number;
    manualProcessorStubs: number;
    totalLookupStubs: number;
  };
};

export type LegacyConversionOptions = {
  inputs: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  vendor?: string;
  useMibs?: boolean;
  useLlm?: boolean;
};

const oidRegex = /(?:\d+\.){3,}\d+/g;
const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
const eventFieldRegex = /\$Event\s*->\s*\{\s*['"]?([A-Za-z0-9_]+)['"]?\s*}\s*=/g;
const summaryRegex = /\$Event\s*->\s*\{\s*['"]?Summary['"]?\s*}\s*=\s*(.+);/g;
const helpKeyRegex = /\$Event\s*->\s*\{\s*['"]?HelpKey['"]?\s*}\s*=\s*(.+);/g;
const nodeRegex = /\$Event\s*->\s*\{\s*['"]?Node['"]?\s*}\s*=\s*(.+);/g;
const subNodeRegex = /\$Event\s*->\s*\{\s*['"]?SubNode['"]?\s*}\s*=\s*(.+);/g;
const severityAssignRegex = /\$Event\s*->\s*\{\s*['"]?Severity['"]?\s*}\s*=\s*([0-9]+)/g;
const eventCategoryAssignRegex = /\$Event\s*->\s*\{\s*['"]?EventCategory['"]?\s*}\s*=\s*([0-9]+)/g;
const snmpHintRegex = /snmp|snmpwalk|snmptrap|snmpget|oid/i;
const metricIdRegex = /\$MetricID\b/;
const findCallRegex = /\bFind[A-Za-z0-9_]+\s*\(/g;
const hashOidRegex = /['"][^'"]+['"]\s*=>\s*['"]?(?:\d+\.){3,}\d+['"]?/g;
const MATCH_CACHE_TTL_MS = Math.max(0, Number(process.env.LEGACY_MATCH_CACHE_TTL_MS || 5 * 60 * 1000));
const eventRefRegex = /^\$Event\s*->\s*\{\s*['"]?([A-Za-z0-9_]+)['"]?\s*}$/;
const perlVarRegex = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;
const perlSigilRegex = /\$Event\s*->|\$[A-Za-z_][A-Za-z0-9_]*/;
const concatRegex = /\s\.\s/;
const lookupPairRegex = /['"]([^'"]+)['"]\s*=>\s*['"]([^'"]+)['"]/g;

const normalizeList = (values: string[]) => Array.from(new Set(values)).filter(Boolean);

const DOC_REFS = [
  'architecture/fcom-processor-docs-full.md',
  'architecture/fcom-processor-docs-summary.md',
  'architecture/legacy-to-fcom-field-mappings.md',
];

const stripOuterQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseScalarLiteral = (value: string): string | number | boolean => {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.toLowerCase() === 'true') {
    return true;
  }
  if (trimmed.toLowerCase() === 'false') {
    return false;
  }
  return stripOuterQuotes(trimmed);
};

const extractLookupPairs = (content: string) => {
  const pairs = new Map<string, string>();
  lookupPairRegex.lastIndex = 0;
  let match = lookupPairRegex.exec(content);
  while (match) {
    const key = String(match[1] || '').trim();
    const value = String(match[2] || '').trim();
    if (key) {
      pairs.set(key, value);
    }
    match = lookupPairRegex.exec(content);
  }
  return Array.from(pairs.entries()).map(([key, value]) => ({ key, value }));
};

const deriveLookupName = (filePath: string) => {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[^A-Za-z0-9_]+/g, '_');
};

const splitConcatExpression = (expression: string) => {
  const parts: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < expression.length; index += 1) {
    const ch = expression[index];
    const prev = index > 0 ? expression[index - 1] : '';

    if (ch === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === '.') {
      const before = current.trim();
      if (before) {
        parts.push(before);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) {
    parts.push(tail);
  }

  if (parts.length === 0) {
    return [expression.trim()].filter(Boolean);
  }
  return parts;
};

const varAssignmentRegex = /^\s*(?:my\s+)?\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*;\s*$/;
const numberedVarRegex = /^\$v(\d+)$/i;

const mapLegacySourceExpression = (expression: string, knownMappings: Record<string, string>) => {
  const trimmed = String(expression || '').trim();
  if (!trimmed) {
    return null;
  }

  const numberedVar = trimmed.match(numberedVarRegex);
  if (numberedVar) {
    const idx = Number(numberedVar[1]);
    if (!Number.isNaN(idx) && idx > 0) {
      return `$.trap.variables[${idx - 1}].value`;
    }
  }

  const eventMatch = trimmed.match(eventRefRegex);
  if (eventMatch) {
    return `$.event.${eventMatch[1]}`;
  }

  const directVar = trimmed.match(perlVarRegex);
  if (directVar) {
    return knownMappings[directVar[1]] || null;
  }

  return null;
};

const buildVariableMappingsByFunction = (functionBlocks: LegacyFunctionBlock[]) => {
  const result: Record<string, Record<string, string>> = {};
  functionBlocks.forEach((block) => {
    const mapping: Record<string, string> = {};
    const lines = block.text.split(/\r?\n/);
    let changed = true;
    let guard = 0;
    while (changed && guard < 8) {
      changed = false;
      guard += 1;
      lines.forEach((line) => {
        const assignment = line.match(varAssignmentRegex);
        if (!assignment) {
          return;
        }
        const variableName = assignment[1];
        const sourceExpr = assignment[2];
        const resolved = mapLegacySourceExpression(sourceExpr, mapping);
        if (resolved && mapping[variableName] !== resolved) {
          mapping[variableName] = resolved;
          changed = true;
        }
      });
    }
    result[block.name] = mapping;
  });
  return result;
};

const isIpAddress = (value: string) => {
  if (!ipRegex.test(value)) {
    return false;
  }
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    const parsed = Number(part);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255;
  });
};

const filterOids = (values: string[]) => values.filter((value) => !isIpAddress(value));

const extractPerformanceHints = (content: string) => {
  const hints: string[] = [];
  if (metricIdRegex.test(content)) {
    hints.push('MetricID');
  }
  if (findCallRegex.test(content)) {
    hints.push('FindCall');
  }
  if (hashOidRegex.test(content)) {
    hints.push('HashOidPairs');
  }
  return hints;
};

const normalizeMatchKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const resolveComsRoot = (inputs: string[]) => {
  const roots = inputs.map((input) => path.resolve(input));
  for (const entry of roots) {
    let current = fs.statSync(entry).isDirectory() ? entry : path.dirname(entry);
    while (current && current !== path.dirname(current)) {
      const candidate = path.join(current, 'coms');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
      current = path.dirname(current);
    }
  }
  return null;
};

const shouldIncludeComFile = (filePath: string, vendor?: string) => {
  if (!vendor) {
    return true;
  }
  const parts = filePath
    .toLowerCase()
    .split(path.sep)
    .filter(Boolean);
  return parts.includes(vendor.toLowerCase());
};

const listComJsonFiles = (root: string) => {
  const results: string[] = [];
  const visit = (current: string) => {
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(current);
      entries.forEach((entry) => visit(path.join(current, entry)));
      return;
    }
    if (stat.isFile() && current.toLowerCase().endsWith('.json')) {
      results.push(current);
    }
  };
  visit(root);
  return results;
};

const extractComObjects = (filePath: string): ComMatchEntry[] => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const objects: any[] = Array.isArray(parsed?.objects)
      ? parsed.objects
      : Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? [parsed]
          : [];
    const lowerPath = filePath.toLowerCase();
    const source: ComMatchSource = lowerPath.includes(`${path.sep}pcom${path.sep}`)
      ? 'pcom'
      : lowerPath.includes(`${path.sep}mib${path.sep}`)
        ? 'mib'
        : 'fcom';
    return objects
      .map((obj) => {
        const objectName = String(obj?.['@objectName'] || obj?.name || obj?.objectName || '').trim();
        if (!objectName) {
          return null;
        }
        const event = obj?.event && typeof obj.event === 'object' ? obj.event : {};
        const oids = normalizeList(filterOids(JSON.stringify(obj).match(oidRegex) || []));
        return {
          objectName,
          source,
          path: filePath,
          event,
          oids,
        } as ComMatchEntry;
      })
      .filter((entry): entry is ComMatchEntry => Boolean(entry));
  } catch {
    return [];
  }
};

const comIndexCache = new Map<
  string,
  { index: ComIndex; builtAt: number; fileCount: number }
>();

const buildComIndex = (comsRoot: string, vendor?: string) => {
  const cacheKey = `${comsRoot}::${(vendor || 'all').toLowerCase()}`;
  const cached = comIndexCache.get(cacheKey);
  const now = Date.now();
  if (cached && (MATCH_CACHE_TTL_MS === 0 || now - cached.builtAt <= MATCH_CACHE_TTL_MS)) {
    return { ...cached, cacheHit: true };
  }
  const byOid = new Map<string, ComMatchEntry[]>();
  const byName = new Map<string, ComMatchEntry[]>();
  let count = 0;
  const files = listComJsonFiles(comsRoot).filter((filePath) => shouldIncludeComFile(filePath, vendor));
  files.forEach((filePath) => {
    const entries = extractComObjects(filePath);
    entries.forEach((entry) => {
      count += 1;
      entry.oids.forEach((oid) => {
        if (!byOid.has(oid)) {
          byOid.set(oid, []);
        }
        byOid.get(oid)!.push(entry);
      });
      const normalized = normalizeMatchKey(entry.objectName);
      if (normalized) {
        if (!byName.has(normalized)) {
          byName.set(normalized, []);
        }
        byName.get(normalized)!.push(entry);
      }
    });
  });
  const index = { byOid, byName, count };
  comIndexCache.set(cacheKey, { index, builtAt: now, fileCount: files.length });
  return { index, builtAt: now, fileCount: files.length, cacheHit: false };
};

const pickBestMatch = (
  legacy: LegacyObject,
  candidates: ComMatchEntry[],
): { entry: ComMatchEntry; score: number } | null => {
  if (candidates.length === 0) {
    return null;
  }
  const legacyName = normalizeMatchKey(legacy.ruleFunction);
  const legacySummary = legacy.summaryPatterns[0] ? String(legacy.summaryPatterns[0]).trim() : '';
  const legacyHelpKey = legacy.helpKeys[0] ? String(legacy.helpKeys[0]).trim() : '';
  const legacyOids = new Set(legacy.oids);

  let bestEntry: ComMatchEntry | null = null;
  let bestScore = 0;
  candidates.forEach((entry) => {
    let score = 0;
    const entryName = normalizeMatchKey(entry.objectName);
    const nameSuffix = entry.objectName.split('::').pop() || entry.objectName;
    const suffixKey = normalizeMatchKey(nameSuffix);
    if (legacyName && (legacyName === entryName || legacyName === suffixKey)) {
      score += 5;
    } else if (legacyName && (entryName.includes(legacyName) || suffixKey.includes(legacyName))) {
      score += 2;
    }
    entry.oids.forEach((oid) => {
      if (legacyOids.has(oid)) {
        score += 10;
      }
    });
    const eventSummary = entry.event?.Summary ? String(entry.event.Summary).trim() : '';
    if (legacySummary && eventSummary && legacySummary === eventSummary) {
      score += 2;
    }
    const eventHelpKey = entry.event?.HelpKey ? String(entry.event.HelpKey).trim() : '';
    if (legacyHelpKey && eventHelpKey && legacyHelpKey === eventHelpKey) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  });
  return bestScore > 0 && bestEntry ? { entry: bestEntry, score: bestScore } : null;
};

const buildMatchDiffs = (
  objects: LegacyObject[],
  options: LegacyConversionOptions,
): { diffs: LegacyMatchDiff[]; stats: LegacyMatchStats | null } => {
  if ((process.env.LEGACY_MATCH_EXISTING || '').toLowerCase() === 'false') {
    return { diffs: [], stats: null };
  }
  const comsRoot = resolveComsRoot(options.inputs);
  if (!comsRoot) {
    return { diffs: [], stats: null };
  }
  if (objects.length === 0) {
    return { diffs: [], stats: null };
  }
  const indexResult = buildComIndex(comsRoot, options.vendor);
  const index = indexResult.index;
  if (index.count === 0) {
    return { diffs: [], stats: null };
  }
  const stats: LegacyMatchStats = {
    indexEntries: index.count,
    indexFiles: indexResult.fileCount,
    indexBuiltAt: new Date(indexResult.builtAt).toISOString(),
    indexAgeMs: Date.now() - indexResult.builtAt,
    cacheHit: indexResult.cacheHit,
    vendor: options.vendor,
  };

  const diffs: LegacyMatchDiff[] = [];
  objects.forEach((obj) => {
    const oidCandidates = obj.oids.flatMap((oid) => index.byOid.get(oid) || []);
    const nameCandidates = obj.ruleFunction
      ? index.byName.get(normalizeMatchKey(obj.ruleFunction)) || []
      : [];
    const candidates = Array.from(new Set([...oidCandidates, ...nameCandidates]));
    const matchResult = pickBestMatch(obj, candidates);
    if (!matchResult) {
      return;
    }
    const match = matchResult.entry;
    const legacyOids = new Set(obj.oids);
    const matchOids = match.oids.filter((oid) => legacyOids.has(oid));
    const legacyNameKey = normalizeMatchKey(obj.ruleFunction);
    const entryNameKey = normalizeMatchKey(match.objectName);
    const entrySuffixKey = normalizeMatchKey(match.objectName.split('::').pop() || match.objectName);
    const hasNameMatch =
      legacyNameKey &&
      (legacyNameKey === entryNameKey ||
        legacyNameKey === entrySuffixKey ||
        entryNameKey.includes(legacyNameKey) ||
        entrySuffixKey.includes(legacyNameKey));
    const matchMethod: LegacyMatchDiff['matchMethod'] = matchOids.length > 0
      ? 'oid'
      : hasNameMatch
        ? 'name'
        : 'heuristic';
    const legacyName = obj.ruleFunction !== '__global__' ? obj.ruleFunction : `legacy_${obj.oids[0] || 'unknown'}`;
    const legacyFields: Record<string, string | undefined> = {
      Summary: obj.summaryPatterns[0],
      Severity: obj.severityAssignments.find((entry) => entry.severity)?.severity,
      EventCategory: obj.severityAssignments.find((entry) => entry.eventCategory)?.eventCategory,
      HelpKey: obj.helpKeys[0],
      Node: obj.nodeValues[0],
      SubNode: obj.subNodeValues[0],
    };
    const existingFields: Record<string, string | undefined> = {
      Summary: match.event?.Summary !== undefined ? String(match.event.Summary) : undefined,
      Severity: match.event?.Severity !== undefined ? String(match.event.Severity) : undefined,
      EventCategory: match.event?.EventCategory !== undefined ? String(match.event.EventCategory) : undefined,
      HelpKey: match.event?.HelpKey !== undefined ? String(match.event.HelpKey) : undefined,
      Node: match.event?.Node !== undefined ? String(match.event.Node) : undefined,
      SubNode: match.event?.SubNode !== undefined ? String(match.event.SubNode) : undefined,
    };
    const diffEntries = Object.keys(legacyFields).reduce<Array<{ field: string; legacyValue?: string; existingValue?: string }>>(
      (acc, key) => {
        const legacyValue = legacyFields[key];
        const existingValue = existingFields[key];
        if (!legacyValue && !existingValue) {
          return acc;
        }
        if (legacyValue === existingValue) {
          return acc;
        }
        acc.push({ field: key, legacyValue, existingValue });
        return acc;
      },
      [],
    );
    diffs.push({
      legacyObjectId: obj.id,
      legacyObjectName: legacyName,
      sourceFile: obj.sourceFile,
      matchMethod,
      matchScore: matchResult.score,
      matchedObject: {
        name: match.objectName,
        source: match.source,
        path: match.path,
      },
      diffs: diffEntries,
    });
  });

  return { diffs, stats };
};

const isDispatcherFile = (filePath: string) => {
  return path.basename(filePath).toLowerCase() === 'base.rules';
};

const deriveClassificationHints = (analysis: LegacyFileAnalysis, classification: LegacyFileClassification) => {
  const hints: string[] = [];
  if (isDispatcherFile(analysis.filePath)) {
    hints.push('DispatcherOnly');
  }
  if (analysis.eventFields.length > 0) {
    hints.push('EventFields');
  }
  if (analysis.eventFields.includes('Severity')) {
    hints.push('SeverityField');
  }
  if (analysis.eventFields.includes('EventCategory')) {
    hints.push('EventCategoryField');
  }
  if (analysis.summaryPatterns.length > 0) {
    hints.push('SummaryField');
  }
  analysis.performanceHints.forEach((hint) => hints.push(hint));
  if (analysis.snmpHints.length > 0) {
    hints.push('SnmpHint');
  }
  if (analysis.oids.length > 0) {
    hints.push('OidValues');
  }
  if (hints.length === 0) {
    hints.push(classification.ruleType === 'unknown' ? 'Unknown' : 'Unspecified');
  }
  return hints;
};

const globToRegex = (pattern: string) => {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regexText = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regexText, 'i');
};

const matchesAny = (value: string, patterns?: string[]) => {
  if (!patterns || patterns.length === 0) {
    return true;
  }
  return patterns.some((pattern) => globToRegex(pattern).test(value));
};

const excludedBy = (value: string, patterns?: string[]) => {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => globToRegex(pattern).test(value));
};

const detectFileType = (filePath: string): 'rules' | 'pl' | 'other' => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.rules')) {
    return 'rules';
  }
  if (lower.endsWith('.pl')) {
    return 'pl';
  }
  return 'other';
};

type IncludeEntry = { name: string; path: string };
type DispatchRule = { condition: string; functions: string[] };
type RuleFileMeta = { path: string; declaredName?: string; rulesfileLabel?: string };

const traversalExtensions = new Set(['.rules', '.pl']);

const isPathWithinRoot = (root: string, target: string) => {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const listLegacyFiles = (root: string, recursive: boolean) => {
  const results: string[] = [];
  const visit = (current: string) => {
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(current);
      entries.forEach((entry) => {
        const next = path.join(current, entry);
        const nextStat = fs.statSync(next);
        if (nextStat.isDirectory()) {
          if (recursive) {
            visit(next);
          }
          return;
        }
        if (nextStat.isFile()) {
          const ext = path.extname(next).toLowerCase();
          if (traversalExtensions.has(ext)) {
            results.push(next);
          }
        }
      });
      return;
    }
    if (stat.isFile()) {
      const ext = path.extname(current).toLowerCase();
      if (traversalExtensions.has(ext)) {
        results.push(current);
      }
    }
  };
  visit(root);
  return results;
};

const parseBaseIncludes = (filePath: string): IncludeEntry[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes(','))
    .map((line) => {
      const [name, value] = line.split(',', 2).map((chunk) => chunk.trim());
      return name && value ? { name, path: value } : null;
    })
    .filter((entry): entry is IncludeEntry => Boolean(entry));
};

const parseDispatchRules = (filePath: string): DispatchRule[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const dispatches: DispatchRule[] = [];
  const conditionPattern = /^\s*(if|elsif)\s*\((.+)\)\s*\{\s*$/;
  const functionPattern = /\b([A-Za-z0-9_]+)\s*\(\s*\)\s*;/;
  let currentCondition: string | null = null;
  let currentFunctions: string[] = [];

  lines.forEach((line) => {
    const conditionMatch = line.match(conditionPattern);
    if (conditionMatch) {
      if (currentCondition) {
        dispatches.push({ condition: currentCondition, functions: currentFunctions });
      }
      currentCondition = conditionMatch[2].trim();
      currentFunctions = [];
      return;
    }
    const funcMatch = line.match(functionPattern);
    if (funcMatch && currentCondition) {
      currentFunctions.push(funcMatch[1]);
    }
  });

  if (currentCondition) {
    dispatches.push({ condition: currentCondition, functions: currentFunctions });
  }
  return dispatches;
};

const parseBaseLoad = (filePath: string): string[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const calls: string[] = [];
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*\(\s*\)\s*;\s*$/);
    if (match) {
      calls.push(match[1]);
    }
  });
  return calls;
};

const parseRuleMetadata = (filePath: string): RuleFileMeta => {
  const content = fs.readFileSync(filePath, 'utf8');
  const nameMatch = content.match(/^#\s*Name:\s*(.+)$/m);
  const rulesfileMatch = content.match(/\$rulesfile\s*=\s*"([^"]+)"/);
  return {
    path: filePath,
    declaredName: nameMatch ? nameMatch[1].trim() : undefined,
    rulesfileLabel: rulesfileMatch ? rulesfileMatch[1].trim() : undefined,
  };
};

const resolveIncludePath = (root: string, includePath: string) => {
  if (!includePath) {
    return undefined;
  }
  if (path.isAbsolute(includePath)) {
    if (fs.existsSync(includePath) && isPathWithinRoot(root, includePath)) {
      return includePath;
    }
    return undefined;
  }
  const candidate = path.resolve(root, includePath);
  if (fs.existsSync(candidate) && isPathWithinRoot(root, candidate)) {
    return candidate;
  }
  return undefined;
};

const matchRuleByName = (name: string, ruleMetas: RuleFileMeta[]) => {
  const target = name.toLowerCase();
  return ruleMetas.find((meta) => {
    const base = path.basename(meta.path).toLowerCase();
    const declared = meta.declaredName?.toLowerCase();
    return base.includes(target) || (declared ? declared === target : false);
  })?.path;
};

const hasBaseFiles = (root: string) => {
  const baseRules = path.join(root, 'base.rules');
  const baseIncludes = path.join(root, 'base.includes');
  const baseLoad = path.join(root, 'base.load');
  return fs.existsSync(baseRules) || fs.existsSync(baseIncludes) || fs.existsSync(baseLoad);
};

const discoverForDirectory = (root: string): LegacyTraversalResult => {
  const orderedFiles: string[] = [];
  const entries: LegacyTraversalEntry[] = [];
  const missingFunctions = new Set<string>();
  const includeDetails: LegacyTraversalInclude[] = [];
  const loadCalls = new Set<string>();
  const missingLoadCalls = new Set<string>();
  const missingIncludePaths = new Set<string>();
  const missingLookupFiles = new Set<string>();
  const orderedSet = new Set<string>();

  const addEntry = (filePath: string, kind: LegacyTraversalEntry['kind'], functionName?: string, condition?: string) => {
    if (!filePath || orderedSet.has(filePath)) {
      return;
    }
    orderedSet.add(filePath);
    orderedFiles.push(filePath);
    entries.push({ kind, root, filePath, functionName, condition });
  };

  const addNestedEntry = (entry: LegacyTraversalEntry) => {
    if (!entry.filePath || orderedSet.has(entry.filePath)) {
      return;
    }
    orderedSet.add(entry.filePath);
    orderedFiles.push(entry.filePath);
    entries.push(entry);
  };

  if (!hasBaseFiles(root)) {
    const subdirs = fs
      .readdirSync(root)
      .map((entry) => path.join(root, entry))
      .filter((entry) => fs.statSync(entry).isDirectory());
    const candidates = subdirs.filter((dir) => hasBaseFiles(dir)).sort();
    if (candidates.length > 0) {
      candidates.forEach((dir) => {
        const nested = discoverForDirectory(dir);
        nested.entries.forEach((entry) => addNestedEntry(entry));
        nested.missingFunctions.forEach((name) => missingFunctions.add(name));
        nested.includeEntries.forEach((entry) => includeDetails.push(entry));
        nested.loadCalls.forEach((call) => loadCalls.add(call));
        nested.missingLoadCalls.forEach((call) => missingLoadCalls.add(call));
        nested.missingIncludePaths.forEach((value) => missingIncludePaths.add(value));
        nested.missingLookupFiles.forEach((value) => missingLookupFiles.add(value));
      });
      return {
        orderedFiles,
        entries,
        missingFunctions: Array.from(missingFunctions),
        includeEntries: includeDetails,
        loadCalls: Array.from(loadCalls),
        missingLoadCalls: Array.from(missingLoadCalls),
        missingIncludePaths: Array.from(missingIncludePaths),
        missingLookupFiles: Array.from(missingLookupFiles),
      };
    }

    listLegacyFiles(root, true)
      .sort()
      .forEach((filePath) => addEntry(filePath, 'standalone'));
    return {
      orderedFiles,
      entries,
      missingFunctions: Array.from(missingFunctions),
      includeEntries: includeDetails,
      loadCalls: Array.from(loadCalls),
      missingLoadCalls: Array.from(missingLoadCalls),
      missingIncludePaths: Array.from(missingIncludePaths),
      missingLookupFiles: Array.from(missingLookupFiles),
    };
  }

  const baseIncludesPath = path.join(root, 'base.includes');
  const baseRulesPath = path.join(root, 'base.rules');
  const baseLoadPath = path.join(root, 'base.load');
  const includeEntries = parseBaseIncludes(baseIncludesPath);
  const dispatchRules = parseDispatchRules(baseRulesPath);
  parseBaseLoad(baseLoadPath).forEach((call) => loadCalls.add(call));
  const legacyFiles = listLegacyFiles(root, false);
  const ruleFiles = legacyFiles.filter((filePath) => filePath.toLowerCase().endsWith('.rules'));
  const ruleMetas = ruleFiles.map((filePath) => parseRuleMetadata(filePath));

  const includeMatches = new Map<string, string>();
  includeEntries.forEach((entry) => {
    const resolved = resolveIncludePath(root, entry.path);
    if (resolved && traversalExtensions.has(path.extname(resolved).toLowerCase())) {
      includeMatches.set(entry.name, resolved);
      includeDetails.push({
        name: entry.name,
        path: entry.path,
        resolvedPath: resolved,
        exists: true,
      });
      return;
    }
    const match = matchRuleByName(entry.name, ruleMetas);
    if (match) {
      includeMatches.set(entry.name, match);
      includeDetails.push({
        name: entry.name,
        path: entry.path,
        resolvedPath: match,
        exists: true,
      });
    } else {
      includeDetails.push({
        name: entry.name,
        path: entry.path,
        resolvedPath: undefined,
        exists: false,
      });
      missingFunctions.add(entry.name);
      missingIncludePaths.add(entry.path);
      const ext = path.extname(entry.path).toLowerCase();
      if (ext === '.pl' || ext === '.pm') {
        missingLookupFiles.add(entry.path);
      }
    }
  });

  if (loadCalls.size > 0) {
    loadCalls.forEach((call) => {
      const resolved = includeMatches.get(call) || matchRuleByName(call, ruleMetas);
      if (!resolved) {
        missingLoadCalls.add(call);
      }
    });
  }

  if (dispatchRules.length > 0) {
    dispatchRules.forEach((dispatch) => {
      dispatch.functions.forEach((fn) => {
        const resolved = includeMatches.get(fn) || matchRuleByName(fn, ruleMetas);
        if (resolved) {
          addEntry(resolved, 'dispatch', fn, dispatch.condition);
        } else {
          missingFunctions.add(fn);
        }
      });
    });
  } else {
    includeEntries.forEach((entry) => {
      const resolved = includeMatches.get(entry.name);
      if (resolved) {
        addEntry(resolved, 'include', entry.name);
      } else {
        missingFunctions.add(entry.name);
      }
    });
  }

  legacyFiles
    .filter((filePath) => !orderedSet.has(filePath))
    .sort()
    .forEach((filePath) => addEntry(filePath, 'fallback'));

  return {
    orderedFiles,
    entries,
    missingFunctions: Array.from(missingFunctions),
    includeEntries: includeDetails,
    loadCalls: Array.from(loadCalls),
    missingLoadCalls: Array.from(missingLoadCalls),
    missingIncludePaths: Array.from(missingIncludePaths),
    missingLookupFiles: Array.from(missingLookupFiles),
  };
};

export const discoverLegacyTraversal = (inputs: string[]): LegacyTraversalResult => {
  const orderedFiles: string[] = [];
  const entries: LegacyTraversalEntry[] = [];
  const missingFunctions = new Set<string>();
  const includeDetails: LegacyTraversalInclude[] = [];
  const loadCalls = new Set<string>();
  const missingLoadCalls = new Set<string>();
  const missingIncludePaths = new Set<string>();
  const missingLookupFiles = new Set<string>();
  const orderedSet = new Set<string>();

  const addEntry = (entry: LegacyTraversalEntry) => {
    if (!entry.filePath || orderedSet.has(entry.filePath)) {
      return;
    }
    orderedSet.add(entry.filePath);
    orderedFiles.push(entry.filePath);
    entries.push(entry);
  };

  inputs.forEach((input) => {
    if (!fs.existsSync(input)) {
      return;
    }
    const stat = fs.statSync(input);
    if (stat.isFile()) {
      addEntry({ kind: 'standalone', root: path.dirname(input), filePath: input });
      return;
    }
    if (stat.isDirectory()) {
      const result = discoverForDirectory(input);
      result.entries.forEach((entry) => addEntry(entry));
      result.missingFunctions.forEach((name) => missingFunctions.add(name));
      result.includeEntries.forEach((entry) => includeDetails.push(entry));
      result.loadCalls.forEach((call) => loadCalls.add(call));
      result.missingLoadCalls.forEach((call) => missingLoadCalls.add(call));
      result.missingIncludePaths.forEach((value) => missingIncludePaths.add(value));
      result.missingLookupFiles.forEach((value) => missingLookupFiles.add(value));
    }
  });

  return {
    orderedFiles,
    entries,
    missingFunctions: Array.from(missingFunctions),
    includeEntries: includeDetails,
    loadCalls: Array.from(loadCalls),
    missingLoadCalls: Array.from(missingLoadCalls),
    missingIncludePaths: Array.from(missingIncludePaths),
    missingLookupFiles: Array.from(missingLookupFiles),
  };
};

const listInputFiles = (inputs: string[], includePatterns?: string[], excludePatterns?: string[]) => {
  const files: string[] = [];
  const visit = (target: string) => {
    if (!fs.existsSync(target)) {
      return;
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      fs.readdirSync(target).forEach((entry) => visit(path.join(target, entry)));
      return;
    }
    if (!stat.isFile()) {
      return;
    }
    const rel = path.basename(target);
    if (!matchesAny(rel, includePatterns)) {
      return;
    }
    if (excludedBy(rel, excludePatterns)) {
      return;
    }
    files.push(target);
  };
  inputs.forEach((input) => visit(path.resolve(input)));
  return files;
};

const splitFunctionBlocks = (content: string) => {
  const lines = content.split(/\r?\n/);
  const blocks: LegacyFunctionBlock[] = [];
  let currentName = '__global__';
  let startLine = 1;
  let buffer: string[] = [];

  const flush = (endLine: number) => {
    const text = buffer.join('\n').trim();
    if (text) {
      blocks.push({
        name: currentName,
        startLine,
        endLine,
        text,
      });
    }
  };

  lines.forEach((line, index) => {
    const match = line.match(/^\s*sub\s+([A-Za-z0-9_]+)/);
    if (match) {
      flush(index);
      currentName = match[1];
      startLine = index + 1;
      buffer = [line];
      return;
    }
    buffer.push(line);
  });

  flush(lines.length);
  return blocks;
};

const extractSeverityMaps = (content: string) => {
  const maps: Record<string, { severity: string; eventCategory: string }> = {};
  const mapRegex = /'([^']+)'\s*=>\s*\{[^}]*?Severity\s*=>\s*'?(\d+)'?[^}]*?EventCategory\s*=>\s*'?(\d+)'?/gs;
  let match = mapRegex.exec(content);
  while (match) {
    maps[match[1]] = { severity: match[2], eventCategory: match[3] };
    match = mapRegex.exec(content);
  }
  return maps;
};

const extractAnalysis = (filePath: string): LegacyFileAnalysis => {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileType = detectFileType(filePath);
  const stat = fs.statSync(filePath);
  const functionBlocks = splitFunctionBlocks(content);
  const oids = normalizeList(filterOids(content.match(oidRegex) || []));
  const eventFields = normalizeList(Array.from(content.matchAll(eventFieldRegex)).map((m) => m[1]));
  const summaryPatterns = normalizeList(Array.from(content.matchAll(summaryRegex)).map((m) => m[1].trim()));
  const helpKeys = normalizeList(Array.from(content.matchAll(helpKeyRegex)).map((m) => m[1].trim()));
  const nodeValues = normalizeList(Array.from(content.matchAll(nodeRegex)).map((m) => m[1].trim()));
  const subNodeValues = normalizeList(Array.from(content.matchAll(subNodeRegex)).map((m) => m[1].trim()));
  const performanceHints = normalizeList(extractPerformanceHints(content));
  const severityAssignments: SeverityAssignment[] = normalizeList(
    Array.from(content.matchAll(severityAssignRegex)).map((m) => m[1]),
  ).map((severity) => ({ severity }));
  const eventCategoryAssignments: SeverityAssignment[] = normalizeList(
    Array.from(content.matchAll(eventCategoryAssignRegex)).map((m) => m[1]),
  ).map((eventCategory) => ({ eventCategory }));

  const mergedAssignments: SeverityAssignment[] = [...severityAssignments, ...eventCategoryAssignments];

  const snmpHints = snmpHintRegex.test(content) ? ['snmp'] : [];
  const severityMaps = fileType === 'pl' ? extractSeverityMaps(content) : {};
  const lookupPairs = fileType === 'pl' ? extractLookupPairs(content) : [];
  const variableMappingsByFunction = buildVariableMappingsByFunction(functionBlocks);

  return {
    filePath,
    fileType,
    size: stat.size,
    functionBlocks,
    oids,
    eventFields,
    summaryPatterns,
    helpKeys,
    nodeValues,
    subNodeValues,
    performanceHints,
    severityAssignments: mergedAssignments,
    severityMaps,
    lookupPairs,
    variableMappingsByFunction,
    snmpHints,
  };
};

const classifyFile = (analysis: LegacyFileAnalysis): LegacyFileClassification => {
  if (isDispatcherFile(analysis.filePath)) {
    return {
      filePath: analysis.filePath,
      ruleType: 'unknown',
      confidence: 0.1,
      evidence: {
        eventFields: analysis.eventFields,
        oidCount: analysis.oids.length,
        snmpHints: analysis.snmpHints,
        performanceHints: analysis.performanceHints,
      },
    };
  }
  const hasEventFields = analysis.eventFields.length > 0;
  const hasSeverityFields =
    analysis.eventFields.includes('Severity') || analysis.eventFields.includes('EventCategory');
  const hasSummaryPatterns = analysis.summaryPatterns.length > 0;
  const hasOids = analysis.oids.length > 0;
  const performanceHintScore = analysis.performanceHints.length * 0.12;
  const snmpScore = analysis.snmpHints.length > 0 ? 0.1 : 0;

  let ruleType: LegacyRuleType = 'unknown';
  let confidence = 0;

  if (hasEventFields) {
    ruleType = 'fault';
    confidence = 0.7;
    if (hasSeverityFields) {
      confidence += 0.15;
    }
    if (hasSummaryPatterns) {
      confidence += 0.05;
    }
    if (hasOids) {
      confidence += 0.05;
    }
    confidence = Math.min(1, confidence);
  } else if (analysis.performanceHints.length > 0) {
    ruleType = 'performance';
    confidence = Math.min(1, 0.55 + performanceHintScore + snmpScore);
  } else if (analysis.snmpHints.length > 0) {
    ruleType = 'performance';
    confidence = 0.35;
  } else if (hasOids) {
    ruleType = 'unknown';
    confidence = 0.25;
  }

  return {
    filePath: analysis.filePath,
    ruleType,
    confidence,
    evidence: {
      eventFields: analysis.eventFields,
      oidCount: analysis.oids.length,
      snmpHints: analysis.snmpHints,
      performanceHints: analysis.performanceHints,
    },
  };
};

const buildLegacyObjects = (analysis: LegacyFileAnalysis, classification: LegacyFileClassification) => {
  if (isDispatcherFile(analysis.filePath)) {
    return [];
  }
  const objects: LegacyObject[] = [];
  const classificationHints = deriveClassificationHints(analysis, classification);
  analysis.functionBlocks.forEach((block) => {
    const blockOids = normalizeList(filterOids(block.text.match(oidRegex) || []));
    const blockEventFields = normalizeList(Array.from(block.text.matchAll(eventFieldRegex)).map((m) => m[1]));
    const blockSummaryPatterns = normalizeList(
      Array.from(block.text.matchAll(summaryRegex)).map((m) => m[1].trim()),
    );
    const blockHelpKeys = normalizeList(Array.from(block.text.matchAll(helpKeyRegex)).map((m) => m[1].trim()));
    const blockNodeValues = normalizeList(Array.from(block.text.matchAll(nodeRegex)).map((m) => m[1].trim()));
    const blockSubNodeValues = normalizeList(Array.from(block.text.matchAll(subNodeRegex)).map((m) => m[1].trim()));
    const blockSeverities: SeverityAssignment[] = normalizeList(
      Array.from(block.text.matchAll(severityAssignRegex)).map((m) => m[1]),
    ).map((severity) => ({ severity }));
    const blockCategories: SeverityAssignment[] = normalizeList(
      Array.from(block.text.matchAll(eventCategoryAssignRegex)).map((m) => m[1]),
    ).map((eventCategory) => ({ eventCategory }));

    const mergedAssignments: SeverityAssignment[] = [...blockSeverities, ...blockCategories];

    if (blockOids.length === 0 && blockEventFields.length === 0) {
      return;
    }

    objects.push({
      id: `${analysis.filePath}::${block.name}`,
      sourceFile: analysis.filePath,
      ruleFunction: block.name,
      ruleType: classification.ruleType,
      oids: blockOids,
      eventFields: blockEventFields,
      summaryPatterns: blockSummaryPatterns,
      helpKeys: blockHelpKeys,
      nodeValues: blockNodeValues,
      subNodeValues: blockSubNodeValues,
      performanceHints: analysis.performanceHints,
      classificationHints,
      severityAssignments: mergedAssignments,
    });
  });
  return objects;
};

const buildOverrideProposals = (objects: LegacyObject[]) => {
  return objects
    .filter((obj) => obj.ruleType === 'fault')
    .map((obj) => {
      const fields: Record<string, string> = {};
      const severity = obj.severityAssignments.find((entry) => entry.severity)?.severity;
      const eventCategory = obj.severityAssignments.find((entry) => entry.eventCategory)?.eventCategory;
      const helpKey = obj.helpKeys[0];
      const nodeValue = obj.nodeValues[0];
      const subNodeValue = obj.subNodeValues[0];
      if (severity) {
        fields.Severity = severity;
      }
      if (eventCategory) {
        fields.EventCategory = eventCategory;
      }
      if (obj.summaryPatterns.length > 0) {
        fields.Summary = obj.summaryPatterns[0];
      }
      if (helpKey) {
        fields.HelpKey = helpKey;
      }
      if (nodeValue) {
        fields.Node = nodeValue;
      }
      if (subNodeValue) {
        fields.SubNode = subNodeValue;
      }
      const objectName = obj.ruleFunction !== '__global__' ? obj.ruleFunction : `legacy_${obj.oids[0] || 'unknown'}`;
      return {
        objectName,
        sourceFile: obj.sourceFile,
        ruleFunction: obj.ruleFunction,
        fields,
        reason: 'Legacy rule conversion (phase 1 proposal).',
      };
    });
};

const expressionHasLegacySyntax = (expression: string) => {
  return perlSigilRegex.test(expression) || concatRegex.test(expression);
};

const createManualStub = (
  proposal: LegacyOverrideProposal,
  field: string,
  expression: string,
  note: string,
): LegacyProcessorStub => ({
  objectName: proposal.objectName,
  sourceFile: proposal.sourceFile,
  ruleFunction: proposal.ruleFunction,
  targetField: `$.event.${field}`,
  expression,
  status: 'manual',
  recommendedProcessor: 'manual',
  requiredMappings: [],
  notes: [note],
  documentationRefs: DOC_REFS,
});

const scoreProcessorStubConfidence = (
  stub: LegacyProcessorStub,
): { score: number; level: 'high' | 'medium' | 'low'; rationale: string } => {
  let score = 0.75;

  if (stub.status === 'direct') {
    score = 0.9;
  } else if (stub.status === 'conditional') {
    score = 0.62;
  } else if (stub.status === 'manual') {
    score = 0.3;
  }

  if (stub.requiredMappings.length > 0) {
    score -= 0.12;
  }

  const noteText = (stub.notes || []).join(' ').toLowerCase();
  const isRegexChain = stub.recommendedProcessor === 'if' || noteText.includes('regex-capture');
  if (isRegexChain) {
    score += stub.status === 'direct' ? -0.06 : -0.12;
  }

  if (noteText.includes('heuristic')) {
    score -= 0.08;
  }

  score = Math.max(0.05, Math.min(0.98, score));
  const rounded = Number(score.toFixed(2));
  const level: 'high' | 'medium' | 'low' = rounded >= 0.8 ? 'high' : rounded >= 0.55 ? 'medium' : 'low';

  const rationaleParts: string[] = [];
  rationaleParts.push(`status=${stub.status}`);
  if (stub.requiredMappings.length > 0) {
    rationaleParts.push(`requiredMappings=${stub.requiredMappings.length}`);
  }
  if (isRegexChain) {
    rationaleParts.push('regex-branch-chain');
  }
  if (noteText.includes('heuristic')) {
    rationaleParts.push('heuristic-mapping');
  }

  return {
    score: rounded,
    level,
    rationale: rationaleParts.join(', '),
  };
};

const buildAnalysisIndex = (analyses: LegacyFileAnalysis[]) => {
  const byFile = new Map<string, LegacyFileAnalysis>();
  analyses.forEach((analysis) => {
    byFile.set(analysis.filePath, analysis);
  });
  return byFile;
};

type ResolvedVariableMapping = {
  kind: 'path' | 'literal';
  value: string | number | boolean;
  note?: string;
};

type RegexCaptureContext = {
  captureVar: string;
  captureGroup: number;
  sourceVar: string;
  extractionPattern: string;
  extractionFlags?: string;
  conditionPattern?: string;
  conditionFlags?: string;
};

type ParsedConcatSet = {
  source: string;
  args?: string[];
  requiredMappings: string[];
  unresolvedParts: string[];
  mappingNotes: string[];
};

const findFunctionBlock = (analysis: LegacyFileAnalysis, ruleFunction: string) => {
  return (
    analysis.functionBlocks.find((block) => block.name === ruleFunction) ||
    analysis.functionBlocks.find((block) => block.name === '__global__') ||
    null
  );
};

const extractFieldAssignmentsFromText = (blockText: string, field: string) => {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignmentRegex = new RegExp(
    `\\$Event\\s*->\\s*\\{\\s*['\"]?${escapedField}['\"]?\\s*}\\s*=\\s*(.+?);`,
    'g',
  );
  const values: string[] = [];
  let match = assignmentRegex.exec(blockText);
  while (match) {
    values.push(String(match[1] || '').trim());
    match = assignmentRegex.exec(blockText);
  }
  return values;
};

const parseRegexCaptureContexts = (blockText: string) => {
  const lines = blockText.split(/\r?\n/);
  const contexts = new Map<string, RegexCaptureContext>();
  const recentRegexByLine = new Map<number, { sourceVar: string; pattern: string; flags?: string }>();
  const recentConditionByLine = new Map<number, { sourceVar: string; pattern: string; flags?: string }>();
  const inlineIfRegex = /\b(?:if|elsif)\s*\(\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=~\s*\/(.+?)\/([a-z]*)\s*\)/;
  const regexEvalRegex = /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=~\s*\/(.+?)\/([a-z]*)\s*;\s*$/;
  const captureAssignRegex = /^\s*(?:my\s+)?\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$([1-9])\s*;\s*$/;

  lines.forEach((line, lineIndex) => {
    const ifMatch = line.match(inlineIfRegex);
    if (ifMatch) {
      recentConditionByLine.set(lineIndex, {
        sourceVar: ifMatch[1],
        pattern: ifMatch[2],
        flags: ifMatch[3] || undefined,
      });
    }

    const regexEvalMatch = line.match(regexEvalRegex);
    if (regexEvalMatch) {
      recentRegexByLine.set(lineIndex, {
        sourceVar: regexEvalMatch[1],
        pattern: regexEvalMatch[2],
        flags: regexEvalMatch[3] || undefined,
      });
      return;
    }

    const captureMatch = line.match(captureAssignRegex);
    if (!captureMatch) {
      return;
    }

    const captureVar = captureMatch[1];
    const captureGroup = Number(captureMatch[2]);
    let regexContext: { sourceVar: string; pattern: string; flags?: string } | null = null;
    for (let back = lineIndex - 1; back >= Math.max(0, lineIndex - 8); back -= 1) {
      const maybe = recentRegexByLine.get(back);
      if (maybe) {
        regexContext = maybe;
        break;
      }
    }
    if (!regexContext) {
      return;
    }

    let conditionContext: { sourceVar: string; pattern: string; flags?: string } | null = null;
    for (let back = lineIndex - 1; back >= Math.max(0, lineIndex - 12); back -= 1) {
      const maybe = recentConditionByLine.get(back);
      if (maybe && maybe.sourceVar === regexContext.sourceVar) {
        conditionContext = maybe;
        break;
      }
    }

    contexts.set(captureVar, {
      captureVar,
      captureGroup,
      sourceVar: regexContext.sourceVar,
      extractionPattern: regexContext.pattern,
      extractionFlags: regexContext.flags,
      conditionPattern: conditionContext?.pattern,
      conditionFlags: conditionContext?.flags,
    });
  });

  return contexts;
};

const parseConcatExpressionToSet = (
  expression: string,
  proposal: LegacyOverrideProposal,
  analysisIndex: Map<string, LegacyFileAnalysis>,
  extraMappings?: Record<string, ResolvedVariableMapping>,
): ParsedConcatSet | null => {
  const concatParts = splitConcatExpression(expression);
  if (concatParts.length === 0) {
    return null;
  }

  const formatParts: string[] = [];
  const args: string[] = [];
  const requiredMappings = new Set<string>();
  const unresolvedParts: string[] = [];
  const mappingNotes: string[] = [];

  concatParts.forEach((part) => {
    const eventMatch = part.match(eventRefRegex);
    if (eventMatch) {
      formatParts.push('%s');
      args.push(`$.event.${eventMatch[1]}`);
      return;
    }

    const varMatch = part.match(perlVarRegex);
    if (varMatch) {
      const variableName = varMatch[1];
      const resolvedSource = extraMappings?.[variableName] || resolveVariableMapping(proposal, variableName, analysisIndex);
      if (resolvedSource) {
        if (resolvedSource.kind === 'literal') {
          formatParts.push(String(resolvedSource.value));
        } else {
          formatParts.push('%s');
          args.push(String(resolvedSource.value));
        }
        if (resolvedSource.note) {
          mappingNotes.push(resolvedSource.note);
        }
      } else {
        formatParts.push('%s');
        args.push(`<map:${variableName}>`);
        requiredMappings.add(variableName);
      }
      return;
    }

    const trimmed = part.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      formatParts.push(stripOuterQuotes(trimmed));
      return;
    }

    unresolvedParts.push(part);
  });

  if (unresolvedParts.length > 0 || formatParts.length === 0) {
    return null;
  }

  return {
    source: formatParts.join(''),
    args: args.length > 0 ? args : undefined,
    requiredMappings: Array.from(requiredMappings),
    unresolvedParts,
    mappingNotes,
  };
};

const resolveVariableMapping = (
  proposal: LegacyOverrideProposal,
  variableName: string,
  analysisIndex: Map<string, LegacyFileAnalysis>,
): ResolvedVariableMapping | null => {
  const analysis = analysisIndex.get(proposal.sourceFile);
  if (analysis) {
    const byFunction = analysis.variableMappingsByFunction || {};
    const functionScoped = byFunction[proposal.ruleFunction] || {};
    if (functionScoped[variableName]) {
      return { kind: 'path', value: functionScoped[variableName] };
    }

    const globalScoped = byFunction.__global__ || {};
    if (globalScoped[variableName]) {
      return { kind: 'path', value: globalScoped[variableName] };
    }
  }

  const normalizedVar = variableName.toLowerCase();
  if (normalizedVar === 'ip') {
    return {
      kind: 'path',
      value: '$.source.ip',
      note: 'Resolved legacy runtime alias $ip to source.ip from trap ingress payload.',
    };
  }

  if (normalizedVar === 'generic') {
    return {
      kind: 'literal',
      value: 6,
      note: 'Mapped $generic to best-effort literal 6 (enterpriseSpecific heuristic for SNMPv2c trap flows).',
    };
  }

  return null;
};

const buildRegexDrivenStubForExpression = (
  proposal: LegacyOverrideProposal,
  field: string,
  expression: string,
  analysisIndex: Map<string, LegacyFileAnalysis>,
): LegacyProcessorStub | null => {
  const analysis = analysisIndex.get(proposal.sourceFile);
  if (!analysis) {
    return null;
  }
  const block = findFunctionBlock(analysis, proposal.ruleFunction);
  if (!block) {
    return null;
  }

  const captureContexts = parseRegexCaptureContexts(block.text);
  if (captureContexts.size === 0) {
    return null;
  }

  const variableMatches = Array.from(expression.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)).map((m) => m[1]);
  const captureVarName = variableMatches.find((name) => captureContexts.has(name));
  if (!captureVarName) {
    return null;
  }

  const captureContext = captureContexts.get(captureVarName);
  if (!captureContext) {
    return null;
  }

  const sourceMapping = resolveVariableMapping(proposal, captureContext.sourceVar, analysisIndex);
  const captureField = `$.tmp.${captureVarName}`;
  const composedSet = parseConcatExpressionToSet(expression, proposal, analysisIndex, {
    [captureVarName]: {
      kind: 'path',
      value: captureField,
      note: `Mapped extracted capture variable $${captureVarName} to temporary field ${captureField}.`,
    },
  });
  if (!composedSet) {
    return null;
  }

  const fallbackCandidates = extractFieldAssignmentsFromText(block.text, field).filter((candidate) => {
    const normalized = String(candidate || '').trim();
    return normalized && normalized !== expression && !normalized.includes(`$${captureVarName}`);
  });
  const fallbackExpression = fallbackCandidates[0] || null;
  const fallbackSet = fallbackExpression
    ? parseConcatExpressionToSet(fallbackExpression, proposal, analysisIndex)
    : null;

  const requiredMappings = new Set<string>(composedSet.requiredMappings);
  if (sourceMapping) {
    if (sourceMapping.kind === 'path') {
      // no-op
    }
  } else {
    requiredMappings.add(captureContext.sourceVar);
  }
  if (fallbackSet) {
    fallbackSet.requiredMappings.forEach((name) => requiredMappings.add(name));
  }

  const sourceField = sourceMapping?.kind === 'path'
    ? String(sourceMapping.value)
    : `<map:${captureContext.sourceVar}>`;
  const extractionPattern = captureContext.extractionPattern;
  const conditionPattern = captureContext.conditionPattern || extractionPattern;
  const status: LegacyStubStatus = requiredMappings.size > 0 ? 'conditional' : 'direct';

  const thenSteps: Array<Record<string, any>> = [
    {
      regex: {
        source: sourceField,
        pattern: extractionPattern,
        captureGroup: captureContext.captureGroup,
        targetField: captureField,
        ...(captureContext.extractionFlags ? { flags: captureContext.extractionFlags } : {}),
      },
    },
    {
      set: {
        source: composedSet.source,
        ...(composedSet.args ? { args: composedSet.args } : {}),
        targetField: `$.event.${field}`,
      },
    },
  ];

  const elseSteps: Array<Record<string, any>> = fallbackSet
    ? [
        {
          set: {
            source: fallbackSet.source,
            ...(fallbackSet.args ? { args: fallbackSet.args } : {}),
            targetField: `$.event.${field}`,
          },
        },
      ]
    : [];

  return {
    objectName: proposal.objectName,
    sourceFile: proposal.sourceFile,
    ruleFunction: proposal.ruleFunction,
    targetField: `$.event.${field}`,
    expression,
    status,
    recommendedProcessor: 'if',
    template: {
      if: {
        condition: {
          regex: {
            source: sourceField,
            pattern: conditionPattern,
            ...(captureContext.conditionFlags ? { flags: captureContext.conditionFlags } : {}),
          },
        },
        then: thenSteps,
        ...(elseSteps.length > 0 ? { else: elseSteps } : {}),
      },
    },
    requiredMappings: Array.from(requiredMappings),
    notes: [
      'Detected generic regex-capture composition and converted to branch-aware if + regex + set chain.',
      ...(sourceMapping?.note ? [sourceMapping.note] : []),
      ...composedSet.mappingNotes,
    ],
    documentationRefs: DOC_REFS,
  };
};

const buildProcessorStubForField = (
  proposal: LegacyOverrideProposal,
  field: string,
  expressionInput: string,
  analysisIndex: Map<string, LegacyFileAnalysis>,
): LegacyProcessorStub => {
  const expression = String(expressionInput || '').trim();
  const targetField = `$.event.${field}`;
  const base = {
    objectName: proposal.objectName,
    sourceFile: proposal.sourceFile,
    ruleFunction: proposal.ruleFunction,
    targetField,
    expression,
    documentationRefs: DOC_REFS,
  };

  if (!expression) {
    return createManualStub(proposal, field, expression, 'Empty expression requires manual review.');
  }

  if (!expressionHasLegacySyntax(expression)) {
    return {
      ...base,
      status: 'direct',
      recommendedProcessor: 'set',
      template: {
        set: {
          source: parseScalarLiteral(expression),
          targetField,
        },
      },
      requiredMappings: [],
      notes: ['Literal assignment converted to set processor.'],
    };
  }

  const directEventRef = expression.match(eventRefRegex);
  if (directEventRef) {
    const sourceField = directEventRef[1];
    return {
      ...base,
      status: 'direct',
      recommendedProcessor: 'copy',
      template: {
        copy: {
          source: `$.event.${sourceField}`,
          targetField,
        },
      },
      requiredMappings: [],
      notes: ['Event-field copy converted to copy processor.'],
    };
  }

  const directVarRef = expression.match(perlVarRegex);
  if (directVarRef) {
    const variableName = directVarRef[1];
    const resolvedSource = resolveVariableMapping(proposal, variableName, analysisIndex);
    if (resolvedSource) {
      if (resolvedSource.kind === 'literal') {
        return {
          ...base,
          status: 'direct',
          recommendedProcessor: 'set',
          template: {
            set: {
              source: resolvedSource.value,
              targetField,
            },
          },
          requiredMappings: [],
          notes: [
            'Variable reference resolved via built-in heuristic alias mapping and converted to set processor.',
            ...(resolvedSource.note ? [resolvedSource.note] : []),
          ],
        };
      }
      return {
        ...base,
        status: 'direct',
        recommendedProcessor: 'copy',
        template: {
          copy: {
            source: String(resolvedSource.value),
            targetField,
          },
        },
        requiredMappings: [],
        notes: [
          'Variable reference resolved via lineage/alias mapping and converted to copy processor.',
          ...(resolvedSource.note ? [resolvedSource.note] : []),
        ],
      };
    }
    return {
      ...base,
      status: 'conditional',
      recommendedProcessor: 'copy',
      template: {
        copy: {
          source: `<map:${variableName}>`,
          targetField,
        },
      },
      requiredMappings: [variableName],
      notes: ['Variable reference needs source-path mapping before automatic conversion.'],
    };
  }

  const regexDrivenStub = buildRegexDrivenStubForExpression(
    proposal,
    field,
    expression,
    analysisIndex,
  );
  if (regexDrivenStub) {
    return regexDrivenStub;
  }

  const parsedConcat = parseConcatExpressionToSet(expression, proposal, analysisIndex);
  if (parsedConcat) {
    return {
      ...base,
      status: parsedConcat.requiredMappings.length > 0 ? 'conditional' : 'direct',
      recommendedProcessor: 'set',
      template: {
        set: {
          source: parsedConcat.source,
          ...(parsedConcat.args ? { args: parsedConcat.args } : {}),
          targetField,
        },
      },
      requiredMappings: parsedConcat.requiredMappings,
      notes:
        parsedConcat.requiredMappings.length > 0
          ? ['String composition converted to set+args with variable mapping placeholders.', ...parsedConcat.mappingNotes]
          : ['String composition converted to set processor.', ...parsedConcat.mappingNotes],
    };
  }

  if (expression.includes('$extracted_value')) {
    return {
      ...base,
      status: 'conditional',
      recommendedProcessor: 'regex',
      template: {
        regex: {
          source: '<map:source_field>',
          pattern: '<pattern>',
          targetField: '<map:extracted_value>',
        },
        set: {
          source: '<compose with extracted value>',
          targetField,
        },
      },
      requiredMappings: ['source_field', 'extracted_value'],
      notes: ['Detected extracted-value composition; use regex + set (optionally inside if/else).'],
    };
  }

  return createManualStub(
    proposal,
    field,
    expression,
    'Expression shape is not safely auto-convertible; manual processor design is required.',
  );
};

const buildProcessorStubsWithAnalysis = (
  overrides: LegacyOverrideProposal[],
  analyses: LegacyFileAnalysis[],
) => {
  const stubs: LegacyProcessorStub[] = [];
  const analysisIndex = buildAnalysisIndex(analyses);
  overrides.forEach((proposal) => {
    Object.entries(proposal.fields || {}).forEach(([field, expression]) => {
      const stub = buildProcessorStubForField(proposal, field, String(expression), analysisIndex);
      stubs.push({
        ...stub,
        confidence: scoreProcessorStubConfidence(stub),
      });
    });
  });
  return stubs;
};

const buildLookupStubs = (analyses: LegacyFileAnalysis[]): LegacyLookupStub[] => {
  return analyses
    .filter((analysis) => {
      const base = path.basename(analysis.filePath).toLowerCase();
      return analysis.fileType === 'pl' && base.includes('lookup');
    })
    .map((analysis) => {
      const lookupName = deriveLookupName(analysis.filePath);
      const lookupEntries = analysis.lookupPairs.slice(0, 500).reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {});
      const hasPairs = analysis.lookupPairs.length > 0;
      return {
        sourceFile: analysis.filePath,
        lookupName,
        status: hasPairs ? 'direct' : 'manual',
        entryCount: analysis.lookupPairs.length,
        template: {
          name: lookupName,
          _type: 'lookup',
          lookup: lookupEntries,
        },
        notes: hasPairs
          ? ['Generated lookup stub from key/value pairs detected in legacy .pl file.']
          : ['No simple key/value pairs detected. Review file for custom runtime lookup logic.'],
        documentationRefs: DOC_REFS,
      };
    });
};

const buildConversionStubs = (
  overrides: LegacyOverrideProposal[],
  analyses: LegacyFileAnalysis[],
): LegacyConversionStubs => {
  const processorStubs = buildProcessorStubsWithAnalysis(overrides, analyses);
  const lookupStubs = buildLookupStubs(analyses);
  const processorDirect = processorStubs.filter((entry) => entry.status === 'direct').length;
  const processorConditional = processorStubs.filter((entry) => entry.status === 'conditional').length;
  const processorManual = processorStubs.filter((entry) => entry.status === 'manual').length;
  const lookupDirect = lookupStubs.filter((entry) => entry.status === 'direct').length;
  const lookupConditional = lookupStubs.filter((entry) => entry.status === 'conditional').length;
  const lookupManual = lookupStubs.filter((entry) => entry.status === 'manual').length;

  return {
    processorStubs,
    lookupStubs,
    summary: {
      processorTotal: processorStubs.length,
      processorDirect,
      processorConditional,
      processorManual,
      lookupTotal: lookupStubs.length,
      lookupDirect,
      lookupConditional,
      lookupManual,
    },
  };
};

const attachTraversalContext = (objects: LegacyObject[], traversal: LegacyTraversalResult) => {
  if (traversal.entries.length === 0) {
    return objects;
  }
  const byFile = traversal.entries.reduce<Record<string, LegacyTraversalEntry[]>>((acc, entry) => {
    if (!acc[entry.filePath]) {
      acc[entry.filePath] = [];
    }
    acc[entry.filePath].push(entry);
    return acc;
  }, {});

  return objects.map((obj) => {
    const candidates = byFile[obj.sourceFile] || [];
    const match = candidates.find((entry) => entry.functionName === obj.ruleFunction) || candidates[0];
    if (!match) {
      return obj;
    }
    return {
      ...obj,
      traversal: {
        kind: match.kind,
        root: match.root,
        condition: match.condition,
        functionName: match.functionName,
      },
    };
  });
};

const buildSummaries = (objects: LegacyObject[]) => {
  const byFolderMap = new Map<string, { total: number; fault: number; perf: number; unknown: number }>();
  const byFileMap = new Map<string, { total: number; fault: number; perf: number; unknown: number }>();

  objects.forEach((obj) => {
    const folder = path.dirname(obj.sourceFile);
    const fileKey = obj.sourceFile;
    const folderStats = byFolderMap.get(folder) || { total: 0, fault: 0, perf: 0, unknown: 0 };
    const fileStats = byFileMap.get(fileKey) || { total: 0, fault: 0, perf: 0, unknown: 0 };

    folderStats.total += 1;
    fileStats.total += 1;
    if (obj.ruleType === 'fault') {
      folderStats.fault += 1;
      fileStats.fault += 1;
    } else if (obj.ruleType === 'performance') {
      folderStats.perf += 1;
      fileStats.perf += 1;
    } else {
      folderStats.unknown += 1;
      fileStats.unknown += 1;
    }
    byFolderMap.set(folder, folderStats);
    byFileMap.set(fileKey, fileStats);
  });

  const byFolder = Array.from(byFolderMap.entries())
    .map(([folder, stats]) => ({
      folder,
      totalObjects: stats.total,
      faultObjects: stats.fault,
      performanceObjects: stats.perf,
      unknownObjects: stats.unknown,
    }))
    .sort((a, b) => b.totalObjects - a.totalObjects);

  const byFile = Array.from(byFileMap.entries())
    .map(([filePath, stats]) => ({
      filePath,
      totalObjects: stats.total,
      faultObjects: stats.fault,
      performanceObjects: stats.perf,
      unknownObjects: stats.unknown,
    }))
    .sort((a, b) => b.totalObjects - a.totalObjects);

  return { byFolder, byFile };
};

export const convertLegacyRules = (options: LegacyConversionOptions): LegacyConversionReport => {
  const inputs = options.inputs.map((input) => path.resolve(input));
  const traversal = discoverLegacyTraversal(inputs);
  const filteredTraversal = traversal.orderedFiles.filter((filePath) => {
    const rel = path.basename(filePath);
    return matchesAny(rel, options.includePatterns) && !excludedBy(rel, options.excludePatterns);
  });
  const files = filteredTraversal.length > 0
    ? filteredTraversal
    : listInputFiles(inputs, options.includePatterns, options.excludePatterns);
  const analyses = files.map((filePath) => extractAnalysis(filePath));
  const classifications = analyses.map((analysis) => classifyFile(analysis));
  const objects = analyses.flatMap((analysis) => {
    const classification = classifications.find((entry) => entry.filePath === analysis.filePath);
    if (!classification) {
      return [];
    }
    return buildLegacyObjects(analysis, classification);
  });
  const objectsWithTraversal = attachTraversalContext(objects, traversal);
  const overrides = buildOverrideProposals(objectsWithTraversal);
  const stubs = buildConversionStubs(overrides, analyses);
  const summaries = buildSummaries(objectsWithTraversal);
  const bundle: LegacyOverrideBundle = {
    manifest: {
      runId: `legacy-${Date.now()}`,
      createdAt: new Date().toISOString(),
      totalOverrides: overrides.length,
      inputs,
      vendor: options.vendor,
    },
    overrides,
  };
  const matchReport = buildMatchDiffs(objectsWithTraversal, options);
  const matchDiffs = matchReport.diffs;
  const totalOids = analyses.reduce((acc, entry) => acc + entry.oids.length, 0);
  const summary = {
    totalFiles: analyses.length,
    totalLegacyObjects: objects.length,
    faultFiles: classifications.filter((entry) => entry.ruleType === 'fault').length,
    performanceFiles: classifications.filter((entry) => entry.ruleType === 'performance').length,
    unknownFiles: classifications.filter((entry) => entry.ruleType === 'unknown').length,
    totalOids,
    totalOverrides: overrides.length,
    totalProcessorStubs: stubs.summary.processorTotal,
    directProcessorStubs: stubs.summary.processorDirect,
    conditionalProcessorStubs: stubs.summary.processorConditional,
    manualProcessorStubs: stubs.summary.processorManual,
    totalLookupStubs: stubs.summary.lookupTotal,
  };

  return {
    runId: bundle.manifest.runId,
    startedAt: new Date().toISOString(),
    inputs,
    vendor: options.vendor,
    options: {
      useMibs: options.useMibs,
      useLlm: options.useLlm,
    },
    traversal,
    bundle,
    files: analyses,
    classifications,
    legacyObjects: objectsWithTraversal,
    overrideProposals: overrides,
    stubs,
    matchDiffs,
    matchStats: matchReport.stats,
    summaries,
    summary,
  };
};

export const renderLegacyTextReport = (report: LegacyConversionReport) => {
  const lines: string[] = [];
  const helpKeyCount = report.legacyObjects.reduce((acc, obj) => acc + obj.helpKeys.length, 0);
  const nodeCount = report.legacyObjects.reduce((acc, obj) => acc + obj.nodeValues.length, 0);
  const subNodeCount = report.legacyObjects.reduce((acc, obj) => acc + obj.subNodeValues.length, 0);
  lines.push(`Legacy Conversion Report: ${report.runId}`);
  lines.push(`Started: ${report.startedAt}`);
  lines.push(`Inputs: ${report.inputs.join(', ')}`);
  if (report.vendor) {
    lines.push(`Vendor: ${report.vendor}`);
  }
  if (report.options) {
    lines.push(`Use MIBs: ${report.options.useMibs ? 'yes' : 'no'}`);
    lines.push(`Use LLM: ${report.options.useLlm ? 'yes' : 'no'}`);
  }
  lines.push(`Traversal files: ${report.traversal.orderedFiles.length}`);
  lines.push(`Traversal missing functions: ${report.traversal.missingFunctions.length}`);
  lines.push(`Traversal load calls: ${report.traversal.loadCalls.length}`);
  lines.push(`Missing load calls: ${report.traversal.missingLoadCalls.length}`);
  lines.push(`Missing include paths: ${report.traversal.missingIncludePaths.length}`);
  lines.push(`Missing lookup files: ${report.traversal.missingLookupFiles.length}`);
  if (report.traversal.entries.length > 0) {
    const counts = report.traversal.entries.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.kind || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const countLine = Object.entries(counts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    lines.push(`Traversal kinds: ${countLine}`);
  }
  if (report.traversal.missingFunctions.length > 0) {
    const preview = report.traversal.missingFunctions.slice(0, 15).join(', ');
    lines.push(`Missing (sample): ${preview}${report.traversal.missingFunctions.length > 15 ? ' ...' : ''}`);
  }
  if (report.traversal.missingLookupFiles.length > 0) {
    const preview = report.traversal.missingLookupFiles.slice(0, 10).join(', ');
    lines.push(`Missing lookup files (sample): ${preview}${report.traversal.missingLookupFiles.length > 10 ? ' ...' : ''}`);
  }
  if (report.traversal.orderedFiles.length > 0) {
    const previewFiles = report.traversal.orderedFiles.slice(0, 8).join(', ');
    lines.push(`Ordered files (sample): ${previewFiles}${report.traversal.orderedFiles.length > 8 ? ' ...' : ''}`);
  }
  lines.push('');
  lines.push(`Files: ${report.summary.totalFiles}`);
  lines.push(`Legacy objects: ${report.summary.totalLegacyObjects}`);
  lines.push(`Fault files: ${report.summary.faultFiles}`);
  lines.push(`Performance files: ${report.summary.performanceFiles}`);
  lines.push(`Unknown files: ${report.summary.unknownFiles}`);
  lines.push(`Total OIDs: ${report.summary.totalOids}`);
  lines.push(`Override proposals: ${report.summary.totalOverrides}`);
  lines.push(`Bundle overrides: ${report.bundle.overrides.length}`);
  lines.push(
    `Processor stubs: ${report.summary.totalProcessorStubs} ` +
      `(direct ${report.summary.directProcessorStubs}, ` +
      `conditional ${report.summary.conditionalProcessorStubs}, ` +
      `manual ${report.summary.manualProcessorStubs})`,
  );
  lines.push(`Lookup stubs: ${report.summary.totalLookupStubs}`);
  if (report.matchDiffs.length > 0) {
    lines.push(`Matched diffs: ${report.matchDiffs.length}`);
  }
  if (report.matchStats) {
    lines.push(
      `Match index: ${report.matchStats.indexEntries} objects from ` +
        `${report.matchStats.indexFiles} files ` +
        `(cache ${report.matchStats.cacheHit ? 'hit' : 'miss'})`,
    );
  }
  if (helpKeyCount > 0 || nodeCount > 0 || subNodeCount > 0) {
    lines.push(`HelpKeys: ${helpKeyCount} | Nodes: ${nodeCount} | SubNodes: ${subNodeCount}`);
  }
  if (report.summaries.byFolder.length > 0) {
    const previewFolders = report.summaries.byFolder.slice(0, 5)
      .map((entry) => `${entry.folder} (${entry.totalObjects})`)
      .join(', ');
    lines.push(`Top folders: ${previewFolders}${report.summaries.byFolder.length > 5 ? ' ...' : ''}`);
  }
  if (report.summaries.byFile.length > 0) {
    const previewFiles = report.summaries.byFile.slice(0, 5)
      .map((entry) => `${entry.filePath} (${entry.totalObjects})`)
      .join(', ');
    lines.push(`Top files: ${previewFiles}${report.summaries.byFile.length > 5 ? ' ...' : ''}`);
  }

  if (report.stubs.processorStubs.length > 0) {
    const confidenceCounts = report.stubs.processorStubs.reduce(
      (acc, entry) => {
        const level = entry.confidence?.level || 'medium';
        acc[level] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );
    lines.push(
      `Stub confidence: high ${confidenceCounts.high} | medium ${confidenceCounts.medium} | low ${confidenceCounts.low}`,
    );

    const conditional = report.stubs.processorStubs.filter((entry) => entry.status === 'conditional');
    const manual = report.stubs.processorStubs.filter((entry) => entry.status === 'manual');
    if (conditional.length > 0) {
      const preview = conditional
        .slice(0, 8)
        .map(
          (entry) =>
            `${entry.objectName}.${entry.targetField.replace('$.event.', '')} -> ${entry.requiredMappings.join('|') || 'mapping-needed'}`,
        )
        .join(', ');
      lines.push(`Conditional stubs (sample): ${preview}${conditional.length > 8 ? ' ...' : ''}`);
    }
    if (manual.length > 0) {
      const preview = manual
        .slice(0, 8)
        .map((entry) => `${entry.objectName}.${entry.targetField.replace('$.event.', '')}`)
        .join(', ');
      lines.push(`Manual stubs (sample): ${preview}${manual.length > 8 ? ' ...' : ''}`);
    }
  }

  if (report.stubs.lookupStubs.length > 0) {
    const preview = report.stubs.lookupStubs
      .slice(0, 8)
      .map((entry) => `${entry.lookupName} (${entry.entryCount})`)
      .join(', ');
    lines.push(`Lookup stubs (sample): ${preview}${report.stubs.lookupStubs.length > 8 ? ' ...' : ''}`);
  }
  lines.push('');
  report.classifications.forEach((entry) => {
    lines.push(`${entry.filePath}`);
    lines.push(`  Type: ${entry.ruleType}`);
    lines.push(`  Confidence: ${entry.confidence.toFixed(2)}`);
    lines.push(`  Event fields: ${entry.evidence.eventFields.join(', ') || 'none'}`);
    lines.push(`  OIDs: ${entry.evidence.oidCount}`);
    lines.push(`  SNMP hints: ${entry.evidence.snmpHints.join(', ') || 'none'}`);
  });
  return lines.join('\n');
};
