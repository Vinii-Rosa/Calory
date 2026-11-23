import { afterAll } from '@jest/globals';
import db from '../db.js';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Os testes devem rodar com NODE_ENV=test');
}

afterAll(async () => {
  await db.$disconnect();
});
