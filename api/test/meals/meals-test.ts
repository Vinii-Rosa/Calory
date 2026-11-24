import { describe, expect, test } from '@jest/globals';
import MealsController from '../../controllers/meals/index.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;

const rice = { name: 'Arroz', quantity: 80, unit: 'g', kcal: 104, protein: 2, carbs: 22.4, fat: 0.2 };
const sashimi = { name: 'Sashimi', quantity: 150, unit: 'g', kcal: 190, protein: 40, fat: 3 };

describe('Refeições', () => {
  let mealId = '';

  test('Cria refeição com itens e totais', async () => {
    const body = await callAssertSuccess(
      MealsController.createMeal,
      { body: { date: '2026-05-04', type: 'LUNCH', status: 'EATEN', items: [rice, sashimi] } },
      201,
    );
    expect(body.meal).toMatchObject({ date: '2026-05-04', type: 'LUNCH', status: 'EATEN' });
    expect(body.meal.items).toHaveLength(2);
    expect(body.meal.items.find((i: any) => i.name === 'Sashimi')).toMatchObject({ unit: 'g', carbs: 0 });
    expect(body.meal.totals).toEqual({ kcal: 294, protein: 42, carbs: 22.4, fat: 3.2, fiber: 0 });
    mealId = body.meal.id;
  });

  test('Unidade padrão é g quando não informada', async () => {
    const body = await callAssertSuccess(
      MealsController.createMeal,
      { body: { items: [{ name: 'Ovo', quantity: 2, kcal: 140 }, { name: 'Leite', quantity: 200, unit: 'ml', kcal: 120 }] } },
      201,
    );
    expect(body.meal.items.find((i: any) => i.name === 'Ovo').unit).toBe('g');
    expect(body.meal.items.find((i: any) => i.name === 'Leite').unit).toBe('ml');
  });

  test('Padrões: tipo OTHER, status PLANNED, data hoje', async () => {
    const body = await callAssertSuccess(MealsController.createMeal, { body: { items: [rice] } }, 201);
    expect(body.meal).toMatchObject({ type: 'OTHER', status: 'PLANNED', date: new Date().toISOString().slice(0, 10) });
  });

  test('Valida campos', async () => {
    await callAssertError(MealsController.createMeal, { body: {} }, 'Itens não informados');
    await callAssertError(MealsController.createMeal, { body: { items: [] } }, 'Itens não informados');
    await callAssertError(MealsController.createMeal, { body: { items: 'x' } }, 'Itens inválidos');
    await callAssertError(MealsController.createMeal, { body: { items: [{ ...rice, name: ' ' }] } }, 'Nome do item não informado');
    await callAssertError(MealsController.createMeal, { body: { items: [{ ...rice, quantity: 0 }] } }, 'Quantidade do item inválida');
    await callAssertError(MealsController.createMeal, { body: { items: [{ ...rice, kcal: -1 }] } }, 'Calorias do item inválidas');
    await callAssertError(MealsController.createMeal, { body: { items: [{ ...rice, fat: -1 }] } }, 'Macronutrientes do item inválidos');
    await callAssertError(MealsController.createMeal, { body: { items: [rice], type: 'BRUNCH' } }, 'Tipo de refeição inválido');
    await callAssertError(MealsController.createMeal, { body: { items: [rice], status: 'X' } }, 'Status da refeição inválido');
    await callAssertError(MealsController.createMeal, { body: { items: [rice], date: 'ontem' } }, 'Data inválida. Use o formato AAAA-MM-DD');
    await callAssertError(
      MealsController.createMeal,
      { body: { items: [{ ...rice, recipe_id: '00000000-0000-4000-8000-0000000000aa' }] } },
      'Receita não encontrada',
    );
  });

  test('Lista por data, status e semana', async () => {
    await callAssertSuccess(MealsController.createMeal, { body: { date: '2026-05-06', status: 'PLANNED', type: 'DINNER', items: [rice] } }, 201);
    await callAssertSuccess(MealsController.createMeal, { body: { date: '2026-05-11', status: 'PLANNED', items: [rice] } }, 201);

    const byDate = await callAssertSuccess(MealsController.getAllMeals, { query: { date: '2026-05-04' } }, 200);
    expect(byDate.meals).toHaveLength(1);
    expect(byDate.totals.kcal).toBe(294);

    // 2026-05-07 (quinta) -> semana 04/05 a 10/05
    const week = await callAssertSuccess(MealsController.getAllMeals, { query: { week: '2026-05-07' } }, 200);
    expect(week.meals.map((m: any) => m.date)).toEqual(['2026-05-04', '2026-05-06']);

    const planned = await callAssertSuccess(MealsController.getAllMeals, { query: { week: '2026-05-07', status: 'PLANNED' } }, 200);
    expect(planned.meals).toHaveLength(1);

    const range = await callAssertSuccess(MealsController.getAllMeals, { query: { start_date: '2026-05-05', end_date: '2026-05-31' } }, 200);
    expect(range.meals).toHaveLength(2);

    await callAssertError(MealsController.getAllMeals, { query: { status: 'X' } }, 'Status da refeição inválido');
    await callAssertError(MealsController.getAllMeals, { query: { week: 'x' } }, 'Data da semana inválida. Use o formato AAAA-MM-DD');
  });

  test('Atualiza campos e substitui itens', async () => {
    const body = await callAssertSuccess(
      MealsController.updateMeal,
      { params: { meal_id: mealId }, body: { status: 'PLANNED', note: ' Sem sal ', items: [sashimi] } },
      200,
    );
    expect(body.meal).toMatchObject({ status: 'PLANNED', note: 'Sem sal' });
    expect(body.meal.items).toHaveLength(1);
    expect(body.meal.totals.kcal).toBe(190);
  });

  test('Atualização exige campo e valida valores', async () => {
    await callAssertError(MealsController.updateMeal, { params: { meal_id: mealId }, body: {} }, 'Nenhum campo informado para atualização');
    await callAssertError(MealsController.updateMeal, { params: { meal_id: mealId }, body: { items: [] } }, 'Itens não informados');
    await callAssertError(MealsController.updateMeal, { params: { meal_id: mealId }, body: { type: 'X' } }, 'Tipo de refeição inválido');
  });

  test('Copia semana planejada para outra', async () => {
    const body = await callAssertSuccess(
      MealsController.copyWeek,
      { body: { source_date: '2026-05-07', target_date: '2026-06-03' } },
      201,
    );
    // origem PLANNED: 04/05 (agora PLANNED), 06/05 -> destino semana de 01/06
    expect(body.week_start).toBe('2026-06-01');
    expect(body.meals.map((m: any) => m.date)).toEqual(['2026-06-01', '2026-06-03']);
    expect(body.meals.every((m: any) => m.status === 'PLANNED')).toBe(true);

    const copied = await callAssertSuccess(MealsController.getAllMeals, { query: { week: '2026-06-01' } }, 200);
    expect(copied.meals).toHaveLength(2);
  });

  test('Copy-week valida entradas', async () => {
    await callAssertError(MealsController.copyWeek, { body: { target_date: '2026-06-01' } }, 'Data da semana de origem inválida. Use o formato AAAA-MM-DD');
    await callAssertError(MealsController.copyWeek, { body: { source_date: '2026-06-01' } }, 'Data da semana de destino inválida. Use o formato AAAA-MM-DD');
    await callAssertError(
      MealsController.copyWeek,
      { body: { source_date: '2026-06-01', target_date: '2026-06-05' } },
      'A semana de destino deve ser diferente da origem',
    );
    await callAssertError(
      MealsController.copyWeek,
      { body: { source_date: '2027-01-04', target_date: '2027-01-11' } },
      'Nenhuma refeição encontrada na semana de origem',
    );
  });

  test('Não acessa refeição de outro usuário', async () => {
    await callAssertError(MealsController.updateMeal, { params: { meal_id: mealId }, body: { note: 'x' }, user: OTHER_USER }, 'Refeição não encontrada');
    await callAssertError(MealsController.deleteMeal, { params: { meal_id: mealId }, user: OTHER_USER }, 'Refeição não encontrada');
    const body = await callAssertSuccess(MealsController.getAllMeals, { user: OTHER_USER }, 200);
    expect(body.meals).toHaveLength(0);
  });

  test('Remove refeição e depois retorna 404', async () => {
    await callAssertSuccess(MealsController.deleteMeal, { params: { meal_id: mealId } }, 200);
    await callAssertError(MealsController.deleteMeal, { params: { meal_id: mealId } }, 'Refeição não encontrada');
  });
});
