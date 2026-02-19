/// <reference types="node" />
import fs from 'fs';
import path from 'path';

type ConfidenceLevel = 'high' | 'medium' | 'low';

type ProcessorStub = {
  objectName: string;
  sourceFile: string;
  ruleFunction: string;
  targetField: string;
  expression: string;
  status: 'direct' | 'conditional' | 'manual';
  recommendedProcessor: 'set' | 'copy' | 'replace' | 'regex' | 'if' | 'lookup' | 'manual';
  requiredMappings: string[];
  notes: string[];
  confidence?: {
    score: number;
    level: ConfidenceLevel;
    rationale: string;
  };
};

type CalibrationOptions = {
  inputPath: string;
  outputDir: string;
  format: 'json' | 'text' | 'both';
  maxItems: number;
};

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
  status: ProcessorStub['status'];
  recommendedProcessor: ProcessorStub['recommendedProcessor'];
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  rationale: string;
  requiredMappings: string[];
  causes: StubRiskCause[];
};

type CalibrationReport = {
  generatedAt: string;
  inputPath: string;
  totals: {
    stubs: number;
    high: number;
    medium: number;
    low: number;
    triageCandidates: number;
    selectedCandidates: number;
  };
  fallbackToHighConfidence: boolean;
  rootCauseCounts: Record<StubRiskCause, number>;
  topRiskStubs: StubRiskEntry[];
};

const parseArgs = (argv: string[]): CalibrationOptions => {
  let inputPath = '';
  let outputDir = path.resolve(process.cwd(), 'legacy-conversion-output', String(Date.now()));
  let format: CalibrationOptions['format'] = 'both';
  let maxItems = 25;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input' && argv[index + 1]) {
      inputPath = path.resolve(argv[index + 1]);
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
    }
  }

  if (!inputPath) {
    throw new Error('Missing required --input path (legacy-processor-stubs.json or legacy-conversion-report.json).');
  }

  return {
    inputPath,
    outputDir,
    format,
    maxItems,
  };
};

const readProcessorStubs = (inputPath: string): ProcessorStub[] => {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed as ProcessorStub[];
  }

  if (parsed && parsed.stubs && Array.isArray(parsed.stubs.processorStubs)) {
    return parsed.stubs.processorStubs as ProcessorStub[];
  }

  throw new Error('Input JSON is not a processor stubs array and does not contain stubs.processorStubs.');
};

const deriveRiskCauses = (stub: ProcessorStub): StubRiskCause[] => {
  const causes = new Set<StubRiskCause>();
  const rationale = String(stub.confidence?.rationale || '').toLowerCase();
  const noteText = (stub.notes || []).join(' ').toLowerCase();

  if (!stub.confidence) {
    causes.add('missing-confidence-metadata');
  }
  if (stub.status === 'manual') {
    causes.add('manual-expression-shape');
  }
  if ((stub.requiredMappings || []).length > 0) {
    causes.add('unresolved-variable-mappings');
  }
  if (stub.recommendedProcessor === 'if' || rationale.includes('regex-branch-chain') || noteText.includes('regex-capture')) {
    causes.add('regex-branch-complexity');
  }
  if (rationale.includes('heuristic') || noteText.includes('heuristic')) {
    causes.add('heuristic-alias-mapping');
  }

  if (causes.size === 0 && (stub.confidence?.level || 'medium') === 'medium') {
    causes.add('general-medium-confidence');
  }

  return Array.from(causes);
};

const toRiskEntry = (stub: ProcessorStub): StubRiskEntry => {
  const score = Number.isFinite(stub.confidence?.score) ? Number(stub.confidence?.score) : 0.5;
  const level = (stub.confidence?.level || 'medium') as ConfidenceLevel;
  return {
    objectName: stub.objectName,
    sourceFile: stub.sourceFile,
    targetField: stub.targetField,
    status: stub.status,
    recommendedProcessor: stub.recommendedProcessor,
    confidenceScore: score,
    confidenceLevel: level,
    rationale: String(stub.confidence?.rationale || 'missing confidence metadata'),
    requiredMappings: stub.requiredMappings || [],
    causes: deriveRiskCauses(stub),
  };
};

