import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { z } from 'zod';
import db from '../../db.js';
import { authenticateMcp } from '../../middleware/auth_mcp.js';
import { MCP_TOOLS } from '../../controllers/mcp/tools.js';
import ApiTokensController from '../../controllers/api_tokens/index.js';
import UsersController from '../../controllers/users/index.js';
import { hashApiToken } from '../../utils/hash.js';
import { callAssertSuccess, mockReply } from '../../utils/test_helpers.js';

const log = { error: jest.fn(), info: jest.fn() } as any;

let mcpUserId = '';
let otherUserId = '';

function asUser(user_id: string) {
  return { user_id, email: '', type: 'access' } as const;
}

async function createUser(name: string, email: string) {
  await callAssertSuccess(UsersController.createUser, { body: { name, email, password: '123456' } }, 201);
  const user = await db.users.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return user.id;
}

async function createToken(user_id: string, name: string) {
  const body = await callAssertSuccess(
    ApiTokensController.createApiToken,
    { body: { name }, user: asUser(user_id) },
    201,
  );
  return body.api_token as { id: string; token: string };
}

// Passa pelo mesmo schema do SDK (aplica defaults como status EATEN)
async function callTool(name: string, args: Record<string, unknown> = {}, user_id = mcpUserId) {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool não encontrada: ${name}`);
  const parsed = z.object(tool.inputSchema).parse(args);
  return tool.run(parsed, { user_id, log });
}

describe('Servidor MCP', () => {
  let token = '';

  beforeAll(async () => {
    mcpUserId = await createUser('MCP', 'mcp@calory.com');
    otherUserId = await createUser('Outro', 'outro-mcp@calory.com');
    token = (await createToken(mcpUserId, 'teste')).token;
  });

  test('Autenticação exige token válido, não revogado', async () => {
    const authenticate = async (authorization?: string) => {
      const reply = mockReply();
      const request: any = { headers: authorization ? { authorization } : {} };
      await authenticateMcp(request, reply);
      return { reply, request };
    };

    const missing = await authenticate();
    expect(missing.reply.status).toHaveBeenCalledWith(401);

    const invalid = await authenticate('Bearer cal_invalido');
    expect(invalid.reply.status).toHaveBeenCalledWith(401);

    const valid = await authenticate(`Bearer ${token}`);
    expect(valid.reply.status).not.toHaveBeenCalled();
    expect(valid.request.mcp_user_id).toBe(mcpUserId);

    const stored = await db.api_tokens.findFirst({ where: { token_hash: hashApiToken(token) } });
    expect(stored?.last_used_at).toBeInstanceOf(Date);

    const revoked = await createToken(mcpUserId, 'revogado');
    await callAssertSuccess(
      ApiTokensController.deleteApiToken,
      { params: { api_token_id: revoked.id }, user: asUser(mcpUserId) },
      200,
    );
    const revokedResult = await authenticate(`Bearer ${revoked.token}`);
    expect(revokedResult.reply.status).toHaveBeenCalledWith(401);
  });

  test('log_meal_items registra refeição EATEN por padrão', async () => {
    const result = await callTool('log_meal_items', {
      date: '2029-03-05',
      type: 'LUNCH',
      items: [{ name: 'Arroz', quantity: 80, kcal: 104, protein: 2, carbs: 22.4, fat: 0.2 }],
    });
    expect(result.status).toBe(201);
    expect(result.body.meal).toMatchObject({ date: '2029-03-05', type: 'LUNCH', status: 'EATEN' });
    expect(result.body.meal.totals.kcal).toBe(104);
  });

  test('log_meal_items propaga erros de validação da API', async () => {
    const result = await callTool('log_meal_items', { items: [{ name: '', quantity: 1, kcal: 1 }] });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe('Nome do item não informado');
  });

  test('log_water e log_workout registram no dia informado', async () => {
    const water = await callTool('log_water', { amount_ml: 500, date: '2029-03-05' });
    expect(water).toMatchObject({ status: 201 });
    expect(water.body.water_log).toMatchObject({ date: '2029-03-05', amount_ml: 500 });

    const workout = await callTool('log_workout', { name: 'Corrida', date: '2029-03-05', duration_min: 30, kcal_burned: 300 });
    expect(workout.status).toBe(201);
    expect(workout.body.workout).toMatchObject({ name: 'Corrida', kcal_burned: 300 });
  });

  test('create_recipe calcula totais e log_recipe_portion lança a porção', async () => {
    const recipe = await callTool('create_recipe', {
      name: 'Bolo',
      total_weight_g: 900,
      ingredients: [{ name: 'Farinha', quantity: 900, kcal: 1500, protein: 30, carbs: 300, fat: 10 }],
    });
    expect(recipe.status).toBe(201);
    expect(recipe.body.recipe).toMatchObject({ name: 'Bolo', total_kcal: 1500, total_weight_g: 900 });

    const portion = await callTool('log_recipe_portion', { recipe_id: recipe.body.recipe.id, grams: 30, date: '2029-03-05' });
    expect(portion.status).toBe(201);
    expect(portion.body.portion.kcal).toBe(50);
    expect(portion.body.date).toBe('2029-03-05');
  });

  test('get_daily_summary reflete o que foi lançado', async () => {
    const summary = await callTool('get_daily_summary', { date: '2029-03-05' });
    expect(summary.status).toBe(200);
    expect(summary.body.consumed.kcal).toBe(154);
    expect(summary.body.water_ml).toBe(500);
    expect(summary.body.kcal_burned).toBe(300);
  });

  test('set_goals atualiza só os campos informados e get_goals retorna', async () => {
    const set = await callTool('set_goals', { kcal_goal: 2000, water_goal_ml: 3000 });
    expect(set.status).toBe(200);
    expect(set.body.settings).toMatchObject({ kcal_goal: 2000, water_goal_ml: 3000, protein_goal: null });

    const partial = await callTool('set_goals', { protein_goal: 120 });
    expect(partial.body.settings).toMatchObject({ kcal_goal: 2000, protein_goal: 120 });

    const removed = await callTool('set_goals', { water_goal_ml: null });
    expect(removed.body.settings.water_goal_ml).toBeNull();

    const goals = await callTool('get_goals');
    expect(goals.body.settings).toMatchObject({ kcal_goal: 2000, protein_goal: 120 });
  });

  test('Tools não acessam dados de outro usuário', async () => {
    const summary = await callTool('get_daily_summary', { date: '2029-03-05' }, otherUserId);
    expect(summary.body.consumed.kcal).toBe(0);
    expect(summary.body.water_ml).toBe(0);
  });
});
