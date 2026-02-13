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

export default router;
