import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source';
import authRoutes from './routes/auth.routes';
import familyRoutes from './routes/family.routes';
import taskRoutes from './routes/task.routes';
import { UPLOADS_DIR } from './utils/uploads';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.SERVER_PORT ?? '5000', 10);

app.use(cors());
app.use(express.json());

// Proof photos are stored locally and referenced by the client as '/uploads/<file>'.
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/tasks', taskRoutes);

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
