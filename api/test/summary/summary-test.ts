import { beforeAll, describe, expect, test } from '@jest/globals';
import MealsController from '../../controllers/meals/index.js';
import SettingsController from '../../controllers/settings/index.js';
import SummaryController from '../../controllers/summary/index.js';
import WaterController from '../../controllers/water/index.js';
import WorkoutsController from '../../controllers/workouts/index.js';
import db from '../../db.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;
// Usuário próprio para não alterar as metas do usuário padrão usado nos outros testes
const SUMMARY_USER = { user_id: '00000000-0000-4000-8000-0000000000a1', email: 'resumo@calory.com', type: 'access' } as const;

// Semana 2030-01-07 (seg) a 2030-01-13 (dom): sem colisão com os outros testes
describe('Resumo', () => {
  beforeAll(async () => {
    await db.users.upsert({
      where: { id: SUMMARY_USER.user_id },
      update: {},
      create: { id: SUMMARY_USER.user_id, name: 'Resumo', email: SUMMARY_USER.email, password: 'x' },
    });
    await callAssertSuccess(
      SettingsController.updateSettings,
      { body: { kcal_goal: 2000, protein_goal: 150, carbs_goal: 200, fat_goal: 60, water_goal_ml: 2500 }, user: SUMMARY_USER },
      200,
    );
    const item = (kcal: number) => ({ name: 'Comida', quantity: 100, kcal, protein: 10, carbs: 20, fat: 5 });
    const meal = (date: string, status: string, kcal: number) =>
      callAssertSuccess(MealsController.createMeal, { body: { date, status, items: [item(kcal)] }, user: SUMMARY_USER }, 201);

    await meal('2030-01-08', 'EATEN', 600);
    await meal('2030-01-08', 'EATEN', 400);
    await meal('2030-01-08', 'PLANNED', 1000);
    await meal('2030-01-10', 'EATEN', 500);
    await callAssertSuccess(WaterController.createWaterLog, { body: { date: '2030-01-08', amount_ml: 1000 }, user: SUMMARY_USER }, 201);
    await callAssertSuccess(WaterController.createWaterLog, { body: { date: '2030-01-10', amount_ml: 500 }, user: SUMMARY_USER }, 201);
    await callAssertSuccess(WorkoutsController.createWorkout, { body: { date: '2030-01-08', name: 'Corrida', kcal_burned: 300 }, user: SUMMARY_USER }, 201);
  });

  test('Resumo diário: consumido, planejado, água, queimadas e saldo', async () => {
    const body = await callAssertSuccess(SummaryController.getDailySummary, { query: { date: '2030-01-08' }, user: SUMMARY_USER }, 200);
    expect(body.consumed).toMatchObject({ kcal: 1000, protein: 20, carbs: 40, fat: 10 });
    expect(body.planned.kcal).toBe(1000);
    expect(body.water_ml).toBe(1000);
    expect(body.kcal_burned).toBe(300);
    expect(body.balance).toEqual({ kcal: 1300, protein: 130, carbs: 160, fat: 50, water_ml: 1500 });
  });

  test('Dia sem registros vem zerado', async () => {
    const body = await callAssertSuccess(SummaryController.getDailySummary, { query: { date: '2030-01-09' }, user: SUMMARY_USER }, 200);
    expect(body.consumed.kcal).toBe(0);
    expect(body.water_ml).toBe(0);
    expect(body.balance.kcal).toBe(2000);
  });

  test('Usuário sem metas tem saldo nulo e não vê dados de outro', async () => {
    const body = await callAssertSuccess(SummaryController.getDailySummary, { query: { date: '2030-01-08' }, user: OTHER_USER }, 200);
    expect(body.consumed.kcal).toBe(0);
    expect(body.balance).toEqual({ kcal: null, protein: null, carbs: null, fat: null, water_ml: null });
  });

  test('Resumo semanal soma a semana seg–dom', async () => {
    const body = await callAssertSuccess(SummaryController.getWeeklySummary, { query: { date: '2030-01-12' }, user: SUMMARY_USER }, 200);
    expect(body.start_date).toBe('2030-01-07');
    expect(body.end_date).toBe('2030-01-13');
    expect(body.days).toHaveLength(7);
    expect(body.consumed.kcal).toBe(1500);
    expect(body.planned.kcal).toBe(1000);
    expect(body.water_ml).toBe(1500);
    expect(body.kcal_burned).toBe(300);
    expect(body.average_consumed_kcal).toBe(750);
    expect(body.planned_vs_consumed.kcal).toBe(500);
    expect(body.days[1]).toMatchObject({ date: '2030-01-08', water_ml: 1000 });
  });

  test('Valida datas', async () => {
    await callAssertError(SummaryController.getDailySummary, { query: { date: 'x' } }, 'Data inválida. Use o formato AAAA-MM-DD');
    await callAssertError(SummaryController.getWeeklySummary, { query: { date: 'x' } }, 'Data inválida. Use o formato AAAA-MM-DD');
  });
});
