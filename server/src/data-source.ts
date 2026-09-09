import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Family } from './entities/Family';
import { User } from './entities/User';
import { ChildProfile } from './entities/ChildProfile';
import { Task } from './entities/Task';
import { Submission } from './entities/Submission';
import { Reward } from './entities/Reward';
import { RewardContribution } from './entities/RewardContribution';
import { WalletTransaction } from './entities/WalletTransaction';

dotenv.config();

// Cloud (Supabase): a single DATABASE_URL + TLS. Local dev: discrete DB_* vars.
const databaseUrl = process.env.DATABASE_URL;

// `synchronize` auto-creates/alters tables from the entities. Safe for the FIRST
// boot against an empty database; it MUST be off afterwards (a later entity
// change could drop a column). Controlled by DB_SYNCHRONIZE ('true'/'false');
// defaults to on only outside production.
const synchronize =
  process.env.DB_SYNCHRONIZE != null
    ? process.env.DB_SYNCHRONIZE === 'true'
    : process.env.NODE_ENV !== 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
        url: databaseUrl,
        ssl: { rejectUnauthorized: false }, // Supabase requires TLS
      }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE ?? 'chore_champs',
      }),
  synchronize,
  logging: process.env.NODE_ENV === 'development',
  entities: [Family, User, ChildProfile, Task, Submission, Reward, RewardContribution, WalletTransaction],
});
