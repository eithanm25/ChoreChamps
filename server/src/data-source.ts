import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from './entities/User';
import { Task } from './entities/Task';
import { Submission } from './entities/Submission';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE ?? 'chore_champs',
  synchronize: true, // auto-sync schema in development; disable in production
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Task, Submission],
});
