import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.SERVER_PORT ?? '5000', 10);

app.use(cors());
app.use(express.json());

/** Health check — confirms the API is running and the database is reachable. */
app.get('/api/health', (_req: Request, res: Response) => {
  const dbConnected = AppDataSource.isInitialized;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

async function bootstrap(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`ChoreChamps server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
