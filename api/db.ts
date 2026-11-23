import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const database = process.env.NODE_ENV === 'test' ? 'calory_test' : 'calory';

export const databaseUrl = process.env.NODE_ENV === 'test'
  ? `mysql://root:root@localhost:3307/${database}`
  : process.env.DATABASE_URL ?? `mysql://root:root@localhost:3307/${database}`;

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) || 3307,
  user: 'root',
  password: 'root',
  database,
  connectionLimit: 5,
});

const db = new PrismaClient({ adapter });

export default db;
