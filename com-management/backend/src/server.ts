import express, { Express, Request, Response, NextFunction } from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import fileBrowserRoutes from './routes/fileBrowser';
import fileEditorRoutes from './routes/fileEditor';
import schemaRoutes from './routes/schema';
import favoritesRoutes from './routes/favorites';
import foldersRoutes from './routes/folders';
import eventsSchemaRoutes from './routes/eventsSchema';
import searchRoutes from './routes/search';
import overridesRoutes from './routes/overrides';
import brokerRoutes from './routes/broker';
import mibRoutes from './routes/mibs';
import overviewRoutes from './routes/overview';
import { startSearchIndexing } from './services/searchIndex';
import { startOverviewIndexing } from './services/overviewIndex';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;
const sslKeyPath = process.env.SSL_KEY_PATH || '/opt/assure1/etc/ssl/Web.key';
const sslCertPath = process.env.SSL_CERT_PATH || '/opt/assure1/etc/ssl/Web.crt';
const useHttps = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

app.set('trust proxy', 1);
app.disable('etag');

// Middleware
app.use(helmet());
const defaultFrontend = useHttps ? 'https://localhost:5173' : 'http://localhost:5173';
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  defaultFrontend,
  'https://lab-ua-tony02.tony.lab:5173',
  'http://lab-ua-tony02.tony.lab:5173',
].filter(Boolean) as string[]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
app.use(morgan('combined', { stream: { write: (msg: string) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).id = uuidv4();
  logger.info(`[${req.method}] ${req.path} - Request ID: ${(req as any).id}`);
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/servers', serverRoutes);
app.use('/api/v1/files', fileBrowserRoutes);
app.use('/api/v1/files', fileEditorRoutes);
app.use('/api/v1/schema', schemaRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/folders', foldersRoutes);
app.use('/api/v1/events/schema', eventsSchemaRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/overrides', overridesRoutes);
app.use('/api/v1/broker', brokerRoutes);
app.use('/api/v1/mibs', mibRoutes);
app.use('/api/v1/overview', overviewRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[${(req as any).id}] Error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message,
    request_id: (req as any).id,
  });
});

if (useHttps) {
  const key = fs.readFileSync(sslKeyPath);
  const cert = fs.readFileSync(sslCertPath);
  https.createServer({ key, cert }, app).listen(port, () => {
    logger.info(`COM Management Backend listening on https://localhost:${port}`);
  });
} else {
  app.listen(port, () => {
    logger.info(`COM Management Backend listening on http://localhost:${port}`);
  });
}

startSearchIndexing();
startOverviewIndexing();

export default app;
