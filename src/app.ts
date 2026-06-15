import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from '@/routes/index';
import { errorHandler } from './middlewares/error.middleware';
import { config } from '@/config/index';

const app: Express = express();

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Request không có Origin (curl, server-to-server, health check) → cho qua.
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  // Dev: Vite hay nhảy cổng (5173 → 5174 → ...), cho phép mọi localhost.
  // Production vẫn chỉ chấp nhận origin trong CORS_ORIGIN.
  if (
    config.nodeEnv !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  ) {
    return true;
  }
  return false;
};

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
