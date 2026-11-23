import { describe, expect, test } from '@jest/globals';
import db from '../../db.js';
import { app } from '../../serve.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { ensureDefaultData } from '../../utils/test_helpers.js';

describe('Fundação', () => {
  test('Conecta no banco de teste calory_test', async () => {
    const rows = await db.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
    expect(rows[0].name).toBe('calory_test');
  });

  test('GET /health responde ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  test('Hash de senha confere com a senha original', async () => {
    const hashed = await hashPassword('123456');
    expect(hashed).not.toBe('123456');
    expect(await comparePassword('123456', hashed)).toBe(true);
    expect(await comparePassword('errada', hashed)).toBe(false);
  });

  test('Cria usuário padrão de teste no banco', async () => {
    await ensureDefaultData();
    const user = await db.users.findUnique({ where: { email: 'teste@calory.com' } });
    expect(user?.name).toBe('Usuário Teste');
  });
});
