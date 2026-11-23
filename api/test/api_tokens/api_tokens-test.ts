import { describe, expect, test } from '@jest/globals';
import ApiTokensController from '../../controllers/api_tokens/index.js';
import { generateApiToken, hashApiToken } from '../../utils/hash.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

describe('Tokens de API (MCP)', () => {
  let tokenId = '';

  test('Cria token e devolve o valor em texto apenas uma vez', async () => {
    const body = await callAssertSuccess(ApiTokensController.createApiToken, { body: { name: 'Claude Desktop' } }, 201);
    expect(body.api_token.token).toMatch(/^cal_[0-9a-f]{64}$/);
    tokenId = body.api_token.id;
  });

  test('Gera tokens únicos e o hash não é o próprio token', () => {
    const a = generateApiToken();
    expect(a).not.toBe(generateApiToken());
    expect(hashApiToken(a)).not.toBe(a);
    expect(hashApiToken(a)).toBe(hashApiToken(a));
  });

  test('Exige nome', async () => {
    await callAssertError(ApiTokensController.createApiToken, { body: {} }, 'Nome não informado');
  });

  test('Lista tokens sem expor hash nem token', async () => {
    const body = await callAssertSuccess(ApiTokensController.getAllApiTokens, {}, 200);
    const found = body.api_tokens.find((t: any) => t.id === tokenId);
    expect(found.name).toBe('Claude Desktop');
    expect(found.token).toBeUndefined();
    expect(found.token_hash).toBeUndefined();
  });

  test('Não revoga token de outro usuário', async () => {
    await callAssertError(
      ApiTokensController.deleteApiToken,
      { params: { api_token_id: tokenId }, user: { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } },
      'Token não encontrado',
    );
  });

  test('Revoga token e some da listagem', async () => {
    await callAssertSuccess(ApiTokensController.deleteApiToken, { params: { api_token_id: tokenId } }, 200);
    const body = await callAssertSuccess(ApiTokensController.getAllApiTokens, {}, 200);
    expect(body.api_tokens.find((t: any) => t.id === tokenId)).toBeUndefined();
  });

  test('Revogar de novo retorna 404', async () => {
    await callAssertError(ApiTokensController.deleteApiToken, { params: { api_token_id: tokenId } }, 'Token não encontrado');
  });
});
