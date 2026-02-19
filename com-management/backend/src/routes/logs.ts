import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const FRONTEND_LOG_PATH =
  process.env.FRONTEND_LOG_PATH || '/root/navigator/com-management/backend/frontend.log';
const MAX_MESSAGE_LENGTH = 4000;

const sanitizeLevel = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'debug' ? 'DEBUG' : 'INFO';
};

const sanitizeMessage = (value: unknown) => {
  const text = String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return text.slice(0, MAX_MESSAGE_LENGTH);
};

router.post('/frontend', (req, res) => {
  const body = req.body || {};
  const level = sanitizeLevel(body.level);
  const message = sanitizeMessage(body.message);
  const context = typeof body.context === 'string' ? sanitizeMessage(body.context) : '';
  if (!message) {
    res.status(400).json({ error: 'Missing log message.' });
    return;
  }

  const timestamp = new Date().toISOString();
  const requestId = String((req as any)?.id || '').trim();
  const line = `${timestamp} [FRONTEND] [${level}]${requestId ? ` [req:${requestId}]` : ''} ${message}${
    context ? ` | ${context}` : ''
  }\n`;

  try {
    fs.mkdirSync(path.dirname(FRONTEND_LOG_PATH), { recursive: true });
    fs.appendFileSync(FRONTEND_LOG_PATH, line, 'utf8');
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to persist frontend log.' });
  }
});

export default router;
