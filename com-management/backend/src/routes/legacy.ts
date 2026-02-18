import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import AdmZip, { type IZipEntry } from 'adm-zip';
import { convertLegacyRules, renderLegacyTextReport } from '../services/legacy/legacyConversion';
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

const buildConfirmedFcomOverrideBundle = (report: any, minScore: number) => {
  const matchDiffs = Array.isArray(report?.matchDiffs) ? report.matchDiffs : [];
  const legacyObjects = Array.isArray(report?.legacyObjects) ? report.legacyObjects : [];
  const overrideProposals = Array.isArray(report?.overrideProposals) ? report.overrideProposals : [];
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
      const processors = Array.from(entry.fields.entries()).map(([field, value]) => ({
        op: 'add',
        path: '/-',
        value: {
          set: {
            source: value.value,
            targetField: `$.event.${field}`,
          },
        },
      }));
      return {
        objectName: entry.objectName,
        sourceFiles: Array.from(entry.sourceFiles),
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
    .map((proposal: any) => ({
      objectName: String(proposal?.objectName || 'legacy-object'),
      sourceFile: String(proposal?.sourceFile || ''),
      reason: 'No existing FCOM match found; generated COM definition proposal.',
      definition: {
        name: String(proposal?.objectName || 'legacy-object'),
        description: `Generated COM definition proposal from ${String(proposal?.sourceFile || 'legacy conversion')}`,
        domain: 'fault',
        method: 'trap',
        '@objectName': String(proposal?.objectName || 'legacy-object'),
        _type: 'object',
        event: { ...(proposal?.fields || {}) },
      },
    }));

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

router.post('/convert', (req, res) => {
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
    const report = convertLegacyRules({
      inputs: filtered,
      vendor: body.vendor ? String(body.vendor) : undefined,
      useMibs: body.useMibs === false ? false : true,
      useLlm: body.useLlm === true,
    });
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

export default router;
