/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

type PipelineOptions = {
  inputs: string[];
  outputRoot: string;
  runName: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  vendor?: string;
  useMibs: boolean;
  useLlm: boolean;
  dryRun: boolean;
  minLevel: 'low' | 'medium' | 'high';
  strictMinLevel: boolean;
  maxItems: number;
  compareBefore?: string;
};

type PipelineManifest = {
  generatedAt: string;
  runName: string;
  inputPaths: string[];
  outputRoot: string;
  options: {
    includePatterns?: string[];
    excludePatterns?: string[];
    vendor?: string;
    useMibs: boolean;
    useLlm: boolean;
    dryRun: boolean;
    minLevel: 'low' | 'medium' | 'high';
    strictMinLevel: boolean;
    maxItems: number;
    compareBefore?: string;
  };
  paths: {
    conversionDir: string;
    calibrationDir: string;
    compareDir?: string;
    conversionReportJson: string;
    conversionReportText: string;
    processorStubsJson: string;
    calibrationJson: string;
    calibrationText: string;
    compareJson?: string;
    compareText?: string;
  };
};

const HELP_TEXT = [
  'Legacy pipeline orchestrator (convert -> calibrate -> optional compare)',
  '',
  'Usage:',
  '  npm run legacy:pipeline -- --input <path> [--input <path2> ...] [options]',
  '',
  'Required:',
  '  --input <path>                  One or more legacy rule roots/files',
  '',
  'Options:',
  '  --output-root <path>            Root output directory (default: tmp/legacy-analysis/pipeline)',
  '  --run-name <name>               Optional run name (default: run-<timestamp>)',
  '  --include <a,b,c>               Optional include filename filters',
  '  --exclude <a,b,c>               Optional exclude filename filters',
  '  --vendor <name>                 Optional vendor tag',
  '  --use-mibs / --no-mibs          Enable/disable MIB usage (default: use-mibs)',
  '  --use-llm / --no-llm            Enable/disable LLM usage (default: no-llm)',
  '  --dry-run / --no-dry-run        Conversion dry-run mode (default: dry-run)',
  '  --min-level <low|medium|high>   Calibration selection threshold (default: medium)',
  '  --strict-min-level              Disable calibration fallback when no eligible stubs',
  '  --max-items <N>                 Max selected candidates in calibration/compare (default: 25)',
  '  --compare-before <path>         Optional previous calibration JSON for drift compare',
  '  --help                          Show this help text',
  '',
  'Outputs per run:',
  '  conversion/legacy-conversion-report.{json,txt}',
  '  conversion/legacy-processor-stubs.json',
  '  calibration/legacy-confidence-calibration.{json,txt}',
  '  compare/legacy-confidence-drift.{json,txt} (when --compare-before provided)',
  '  pipeline-manifest.json',
].join('\n');

const parseCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseArgs = (argv: string[]): PipelineOptions => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const inputs: string[] = [];
  const defaultOutputRoot = path.resolve(process.cwd(), '..', '..', 'tmp', 'legacy-analysis', 'pipeline');
  let outputRoot = defaultOutputRoot;
  let runName = `run-${Date.now()}`;
  let includePatterns: string[] | undefined;
  let excludePatterns: string[] | undefined;
  let vendor: string | undefined;
  let useMibs = true;
  let useLlm = false;
  let dryRun = true;
  let minLevel: PipelineOptions['minLevel'] = 'medium';
  let strictMinLevel = false;
  let maxItems = 25;
  let compareBefore: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input' && argv[index + 1]) {
      inputs.push(path.resolve(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--output-root' && argv[index + 1]) {
      outputRoot = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--run-name' && argv[index + 1]) {
      runName = String(argv[index + 1]).trim() || runName;
      index += 1;
      continue;
    }
    if (arg === '--include' && argv[index + 1]) {
      includePatterns = parseCommaList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--exclude' && argv[index + 1]) {
      excludePatterns = parseCommaList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--vendor' && argv[index + 1]) {
      vendor = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--use-mibs') {
      useMibs = true;
      continue;
    }
    if (arg === '--no-mibs') {
      useMibs = false;
      continue;
    }
    if (arg === '--use-llm') {
      useLlm = true;
      continue;
    }
    if (arg === '--no-llm') {
      useLlm = false;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--no-dry-run') {
      dryRun = false;
      continue;
    }
    if (arg === '--min-level' && argv[index + 1]) {
      const value = String(argv[index + 1]).toLowerCase();
      if (value === 'low' || value === 'medium' || value === 'high') {
        minLevel = value;
      }
      index += 1;
      continue;
    }
    if (arg === '--strict-min-level') {
      strictMinLevel = true;
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
    if (arg === '--compare-before' && argv[index + 1]) {
      compareBefore = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  if (inputs.length === 0) {
    throw new Error('At least one --input path is required.');
  }

  return {
    inputs,
    outputRoot,
    runName,
    includePatterns,
    excludePatterns,
    vendor,
    useMibs,
    useLlm,
    dryRun,
    minLevel,
    strictMinLevel,
    maxItems,
    compareBefore,
  };
};

const runNpmScript = (scriptName: string, args: string[]) => {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const allArgs = ['run', scriptName, '--', ...args];
  const result = spawnSync(npmCommand, allArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Script failed: npm ${allArgs.join(' ')}`);
  }
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeManifest = (filePath: string, manifest: PipelineManifest) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = path.join(options.outputRoot, options.runName);
  const conversionDir = path.join(runRoot, 'conversion');
  const calibrationDir = path.join(runRoot, 'calibration');
  const compareDir = path.join(runRoot, 'compare');

  ensureDir(runRoot);
  ensureDir(conversionDir);
  ensureDir(calibrationDir);

  const convertArgs: string[] = [];
  options.inputs.forEach((input) => {
    convertArgs.push('--input', input);
  });
  if (options.includePatterns && options.includePatterns.length > 0) {
    convertArgs.push('--include', options.includePatterns.join(','));
  }
  if (options.excludePatterns && options.excludePatterns.length > 0) {
    convertArgs.push('--exclude', options.excludePatterns.join(','));
  }
  if (options.vendor) {
    convertArgs.push('--vendor', options.vendor);
  }
  convertArgs.push('--output-dir', conversionDir, '--report-format', 'both');
  convertArgs.push(options.useMibs ? '--use-mibs' : '--no-mibs');
  convertArgs.push(options.useLlm ? '--use-llm' : '--no-llm');
  if (options.dryRun) {
    convertArgs.push('--dry-run');
  }

  runNpmScript('legacy:convert', convertArgs);

  const processorStubsPath = path.join(conversionDir, 'legacy-processor-stubs.json');
  const calibrateArgs = [
    '--input',
    processorStubsPath,
    '--output-dir',
    calibrationDir,
    '--format',
    'both',
    '--max-items',
    String(options.maxItems),
    '--min-level',
    options.minLevel,
  ];
  if (options.strictMinLevel) {
    calibrateArgs.push('--strict-min-level');
  }
  runNpmScript('legacy:confidence-calibrate', calibrateArgs);

  let compareJsonPath: string | undefined;
  let compareTextPath: string | undefined;
  if (options.compareBefore) {
    ensureDir(compareDir);
    const afterCalibrationPath = path.join(calibrationDir, 'legacy-confidence-calibration.json');
    runNpmScript('legacy:confidence-compare', [
      '--before',
      options.compareBefore,
      '--after',
      afterCalibrationPath,
      '--output-dir',
      compareDir,
      '--format',
      'both',
      '--max-items',
      String(options.maxItems),
    ]);
    compareJsonPath = path.join(compareDir, 'legacy-confidence-drift.json');
    compareTextPath = path.join(compareDir, 'legacy-confidence-drift.txt');
  }

  const manifest: PipelineManifest = {
    generatedAt: new Date().toISOString(),
    runName: options.runName,
    inputPaths: options.inputs,
    outputRoot: runRoot,
    options: {
      includePatterns: options.includePatterns,
      excludePatterns: options.excludePatterns,
      vendor: options.vendor,
      useMibs: options.useMibs,
      useLlm: options.useLlm,
      dryRun: options.dryRun,
      minLevel: options.minLevel,
      strictMinLevel: options.strictMinLevel,
      maxItems: options.maxItems,
      compareBefore: options.compareBefore,
    },
    paths: {
      conversionDir,
      calibrationDir,
      compareDir: options.compareBefore ? compareDir : undefined,
      conversionReportJson: path.join(conversionDir, 'legacy-conversion-report.json'),
      conversionReportText: path.join(conversionDir, 'legacy-conversion-report.txt'),
      processorStubsJson: processorStubsPath,
      calibrationJson: path.join(calibrationDir, 'legacy-confidence-calibration.json'),
      calibrationText: path.join(calibrationDir, 'legacy-confidence-calibration.txt'),
      compareJson: compareJsonPath,
      compareText: compareTextPath,
    },
  };

  writeManifest(path.join(runRoot, 'pipeline-manifest.json'), manifest);
  console.log(`Legacy pipeline complete. Run output: ${runRoot}`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Legacy pipeline failed: ${message}`);
  process.exit(1);
}
