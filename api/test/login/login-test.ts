import { describe, expect, jest, test } from '@jest/globals';
import LoginController from '../../controllers/login/index.js';
import { callAssertError, callAssertSuccess, defaultUserData, ensureDefaultData } from '../../utils/test_helpers.js';

describe('Login', () => {
  test('Login válido devolve token e define cookie de refresh', async () => {
    await ensureDefaultData();
    const body = await callAssertSuccess(
      LoginController.login,
      { body: { email: defaultUserData.email, password: defaultUserData.password } },
      200,
    );
    expect(body.token).toBe('token-test');
    expect(body.user.email).toBe(defaultUserData.email);
    expect(body.user.password).toBeUndefined();
  });

  test('Senha errada retorna 401', async () => {
    await ensureDefaultData();
    await callAssertError(
      LoginController.login,
      { body: { email: defaultUserData.email, password: 'errada' } },
      'Email ou senha inválidos',
    );
  });

  test('Email inexistente retorna 401', async () => {
    await callAssertError(LoginController.login, { body: { email: 'nao@existe.com', password: '123456' } }, 'Email ou senha inválidos');
  });

  test('Valida campos obrigatórios', async () => {
    await callAssertError(LoginController.login, { body: { password: '123456' } }, 'Email não informado');
    await callAssertError(LoginController.login, { body: { email: 'a@a.com' } }, 'Senha não informada');
  });

  test('Refresh com token de refresh válido emite novo par', async () => {
    const user = await ensureDefaultData();
    const jwtVerify = jest.fn<() => Promise<unknown>>().mockResolvedValue({ user_id: user.id, email: user.email, type: 'refresh' });
    const body = await callAssertSuccess(LoginController.refresh, { jwtVerify }, 200);
    expect(body.token).toBe('token-test');
  });

  test('Refresh com token de acesso é rejeitado', async () => {
    const user = await ensureDefaultData();
    const jwtVerify = jest.fn<() => Promise<unknown>>().mockResolvedValue({ user_id: user.id, email: user.email, type: 'access' });
    await callAssertError(LoginController.refresh, { jwtVerify }, 'Refresh token inválido ou ausente');
  });

  test('Refresh sem cookie retorna 401', async () => {
    const jwtVerify = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('sem cookie'));
    await callAssertError(LoginController.refresh, { jwtVerify }, 'Refresh token inválido ou ausente');
  });

  test('Logout limpa o cookie', async () => {
    await callAssertSuccess(LoginController.logout, {}, 200);
  });
});
