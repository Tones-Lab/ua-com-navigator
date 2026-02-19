/// <reference types="node" />
import fs from 'fs';
import path from 'path';

type ConfidenceLevel = 'high' | 'medium' | 'low';

type StubRiskCause =
  | 'manual-expression-shape'
  | 'unresolved-variable-mappings'
  | 'regex-branch-complexity'
  | 'heuristic-alias-mapping'
  | 'missing-confidence-metadata'
  | 'general-medium-confidence';

type StubRiskEntry = {
  objectName: string;
  sourceFile: string;
  targetField: string;
  status: 'direct' | 'conditional' | 'manual';
  recommendedProcessor: 'set' | 'copy' | 'replace' | 'regex' | 'if' | 'lookup' | 'manual';
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  rationale: string;
  requiredMappings: string[];
  causes: StubRiskCause[];
};

type CalibrationRun = {
  generatedAt: string;
  inputPath: string;
  selectionPolicy?: {
    minLevel: ConfidenceLevel;
    strictMinLevel: boolean;
    fallbackEnabled: boolean;
    usedFallback: boolean;
    eligibleByMinLevel: number;
  };
  totals: {
    stubs: number;
    high: number;
    medium: number;
    low: number;
    triageCandidates: number;
    selectedCandidates?: number;
  };
  rootCauseCounts: Record<StubRiskCause, number>;
  topRiskStubs: StubRiskEntry[];
};

type CompareOptions = {
  beforePath: string;
  afterPath: string;
  outputDir: string;
  format: 'json' | 'text' | 'both';
  maxItems: number;
};

type StubDriftEntry = {
  stubKey: string;
  objectName: string;
  sourceFile: string;
  targetField: string;
  before?: {
    score: number;
    level: ConfidenceLevel;
    causes: StubRiskCause[];
  };
  after?: {
    score: number;
    level: ConfidenceLevel;
    causes: StubRiskCause[];
  };
  scoreDelta?: number;
  levelChange?: 'upgraded' | 'downgraded' | 'unchanged' | 'added' | 'removed';
};

type CompareReport = {
  generatedAt: string;
  beforePath: string;
  afterPath: string;
  selectionPolicy: {
    before?: CalibrationRun['selectionPolicy'];
    after?: CalibrationRun['selectionPolicy'];
  };
  totals: {
    before: CalibrationRun['totals'];
    after: CalibrationRun['totals'];
    delta: {
      high: number;
      medium: number;
      low: number;
      triageCandidates: number;
      selectedCandidates: number;
    };
  };
  rootCauseDrift: Record<StubRiskCause, { before: number; after: number; delta: number }>;
  riskSetChange: {
    added: number;
    removed: number;
    common: number;
  };
  scoreDrift: {
    improved: number;
    regressed: number;
    unchanged: number;
  };
  levelDrift: {
    upgraded: number;
    downgraded: number;
    unchanged: number;
  };
  topRegressions: StubDriftEntry[];
  topImprovements: StubDriftEntry[];
  addedRiskStubs: StubDriftEntry[];
  removedRiskStubs: StubDriftEntry[];
};

const HELP_TEXT = [
  'Legacy confidence comparison',
  '',
  'Usage:',
  '  npm run legacy:confidence-compare -- --before <calibration.json> --after <calibration.json> [options]',
  '',
  'Required:',
  '  --before <path>          Baseline calibration JSON (earlier run)',
  '  --after <path>           New calibration JSON (later run)',
  '',
  'Optional:',
  '  --output-dir <path>      Output directory for compare artifacts',
  '  --format <json|text|both> Output format (default: both)',
  '  --max-items <number>     Top-N items per section (default: 20)',
  '  --help                   Show this help text',
].join('\n');

const parseArgs = (argv: string[]): CompareOptions => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  let beforePath = '';
  let afterPath = '';
  let outputDir = path.resolve(process.cwd(), 'legacy-conversion-output', String(Date.now()));
  let format: CompareOptions['format'] = 'both';
  let maxItems = 20;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--before' && argv[index + 1]) {
      beforePath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--after' && argv[index + 1]) {
      afterPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--output-dir' && argv[index + 1]) {
      outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--format' && argv[index + 1]) {
      const value = argv[index + 1];
      if (value === 'json' || value === 'text' || value === 'both') {
        format = value;
      }
      index += 1;
      continue;
    }
    if (arg === '--max-items' && argv[index + 1]) {
      const value = Number(argv[index + 1]);
      if (!Number.isNaN(value) && value > 0) {
        maxItems = value;
      }
      index += 1;
      continue;
    }
  }

  if (!beforePath || !afterPath) {
    throw new Error('Both --before and --after calibration JSON paths are required.');
  }

  return {
    beforePath,
    afterPath,
    outputDir,
    format,
    maxItems,
  };
};

