import { createConnection } from 'mariadb';

export default async function globalTeardown() {
  const database = 'calory_test';
  if (!database.endsWith('_test')) return;

  const conn = await createConnection({ host: 'localhost', port: 3307, user: 'root', password: 'root' });
  await conn.query(`DROP DATABASE IF EXISTS ${database}`);
  await conn.end();
}
