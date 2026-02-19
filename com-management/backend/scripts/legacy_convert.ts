/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import { convertLegacyRules, renderLegacyTextReport, discoverLegacyTraversal } from '../src/services/legacy/legacyConversion';
import { runLegacyLinter } from '../src/services/legacy/legacy_linter';
import { applyLegacyLlmReviewScores } from '../src/services/legacy/llmReview';

type CliOptions = {
  inputs: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  outputDir: string;
  vendor?: string;
  useMibs: boolean;
  useLlm: boolean;
  useLlmReview: boolean;
  lint: boolean;
  reportFormat: 'json' | 'text' | 'both';
  emitRawOverrides: boolean;
  emitPerFile: boolean;
  dryRun: boolean;
  logLevel: 'info' | 'debug' | 'warn' | 'error';
  maxLlmRequests?: number;
};

const parseArgs = (argv: string[]): CliOptions => {
  const inputs: string[] = [];
  let includePatterns: string[] | undefined;
  let excludePatterns: string[] | undefined;
  let outputDir = path.resolve(process.cwd(), 'legacy-conversion-output', String(Date.now()));
  let vendor: string | undefined;
  let reportFormat: CliOptions['reportFormat'] = 'both';
  let emitRawOverrides = true;
  let emitPerFile = false;
  let useMibs = true;
  let useLlm = false;
  let useLlmReview = false;
  let lint = true;
  let dryRun = false;
  let logLevel: CliOptions['logLevel'] = 'info';
  let maxLlmRequests: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      inputs.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--include' && argv[i + 1]) {
      includePatterns = argv[i + 1].split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--exclude' && argv[i + 1]) {
      excludePatterns = argv[i + 1].split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--output-dir' && argv[i + 1]) {
      outputDir = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--vendor' && argv[i + 1]) {
      vendor = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--report-format' && argv[i + 1]) {
      const value = argv[i + 1];
      if (value === 'json' || value === 'text' || value === 'both') {
        reportFormat = value;
      }
      i += 1;
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
    if (arg === '--use-llm-review') {
      useLlmReview = true;
      continue;
    }
    if (arg === '--no-llm-review') {
      useLlmReview = false;
      continue;
    }
    if (arg === '--lint') {
      lint = true;
      continue;
    }
    if (arg === '--no-lint') {
      lint = false;
      continue;
    }
    if (arg === '--raw-overrides') {
      emitRawOverrides = true;
      continue;
    }
    if (arg === '--no-raw-overrides') {
      emitRawOverrides = false;
      continue;
    }
    if (arg === '--emit-per-file') {
      emitPerFile = true;
      continue;
    }
    if (arg === '--log-level' && argv[i + 1]) {
      const level = argv[i + 1] as CliOptions['logLevel'];
      if (['info', 'debug', 'warn', 'error'].includes(level)) {
        logLevel = level;
      }
      i += 1;
      continue;
    }
    if (arg === '--max-llm-requests' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value) && value >= 0) {
        maxLlmRequests = value;
      }
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  if (inputs.length === 0) {
    throw new Error('At least one --input path is required.');
  }

  return {
    inputs,
    includePatterns,
    excludePatterns,
    outputDir,
    vendor,
    useMibs,
    useLlm,
    useLlmReview,
    lint,
    reportFormat,
    emitRawOverrides,
    emitPerFile,
    dryRun,
    logLevel,
    maxLlmRequests,
  };
};

const writeFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const main = async () => {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.lint) {
    // eslint-disable-next-line no-console
    console.log('Running legacy linter...');
    const traversal = discoverLegacyTraversal(options.inputs);
    const filesToLint = traversal.orderedFiles
      .map(filePath => {
        try {
          return { filePath, content: fs.readFileSync(filePath, 'utf8') };
        } catch {
          return null;
        }
      })
      .filter((file): file is { filePath: string; content: string } => Boolean(file));

    const linterReport = runLegacyLinter(filesToLint);
    if (linterReport.summary.totalIssues > 0) {
      console.log(`Linter found ${linterReport.summary.totalIssues} issues (${linterReport.summary.warnings} warnings, ${linterReport.summary.errors} errors).`);
      linterReport.issues.forEach(issue => {
        console.log(`  [${issue.severity}] ${issue.filePath}:${issue.line} - ${issue.message}`);
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('Linter found no issues.');
    }
    console.log('');
  }

  const report = convertLegacyRules({
    inputs: options.inputs,
    includePatterns: options.includePatterns,
    excludePatterns: options.excludePatterns,
    vendor: options.vendor,
    useMibs: options.useMibs,
    useLlm: options.useLlm,
    useLlmReview: options.useLlmReview,
  });

  if (options.useLlmReview) {
    // eslint-disable-next-line no-console
    console.log('Running LLM review for conversion items...');
    await applyLegacyLlmReviewScores(report);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  if (options.reportFormat === 'json' || options.reportFormat === 'both') {
    const reportPath = path.join(options.outputDir, 'legacy-conversion-report.json');
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const processorStubPath = path.join(options.outputDir, 'legacy-processor-stubs.json');
    writeFile(processorStubPath, `${JSON.stringify(report.stubs.processorStubs, null, 2)}\n`);
    const lookupStubPath = path.join(options.outputDir, 'legacy-lookup-stubs.json');
    writeFile(lookupStubPath, `${JSON.stringify(report.stubs.lookupStubs, null, 2)}\n`);
  }

  if (options.reportFormat === 'text' || options.reportFormat === 'both') {
    const textPath = path.join(options.outputDir, 'legacy-conversion-report.txt');
    writeFile(textPath, `${renderLegacyTextReport(report)}\n`);
  }

  if (options.emitRawOverrides && !options.dryRun) {
    const rawPath = path.join(options.outputDir, 'legacy-raw-overrides.json');
    writeFile(rawPath, `${JSON.stringify(report.overrideProposals, null, 2)}\n`);
  }

  if (options.emitPerFile) {
    report.files.forEach((file) => {
      const name = path.basename(file.filePath).replace(/[^A-Za-z0-9._-]/g, '_');
      const filePath = path.join(options.outputDir, 'files', `${name}.json`);
      writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`);
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Legacy conversion complete. Output: ${options.outputDir}`);
};

try {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`Legacy conversion failed: ${message}`);
    process.exit(1);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`Legacy conversion failed: ${message}`);
  process.exit(1);
}