const buildCalibrationReport = (stubs: ProcessorStub[], inputPath: string, maxItems: number): CalibrationReport => {
  const entries = stubs.map(toRiskEntry);
  const high = entries.filter((entry) => entry.confidenceLevel === 'high').length;
  const medium = entries.filter((entry) => entry.confidenceLevel === 'medium').length;
  const low = entries.filter((entry) => entry.confidenceLevel === 'low').length;

  const triage = entries
    .filter((entry) => entry.confidenceLevel !== 'high')
    .sort((left, right) => {
      if (left.confidenceScore !== right.confidenceScore) {
        return left.confidenceScore - right.confidenceScore;
      }
      if (left.requiredMappings.length !== right.requiredMappings.length) {
        return right.requiredMappings.length - left.requiredMappings.length;
      }
      return left.objectName.localeCompare(right.objectName);
    })
    .slice(0, maxItems);

  const selected = triage.length > 0
    ? triage
    : entries
        .slice()
        .sort((left, right) => {
          if (left.confidenceScore !== right.confidenceScore) {
            return left.confidenceScore - right.confidenceScore;
          }
          if (left.requiredMappings.length !== right.requiredMappings.length) {
            return right.requiredMappings.length - left.requiredMappings.length;
          }
          return left.objectName.localeCompare(right.objectName);
        })
        .slice(0, maxItems);

  const fallbackToHighConfidence = triage.length === 0;

  const causeCounts: Record<StubRiskCause, number> = {
    'manual-expression-shape': 0,
    'unresolved-variable-mappings': 0,
    'regex-branch-complexity': 0,
    'heuristic-alias-mapping': 0,
    'missing-confidence-metadata': 0,
    'general-medium-confidence': 0,
  };

  selected.forEach((entry) => {
    entry.causes.forEach((cause) => {
      causeCounts[cause] += 1;
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    inputPath,
    totals: {
      stubs: stubs.length,
      high,
      medium,
      low,
      triageCandidates: triage.length,
      selectedCandidates: selected.length,
    },
    fallbackToHighConfidence,
    rootCauseCounts: causeCounts,
    topRiskStubs: selected,
  };
};

const renderTextReport = (report: CalibrationReport) => {
  const lines: string[] = [];
  lines.push('Legacy Confidence Calibration Report');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Input: ${report.inputPath}`);
  lines.push('');
  lines.push(
    `Stub totals: ${report.totals.stubs} (high ${report.totals.high}, medium ${report.totals.medium}, low ${report.totals.low})`,
  );
  lines.push(`Triage candidates: ${report.totals.triageCandidates}`);
  if (report.fallbackToHighConfidence) {
    lines.push(`Selected candidates: ${report.totals.selectedCandidates} (fallback to lowest high-confidence stubs)`);
  } else {
    lines.push(`Selected candidates: ${report.totals.selectedCandidates}`);
  }
  lines.push('');
  lines.push('Root causes (triage set):');
  Object.entries(report.rootCauseCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cause, count]) => {
      lines.push(`- ${cause}: ${count}`);
    });

  lines.push('');
  lines.push('Top risk stubs:');
  report.topRiskStubs.forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.objectName} ${entry.targetField} score=${entry.confidenceScore.toFixed(2)} ` +
        `level=${entry.confidenceLevel} status=${entry.status} processor=${entry.recommendedProcessor}`,
    );
    lines.push(`   causes=${entry.causes.join('|') || 'n/a'}`);
    if (entry.requiredMappings.length > 0) {
      lines.push(`   requiredMappings=${entry.requiredMappings.join('|')}`);
    }
    lines.push(`   source=${entry.sourceFile}`);
  });

  return `${lines.join('\n')}\n`;
};

const writeFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const stubs = readProcessorStubs(options.inputPath);
  const report = buildCalibrationReport(stubs, options.inputPath, options.maxItems);

  fs.mkdirSync(options.outputDir, { recursive: true });

  if (options.format === 'json' || options.format === 'both') {
    writeFile(
      path.join(options.outputDir, 'legacy-confidence-calibration.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
  if (options.format === 'text' || options.format === 'both') {
    writeFile(path.join(options.outputDir, 'legacy-confidence-calibration.txt'), renderTextReport(report));
  }

  console.log(`Legacy confidence calibration complete. Output: ${options.outputDir}`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Legacy confidence calibration failed: ${message}`);
  process.exit(1);
}
