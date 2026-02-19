import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { execFile } from 'child_process';
import AdmZip, { type IZipEntry } from 'adm-zip';
import { convertLegacyRules, renderLegacyTextReport } from '../services/legacy/legacyConversion';
import { buildLegacyReviewQueue } from '../services/legacy/reviewQueue';
import { applyLegacyLlmReviewScores } from '../services/legacy/llmReview';
import {
  ensureLegacyUploadRoot,
  getLegacyUploadRoot,
  listLegacyEntries,
  resolveLegacyPath,
  sanitizeLegacySubdir,
} from '../services/legacy/storage';

const router = express.Router();
const allowedUploadExtensions = new Set(['.rules', '.pl', '.includes', '.load', '.txt', '.zip']);
const allowedConversionExtensions = new Set(['.rules', '.pl', '.includes', '.load', '.txt']);
const LEGACY_COMS_ROOT = process.env.LEGACY_COMS_ROOT || path.resolve(process.cwd(), '..', '..', 'coms');
const LEGACY_PIPELINE_TIMEOUT_MS = 15 * 60 * 1000;
const NAVIGATOR_ROOT = path.resolve(process.cwd(), '..', '..');

const runExecFile = (
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number; maxBuffer?: number; env?: NodeJS.ProcessEnv },
) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject({
          error,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
        });
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });

const sanitizeRunName = (value: string) => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const assertWithinNavigatorRoot = (targetPath: string) => {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(NAVIGATOR_ROOT)) {
    throw new Error('Invalid pipeline output path');
  }
  return resolved;
};

