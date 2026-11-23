import { describe, expect, test } from '@jest/globals';
import LoginController from '../../controllers/login/index.js';
import UsersController from '../../controllers/users/index.js';
import { callAssertError, callAssertSuccess, defaultUserData } from '../../utils/test_helpers.js';

describe('Usuários', () => {
  test('Cria usuário com senha criptografada', async () => {
    await callAssertSuccess(
      UsersController.createUser,
      { body: { name: 'Maria', email: 'Maria@Calory.com', password: 'abcdef' } },
      201,
    );
    const login = await callAssertSuccess(LoginController.login, { body: { email: 'maria@calory.com', password: 'abcdef' } }, 200);
    expect(login.user.name).toBe('Maria');
  });

  test('Rejeita email duplicado', async () => {
    await callAssertError(
      UsersController.createUser,
      { body: { name: 'Outra', email: 'maria@calory.com', password: 'abcdef' } },
      'Email já em uso',
    );
  });

  test('Valida campos obrigatórios', async () => {
    await callAssertError(UsersController.createUser, { body: { email: 'a@a.com', password: '123456' } }, 'Nome não informado');
    await callAssertError(UsersController.createUser, { body: { name: 'A', password: '123456' } }, 'Email não informado');
    await callAssertError(UsersController.createUser, { body: { name: 'A', email: 'invalido', password: '123456' } }, 'Email inválido');
    await callAssertError(UsersController.createUser, { body: { name: 'A', email: 'a@a.com' } }, 'Senha não informada');
    await callAssertError(
      UsersController.createUser,
      { body: { name: 'A', email: 'a@a.com', password: '123' } },
      'Senha deve ter no mínimo 6 caracteres',
    );
  });

  test('getUserById devolve o usuário logado sem senha', async () => {
    const body = await callAssertSuccess(UsersController.getUserById, { params: { user_id: defaultUserData.id } }, 200);
    expect(body.user.email).toBe('teste@calory.com');
    expect(body.user.password).toBeUndefined();
  });

  test('getUserById bloqueia acesso a outro usuário', async () => {
    await callAssertError(
      UsersController.getUserById,
      { params: { user_id: '00000000-0000-4000-8000-0000000000ff' } },
      'Usuário sem permissão para acessar este usuário',
    );
  });
});