const readCalibration = (filePath: string): CalibrationRun => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !parsed.totals || !Array.isArray(parsed.topRiskStubs) || !parsed.rootCauseCounts) {
    throw new Error(`Invalid calibration file: ${filePath}`);
  }
  return parsed as CalibrationRun;
};

const levelRank: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const stubKeyFor = (entry: StubRiskEntry) => {
  return [entry.objectName, entry.sourceFile, entry.targetField].join('|');
};

const makeDriftEntry = (
  key: string,
  before: StubRiskEntry | undefined,
  after: StubRiskEntry | undefined,
): StubDriftEntry => {
  const objectName = after?.objectName || before?.objectName || 'unknown';
  const sourceFile = after?.sourceFile || before?.sourceFile || 'unknown';
  const targetField = after?.targetField || before?.targetField || 'unknown';

  let levelChange: StubDriftEntry['levelChange'] = 'unchanged';
  if (before && !after) {
    levelChange = 'removed';
  } else if (!before && after) {
    levelChange = 'added';
  } else if (before && after) {
    const beforeRank = levelRank[before.confidenceLevel];
    const afterRank = levelRank[after.confidenceLevel];
    if (afterRank > beforeRank) {
      levelChange = 'upgraded';
    } else if (afterRank < beforeRank) {
      levelChange = 'downgraded';
    }
  }

  return {
    stubKey: key,
    objectName,
    sourceFile,
    targetField,
    before: before
      ? {
          score: before.confidenceScore,
          level: before.confidenceLevel,
          causes: before.causes,
        }
      : undefined,
    after: after
      ? {
          score: after.confidenceScore,
          level: after.confidenceLevel,
          causes: after.causes,
        }
      : undefined,
    scoreDelta:
      before && after
        ? Number((after.confidenceScore - before.confidenceScore).toFixed(4))
        : undefined,
    levelChange,
  };
};

const compareRuns = (before: CalibrationRun, after: CalibrationRun, options: Pick<CompareOptions, 'maxItems' | 'beforePath' | 'afterPath'>): CompareReport => {
  const beforeMap = new Map<string, StubRiskEntry>();
  before.topRiskStubs.forEach((entry) => beforeMap.set(stubKeyFor(entry), entry));
  const afterMap = new Map<string, StubRiskEntry>();
  after.topRiskStubs.forEach((entry) => afterMap.set(stubKeyFor(entry), entry));

  const allKeys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
  const driftEntries: StubDriftEntry[] = Array.from(allKeys).map((key) =>
    makeDriftEntry(key, beforeMap.get(key), afterMap.get(key)),
  );

  const common = driftEntries.filter((entry) => entry.before && entry.after);
  const added = driftEntries.filter((entry) => !entry.before && entry.after);
  const removed = driftEntries.filter((entry) => entry.before && !entry.after);

  const improved = common.filter((entry) => typeof entry.scoreDelta === 'number' && entry.scoreDelta > 0);
  const regressed = common.filter((entry) => typeof entry.scoreDelta === 'number' && entry.scoreDelta < 0);
  const unchanged = common.filter((entry) => entry.scoreDelta === 0);

  const upgraded = common.filter((entry) => entry.levelChange === 'upgraded');
  const downgraded = common.filter((entry) => entry.levelChange === 'downgraded');
  const levelUnchanged = common.filter((entry) => entry.levelChange === 'unchanged');

  const topRegressions = regressed
    .slice()
    .sort((a, b) => (a.scoreDelta || 0) - (b.scoreDelta || 0))
    .slice(0, options.maxItems);

  const topImprovements = improved
    .slice()
    .sort((a, b) => (b.scoreDelta || 0) - (a.scoreDelta || 0))
    .slice(0, options.maxItems);

  const rootCauseDrift = (Object.keys(before.rootCauseCounts) as StubRiskCause[]).reduce(
    (acc, cause) => {
      const beforeCount = before.rootCauseCounts[cause] || 0;
      const afterCount = after.rootCauseCounts[cause] || 0;
      acc[cause] = {
        before: beforeCount,
        after: afterCount,
        delta: afterCount - beforeCount,
      };
      return acc;
    },
    {} as Record<StubRiskCause, { before: number; after: number; delta: number }>,
  );

  return {
    generatedAt: new Date().toISOString(),
    beforePath: options.beforePath,
    afterPath: options.afterPath,
    selectionPolicy: {
      before: before.selectionPolicy,
      after: after.selectionPolicy,
    },
    totals: {
      before: before.totals,
      after: after.totals,
      delta: {
        high: after.totals.high - before.totals.high,
        medium: after.totals.medium - before.totals.medium,
        low: after.totals.low - before.totals.low,
        triageCandidates: after.totals.triageCandidates - before.totals.triageCandidates,
        selectedCandidates: (after.totals.selectedCandidates || 0) - (before.totals.selectedCandidates || 0),
      },
    },
    rootCauseDrift,
    riskSetChange: {
      added: added.length,
      removed: removed.length,
      common: common.length,
    },
    scoreDrift: {
      improved: improved.length,
      regressed: regressed.length,
      unchanged: unchanged.length,
    },
    levelDrift: {
      upgraded: upgraded.length,
      downgraded: downgraded.length,
      unchanged: levelUnchanged.length,
    },
    topRegressions,
    topImprovements,
    addedRiskStubs: added.slice(0, options.maxItems),
    removedRiskStubs: removed.slice(0, options.maxItems),
  };
};

