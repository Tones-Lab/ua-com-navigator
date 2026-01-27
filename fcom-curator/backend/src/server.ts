import express, { Express, Request, Response, NextFunction } from 'express';
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

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
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

app.listen(port, () => {
  logger.info(`FCOM Curator Backend listening on port ${port}`);
});

export default app;