const resolveComsFilePath = (targetPath: string) => {
  const resolvedRoot = path.resolve(LEGACY_COMS_ROOT);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error('Invalid COM file path');
  }
  return resolvedTarget;
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const root = ensureLegacyUploadRoot();
      const subdir = sanitizeLegacySubdir(String(req.body?.subdir || ''));
      const target = subdir ? path.join(root, subdir) : root;
      fs.mkdirSync(target, { recursive: true });
      cb(null, target);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedUploadExtensions.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${ext || 'unknown'}`));
  },
});

const parseLegacyValue = (value: any) => {
  if (typeof value !== 'string') {
    return value;
  }
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
  return trimmed;
};

type LegacyFieldConflict = {
  field: string;
  existingValue: any;
  incomingValue: any;
  source: string;
};

type LegacyObjectBucket = {
  objectName: string;
  sourceFiles: Set<string>;
  fields: Map<string, { value: any; score: number; source: string }>;
  conflicts: LegacyFieldConflict[];
};

const deriveLegacyObjectName = (obj: any) => {
  const ruleFunction = String(obj?.ruleFunction || '').trim();
  if (ruleFunction && ruleFunction !== '__global__') {
    return ruleFunction;
  }
  const firstOid = Array.isArray(obj?.oids) && obj.oids.length > 0 ? String(obj.oids[0]) : 'unknown';
  return `legacy_${firstOid}`;
};

const PROCESSOR_TEMPLATE_KEYS = ['if', 'regex', 'lookup', 'replace', 'copy', 'set'] as const;

const getEventFieldFromTarget = (targetField: string) => {
  const normalized = String(targetField || '').trim();
  if (!normalized.startsWith('$.event.')) {
    return null;
  }
  const field = normalized.replace('$.event.', '').trim();
  return field || null;
};

const convertTemplateToProcessorOps = (template: any) => {
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return [] as Array<Record<string, any>>;
  }

  const ops: Array<Record<string, any>> = [];
  PROCESSOR_TEMPLATE_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(template, key)) {
      ops.push({
        op: 'add',
        path: '/-',
        value: {
          [key]: template[key],
        },
      });
    }
  });

  if (ops.length > 0) {
    return ops;
  }

  return [
    {
      op: 'add',
      path: '/-',
      value: template,
    },
  ];
};

const buildProcessorStubIndex = (report: any) => {
  const stubs = Array.isArray(report?.stubs?.processorStubs) ? report.stubs.processorStubs : [];
  const index = new Map<string, Map<string, any[]>>();

  stubs.forEach((stub: any) => {
    const objectName = String(stub?.objectName || '').trim();
    const sourceFile = String(stub?.sourceFile || '').trim();
    const targetField = getEventFieldFromTarget(String(stub?.targetField || ''));
    if (!objectName || !sourceFile || !targetField) {
      return;
    }

    const objectKey = `${objectName}::${sourceFile}`;
    if (!index.has(objectKey)) {
      index.set(objectKey, new Map<string, any[]>());
    }
    const fieldMap = index.get(objectKey)!;
    if (!fieldMap.has(targetField)) {
      fieldMap.set(targetField, []);
    }
    fieldMap.get(targetField)!.push(stub);
  });

  return index;
};

const selectBestStub = (candidates: any[]) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const withTemplate = candidates.filter((entry) => entry?.template && typeof entry.template === 'object');
  if (withTemplate.length === 0) {
    return candidates[0] || null;
  }

  const byStatus = (status: string) => withTemplate.find((entry) => String(entry?.status || '') === status);
  return byStatus('direct') || byStatus('conditional') || withTemplate[0] || null;
};

const getBestStubForField = (
  objectName: string,
  sourceFiles: string[],
  field: string,
  stubIndex: Map<string, Map<string, any[]>>,
) => {
  const candidates: any[] = [];
  sourceFiles.forEach((sourceFile) => {
    const fieldMap = stubIndex.get(`${objectName}::${sourceFile}`);
    if (!fieldMap) {
      return;
    }
    const entries = fieldMap.get(field) || [];
    if (entries.length > 0) {
      candidates.push(...entries);
    }
  });
  return selectBestStub(candidates);
};

const buildConfirmedFcomOverrideBundle = (report: any, minScore: number) => {
  const matchDiffs = Array.isArray(report?.matchDiffs) ? report.matchDiffs : [];
  const legacyObjects = Array.isArray(report?.legacyObjects) ? report.legacyObjects : [];
  const overrideProposals = Array.isArray(report?.overrideProposals) ? report.overrideProposals : [];
  const stubIndex = buildProcessorStubIndex(report);
  const fcomMatches = matchDiffs.filter((entry: any) => entry?.matchedObject?.source === 'fcom');
  const byObject = new Map<string, LegacyObjectBucket>();

  matchDiffs.forEach((entry: any) => {
    const matched = entry?.matchedObject;
    const objectName = typeof matched?.name === 'string' ? matched.name.trim() : '';
    if (!objectName || matched?.source !== 'fcom') {
      return;
    }
    const method = String(entry?.matchMethod || '').toLowerCase();
    const score = Number(entry?.matchScore || 0);
    const diffs = Array.isArray(entry?.diffs) ? entry.diffs : [];
    if (score < minScore || diffs.length === 0) {
      return;
    }
    if (!['oid', 'name', 'heuristic'].includes(method)) {
      return;
    }

    const bucket: LegacyObjectBucket =
      byObject.get(objectName) || {
        objectName,
        sourceFiles: new Set<string>(),
        fields: new Map<string, { value: any; score: number; source: string }>(),
        conflicts: [],
      };
    const sourceFile = String(entry?.sourceFile || 'legacy-conversion');
    bucket.sourceFiles.add(sourceFile);

    diffs.forEach((diff: any) => {
      const field = String(diff?.field || '').trim();
      if (!field || diff?.legacyValue === undefined || diff?.legacyValue === null) {
        return;
      }
      const incomingValue = parseLegacyValue(diff.legacyValue);
      const existing = bucket.fields.get(field);
      if (!existing) {
        bucket.fields.set(field, { value: incomingValue, score, source: sourceFile });
        return;
      }
      if (JSON.stringify(existing.value) === JSON.stringify(incomingValue)) {
        if (score > existing.score) {
          bucket.fields.set(field, { value: incomingValue, score, source: sourceFile });
        }
        return;
      }
      if (score > existing.score) {
        bucket.conflicts.push({
          field,
          existingValue: existing.value,
          incomingValue,
          source: sourceFile,
        });
        bucket.fields.set(field, { value: incomingValue, score, source: sourceFile });
      } else {
        bucket.conflicts.push({
          field,
          existingValue: existing.value,
          incomingValue,
          source: sourceFile,
        });
      }
    });

    byObject.set(objectName, bucket);
  });

  const candidates = Array.from(byObject.values())
    .filter((entry) => entry.fields.size > 0 && entry.conflicts.length === 0)
    .map((entry) => {
      const sourceFiles = Array.from(entry.sourceFiles);
      const processors: Array<Record<string, any>> = [];
      let implementedFromStubs = 0;
      let manualStubCount = 0;
      let fallbackSetCount = 0;

      Array.from(entry.fields.entries()).forEach(([field, value]) => {
        const selectedStub = getBestStubForField(entry.objectName, sourceFiles, field, stubIndex);
        if (selectedStub?.template && typeof selectedStub.template === 'object') {
          const templateOps = convertTemplateToProcessorOps(selectedStub.template);
          if (templateOps.length > 0) {
            implementedFromStubs += 1;
            if (String(selectedStub.status || '').toLowerCase() === 'manual') {
              manualStubCount += 1;
            }
            processors.push(...templateOps);
            return;
          }
        }

        fallbackSetCount += 1;
        processors.push({
          op: 'add',
          path: '/-',
          value: {
            set: {
              source: value.value,
              targetField: `$.event.${field}`,
            },
          },
        });
      });

      return {
        objectName: entry.objectName,
        sourceFiles,
        processorSummary: {
          totalFields: entry.fields.size,
          implementedFromParserStubs: implementedFromStubs,
          manualStubCount,
          fallbackSetCount,
        },
        override: {
          name: `${entry.objectName} Override`,
          description: `Generated from legacy conversion for ${entry.objectName}`,
          domain: 'fault',
          method: 'trap',
          scope: 'post',
          '@objectName': entry.objectName,
          _type: 'override',
          processors,
        },
      };
    });

  const legacyById = new Map<string, any>();
  legacyObjects.forEach((obj: any) => {
    if (obj?.id) {
      legacyById.set(String(obj.id), obj);
    }
  });

  const matchedLegacyKeys = new Set<string>();
  fcomMatches.forEach((entry: any) => {
    const obj = legacyById.get(String(entry?.legacyObjectId || ''));
    if (!obj) {
      return;
    }
    const key = `${deriveLegacyObjectName(obj)}::${String(obj?.sourceFile || '')}`;
    matchedLegacyKeys.add(key);
  });

  const generatedDefinitions = overrideProposals
    .filter((proposal: any) => {
      const key = `${String(proposal?.objectName || '')}::${String(proposal?.sourceFile || '')}`;
      return !matchedLegacyKeys.has(key);
    })
    .map((proposal: any) => {
      const objectName = String(proposal?.objectName || 'legacy-object');
      const sourceFile = String(proposal?.sourceFile || '');
      const proposalFields = proposal?.fields && typeof proposal.fields === 'object' ? proposal.fields : {};
      const fieldNames = Object.keys(proposalFields);
      const fieldMap = stubIndex.get(`${objectName}::${sourceFile}`) || new Map<string, any[]>();
      const processors: Array<Record<string, any>> = [];
      let implementedFromStubs = 0;
      let manualStubCount = 0;
      let missingStubCount = 0;

      fieldNames.forEach((field) => {
        const selected = selectBestStub(fieldMap.get(field) || []);
        if (!selected) {
          missingStubCount += 1;
          processors.push({
            op: 'add',
            path: '/-',
            value: {
              set: {
                source: parseLegacyValue(proposalFields[field]),
                targetField: `$.event.${field}`,
              },
            },
          });
          return;
        }

        const status = String(selected?.status || '').toLowerCase();
        if (status === 'manual') {
          manualStubCount += 1;
        }

        const templateOps = convertTemplateToProcessorOps(selected?.template);
        if (templateOps.length > 0) {
          implementedFromStubs += 1;
          processors.push(...templateOps);
          return;
        }

        missingStubCount += 1;
        processors.push({
          op: 'add',
          path: '/-',
          value: {
            set: {
              source: parseLegacyValue(proposalFields[field]),
              targetField: `$.event.${field}`,
            },
          },
        });
      });

      const definition: Record<string, any> = {
        name: objectName,
        description: `Generated COM definition proposal from ${sourceFile || 'legacy conversion'}`,
        domain: 'fault',
        method: 'trap',
        '@objectName': objectName,
        _type: 'object',
      };

      if (processors.length > 0) {
        definition.processors = processors;
      } else {
        definition.event = { ...proposalFields };
      }

      return {
        objectName,
        sourceFile,
        reason: 'No existing FCOM match found; generated COM definition proposal.',
        processorSummary: {
          totalFields: fieldNames.length,
          implementedFromParserStubs: implementedFromStubs,
          manualStubCount,
          fallbackSetCount: missingStubCount,
        },
        definition,
      };
    });

  const conflicts = Array.from(byObject.values())
    .filter((entry) => entry.conflicts.length > 0)
    .map((entry) => ({
      objectName: entry.objectName,
      conflicts: entry.conflicts,
    }));

  return {
    candidates,
    generatedDefinitions,
    conflicts,
    summary: {
      totalMatchDiffs: matchDiffs.length,
      matchedExistingFcomObjects: matchedLegacyKeys.size,
      confirmedObjects: candidates.length,
      generatedDefinitions: generatedDefinitions.length,
      conflictObjects: conflicts.length,
    },
  };
};

const safeExtractZip = (zipPath: string, targetDir: string) => {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extracted: string[] = [];

  entries.forEach((entry: IZipEntry) => {
    if (entry.isDirectory) {
      return;
    }
    const normalized = path.normalize(entry.entryName).replace(/^([./\\])+/g, '');
    const resolved = path.resolve(targetDir, normalized);
    if (!resolved.startsWith(targetDir)) {
      return;
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, entry.getData());
    extracted.push(resolved);
  });

  return extracted;
};

router.get('/uploads', (req, res) => {
  const root = ensureLegacyUploadRoot();
  const entries = listLegacyEntries(root);
  res.json({
    root: path.relative(process.cwd(), root) || root,
    entries,
  });
});

router.get('/uploads/file', (req, res) => {
  const relativePath = String(req.query.path || '').trim();
  if (!relativePath) {
    res.status(400).json({ error: 'Missing upload path.' });
    return;
  }
  try {
    const resolved = resolveLegacyPath(relativePath);
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Path is not a file.' });
      return;
    }
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ path: relativePath, content });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to read file.' });
  }
});

router.get('/match/file', (req, res) => {
  const filePath = String(req.query.path || '').trim();
  if (!filePath) {
    res.status(400).json({ error: 'Missing COM file path.' });
    return;
  }
  try {
    const resolved = resolveComsFilePath(filePath);
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Path is not a file.' });
      return;
    }
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ path: resolved, content });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to read COM file.' });
  }
});

router.post('/uploads', upload.array('files'), (req, res) => {
  const files = (req.files || []) as Express.Multer.File[];
  const uploaded = files.map((file) => ({
    name: file.originalname,
    size: file.size,
    path: path.relative(getLegacyUploadRoot(), file.path),
  }));
  const extracted: Array<{ source: string; target: string; count: number }> = [];

  files.forEach((file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return;
    }
    const targetBase = path.basename(file.originalname, ext) || 'zip-upload';
    const targetDir = path.join(path.dirname(file.path), targetBase);
    fs.mkdirSync(targetDir, { recursive: true });
    const extractedFiles = safeExtractZip(file.path, targetDir);
    extracted.push({
      source: file.originalname,
      target: path.relative(getLegacyUploadRoot(), targetDir),
      count: extractedFiles.length,
    });
    fs.unlinkSync(file.path);
  });

  res.json({ uploaded, extracted });
});

router.post('/convert', async (req, res) => {
  const root = ensureLegacyUploadRoot();
  const body = req.body || {};
  const selectedPaths = Array.isArray(body.paths)
    ? body.paths.map((value: any) => String(value))
    : [];
  const files = selectedPaths.length
    ? selectedPaths.map((entry: string) => resolveLegacyPath(entry))
    : listLegacyEntries(root)
        .filter((entry: { path: string; type: string }) => entry.type === 'file')
        .map((entry: { path: string }) => resolveLegacyPath(entry.path));
  const filtered = files.filter((filePath: string) =>
    allowedConversionExtensions.has(path.extname(filePath).toLowerCase()),
  );
  if (filtered.length === 0) {
    res.status(400).json({ error: 'No legacy files available for conversion.' });
    return;
  }
  try {
    const useLlmReview = body.useLlmReview === true;
    const report = convertLegacyRules({
      inputs: filtered,
      vendor: body.vendor ? String(body.vendor) : undefined,
      useMibs: body.useMibs === false ? false : true,
      useLlm: body.useLlm === true,
      useLlmReview,
    });
    if (useLlmReview) {
      await applyLegacyLlmReviewScores(report);
    }
    const textReport = renderLegacyTextReport(report);
    res.json({ report, textReport });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Legacy conversion failed.' });
  }
});

router.post('/apply-fcom-overrides', (req, res) => {
  const body = req.body || {};
  const report = body.report;
  if (!report || typeof report !== 'object') {
    res.status(400).json({ error: 'Missing conversion report payload.' });
    return;
  }

  const dryRun = body.dryRun !== false;
  const minScoreRaw = Number(body.minScore ?? 10);
  const minScore = Number.isFinite(minScoreRaw) ? minScoreRaw : 10;

  try {
    const bundle = buildConfirmedFcomOverrideBundle(report, minScore);
    const overrideCandidates = Array.isArray(body.overridesOverride)
      ? body.overridesOverride
      : bundle.candidates;
    const generatedDefinitions = Array.isArray(body.generatedDefinitionsOverride)
      ? body.generatedDefinitionsOverride
      : bundle.generatedDefinitions;
    const generatedAt = new Date().toISOString();
    const summary = {
      ...bundle.summary,
      confirmedObjects: overrideCandidates.length,
      generatedDefinitions: generatedDefinitions.length,
    };
    const payload = {
      generatedAt,
      dryRun,
      minScore,
      summary,
      conflicts: bundle.conflicts,
      overrides: overrideCandidates,
      generatedDefinitions,
    };

    if (dryRun) {
      res.json(payload);
      return;
    }

    const root = ensureLegacyUploadRoot();
    const outputDir = path.join(root, 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    const fileName = `fcom-confirmed-overrides-${Date.now()}.json`;
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    res.json({
      ...payload,
      outputPath: path.relative(root, outputPath),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to generate FCOM override bundle.' });
  }
});

router.post('/review-queue', (req, res) => {
  const body = req.body || {};
  const report = body.report;
  if (!report || typeof report !== 'object') {
    res.status(400).json({ error: 'Missing conversion report payload.' });
    return;
  }

  try {
    const queue = buildLegacyReviewQueue({
      report,
      applyPreview:
        body.applyPreview && typeof body.applyPreview === 'object' ? body.applyPreview : undefined,
      options: body.options && typeof body.options === 'object' ? body.options : undefined,
    });
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to build review queue.' });
  }
});

router.post('/run-pipeline', async (req, res) => {
  const body = req.body || {};
  const inputPaths = Array.isArray(body.inputPaths)
    ? body.inputPaths.map((entry: any) => path.resolve(String(entry || '').trim())).filter(Boolean)
    : [];
  if (inputPaths.length === 0) {
    res.status(400).json({ error: 'At least one input path is required.' });
    return;
  }

  const runNameRaw = String(body.runName || '').trim() || `ui-run-${Date.now()}`;
  const runName = sanitizeRunName(runNameRaw);
  if (!runName) {
    res.status(400).json({ error: 'Run name is invalid.' });
    return;
  }

  const minLevelRaw = String(body.minLevel || 'medium').toLowerCase();
  const minLevel = minLevelRaw === 'low' || minLevelRaw === 'high' ? minLevelRaw : 'medium';
  const strictMinLevel = body.strictMinLevel === true;
  const maxItemsRaw = Number(body.maxItems ?? 25);
  const maxItems = Number.isFinite(maxItemsRaw) && maxItemsRaw > 0 ? Math.floor(maxItemsRaw) : 25;
  const outputRoot = path.resolve(String(body.outputRoot || path.resolve(process.cwd(), '..', '..', 'tmp', 'legacy-analysis', 'pipeline')));
  const compareMode = String(body.compareMode || 'latest').toLowerCase();
  const compareBefore = String(body.compareBeforePath || '').trim();
  const useLlmReview = body.useLlmReview === true;

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', 'legacy:pipeline', '--'];
  inputPaths.forEach((entry: string) => {
    args.push('--input', entry);
  });
  args.push('--run-name', runName, '--min-level', minLevel, '--max-items', String(maxItems), '--output-root', outputRoot);
  if (useLlmReview) {
    args.push('--use-llm-review');
  }
  if (strictMinLevel) {
    args.push('--strict-min-level');
  }
  if (compareMode === 'latest') {
    args.push('--compare-latest');
  } else if (compareMode === 'before' && compareBefore) {
    args.push('--compare-before', path.resolve(compareBefore));
  }

  try {
    const { stdout, stderr } = await runExecFile(npmCommand, args, {
      cwd: process.cwd(),
      timeout: LEGACY_PIPELINE_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });

    const runOutputDir = path.join(outputRoot, runName);
    const manifestPath = path.join(runOutputDir, 'pipeline-manifest.json');
    let manifest: any | null = null;
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(raw);
    }

    res.json({
      success: true,
      command: `${npmCommand} ${args.join(' ')}`,
      runName,
      runOutputDir,
      stdout,
      stderr,
      manifest,
    });
  } catch (failure: any) {
    const message = failure?.error?.message || 'Legacy pipeline execution failed.';
    const stdout = String(failure?.stdout || '');
    const stderr = String(failure?.stderr || '');
    res.status(500).json({
      error: message,
      stdout,
      stderr,
      runName,
      runOutputDir: path.join(outputRoot, runName),
    });
  }
});

router.post('/pipeline-report', (req, res) => {
  const body = req.body || {};
  const runOutputDirRaw = String(body.runOutputDir || '').trim();
  if (!runOutputDirRaw) {
    res.status(400).json({ error: 'runOutputDir is required.' });
    return;
  }

  try {
    const runOutputDir = assertWithinNavigatorRoot(runOutputDirRaw);
    const manifestPath = path.join(runOutputDir, 'pipeline-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      res.status(404).json({ error: 'Pipeline manifest not found.' });
      return;
    }

    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const conversionReportJsonPath = assertWithinNavigatorRoot(
      String(manifest?.paths?.conversionReportJson || ''),
    );
    const conversionReportTextPath = assertWithinNavigatorRoot(
      String(manifest?.paths?.conversionReportText || ''),
    );

    if (!conversionReportJsonPath || !fs.existsSync(conversionReportJsonPath)) {
      res.status(404).json({ error: 'Conversion report JSON not found for this run.' });
      return;
    }

    const reportRaw = fs.readFileSync(conversionReportJsonPath, 'utf8');
    const report = JSON.parse(reportRaw);
    const textReport = fs.existsSync(conversionReportTextPath)
      ? fs.readFileSync(conversionReportTextPath, 'utf8')
      : '';

    res.json({
      runOutputDir,
      manifest,
      report,
      textReport,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load pipeline report.' });
  }
});

export default router;