const renderTextReport = (report: CompareReport) => {
  const lines: string[] = [];
  lines.push('Legacy Confidence Drift Report');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Before: ${report.beforePath}`);
  lines.push(`After: ${report.afterPath}`);
  lines.push('');
  if (report.selectionPolicy.before || report.selectionPolicy.after) {
    lines.push('Selection policy:');
    if (report.selectionPolicy.before) {
      lines.push(
        `- before: min-level=${report.selectionPolicy.before.minLevel} strict=${report.selectionPolicy.before.strictMinLevel} fallback-used=${report.selectionPolicy.before.usedFallback}`,
      );
    }
    if (report.selectionPolicy.after) {
      lines.push(
        `- after: min-level=${report.selectionPolicy.after.minLevel} strict=${report.selectionPolicy.after.strictMinLevel} fallback-used=${report.selectionPolicy.after.usedFallback}`,
      );
    }
    lines.push('');
  }

  lines.push(
    `Totals delta: high ${report.totals.delta.high >= 0 ? '+' : ''}${report.totals.delta.high}, ` +
      `medium ${report.totals.delta.medium >= 0 ? '+' : ''}${report.totals.delta.medium}, ` +
      `low ${report.totals.delta.low >= 0 ? '+' : ''}${report.totals.delta.low}`,
  );
  lines.push(
    `Candidate delta: triage ${report.totals.delta.triageCandidates >= 0 ? '+' : ''}${report.totals.delta.triageCandidates}, ` +
      `selected ${report.totals.delta.selectedCandidates >= 0 ? '+' : ''}${report.totals.delta.selectedCandidates}`,
  );
  lines.push(
    `Risk set: common ${report.riskSetChange.common}, added ${report.riskSetChange.added}, removed ${report.riskSetChange.removed}`,
  );
  lines.push(
    `Score drift: improved ${report.scoreDrift.improved}, regressed ${report.scoreDrift.regressed}, unchanged ${report.scoreDrift.unchanged}`,
  );
  lines.push(
    `Level drift: upgraded ${report.levelDrift.upgraded}, downgraded ${report.levelDrift.downgraded}, unchanged ${report.levelDrift.unchanged}`,
  );
  lines.push('');

  lines.push('Root cause drift:');
  Object.entries(report.rootCauseDrift)
    .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    .forEach(([cause, entry]) => {
      lines.push(`- ${cause}: ${entry.before} -> ${entry.after} (delta ${entry.delta >= 0 ? '+' : ''}${entry.delta})`);
    });

  const appendSection = (title: string, entries: StubDriftEntry[]) => {
    lines.push('');
    lines.push(title);
    if (entries.length === 0) {
      lines.push('- none');
      return;
    }
    entries.forEach((entry, index) => {
      const beforeScore = entry.before ? entry.before.score.toFixed(2) : 'n/a';
      const afterScore = entry.after ? entry.after.score.toFixed(2) : 'n/a';
      const deltaText = typeof entry.scoreDelta === 'number' ? `${entry.scoreDelta >= 0 ? '+' : ''}${entry.scoreDelta.toFixed(4)}` : 'n/a';
      lines.push(
        `${index + 1}. ${entry.objectName} ${entry.targetField} before=${beforeScore} after=${afterScore} delta=${deltaText} change=${entry.levelChange}`,
      );
      lines.push(`   source=${entry.sourceFile}`);
    });
  };

  appendSection('Top regressions:', report.topRegressions);
  appendSection('Top improvements:', report.topImprovements);
  appendSection('Added risk stubs:', report.addedRiskStubs);
  appendSection('Removed risk stubs:', report.removedRiskStubs);

  return `${lines.join('\n')}\n`;
};

const writeFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const before = readCalibration(options.beforePath);
  const after = readCalibration(options.afterPath);
  const report = compareRuns(before, after, {
    maxItems: options.maxItems,
    beforePath: options.beforePath,
    afterPath: options.afterPath,
  });

  fs.mkdirSync(options.outputDir, { recursive: true });

  if (options.format === 'json' || options.format === 'both') {
    writeFile(
      path.join(options.outputDir, 'legacy-confidence-drift.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
  if (options.format === 'text' || options.format === 'both') {
    writeFile(path.join(options.outputDir, 'legacy-confidence-drift.txt'), renderTextReport(report));
  }

  console.log(`Legacy confidence compare complete. Output: ${options.outputDir}`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Legacy confidence compare failed: ${message}`);
  process.exit(1);
}
