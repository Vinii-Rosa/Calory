import { createConnection } from 'mariadb';
import { execFileSync } from 'node:child_process';

export default async function globalSetup() {
  const database = 'calory_test';
  if (!database.endsWith('_test')) throw new Error('Banco de teste deve terminar com _test');

  const conn = await createConnection({ host: 'localhost', port: 3307, user: 'root', password: 'root' });
  await conn.query(`DROP DATABASE IF EXISTS ${database}`);
  await conn.query(`CREATE DATABASE ${database}`);
  await conn.end();

  execFileSync('node_modules/.bin/prisma', ['db', 'push'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `mysql://root:root@localhost:3307/${database}` },
  });
}
