import express, { Express, Request, Response, NextFunction } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
import routes from '@/routes/index';
// import { errorHandler } from './middlewares/error.middleware';

const app: Express = express();

// Middleware
// app.use(helmet());
// app.use(cors());
// app.use(morgan('dev'));
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
// app.use(errorHandler);

export default app;
