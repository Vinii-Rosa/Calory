import { describe, expect, test } from '@jest/globals';
import RecipesController from '../../controllers/recipes/index.js';
import MealsController from '../../controllers/meals/index.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;

const cake = {
  name: 'Bolo',
  total_weight_g: 900,
  ingredients: [
    { name: 'Farinha', quantity: 400, kcal: 1000, protein: 40, carbs: 200, fat: 4 },
    { name: 'Açúcar', quantity: 200, kcal: 500, carbs: 120 },
  ],
};

describe('Receitas', () => {
  let recipeId = '';

  test('Cria receita com totais calculados', async () => {
    const body = await callAssertSuccess(RecipesController.createRecipe, { body: cake }, 201);
    expect(body.recipe).toMatchObject({ name: 'Bolo', total_weight_g: 900, total_kcal: 1500, total_protein: 40, total_carbs: 320, total_fat: 4 });
    expect(body.recipe.ingredients).toHaveLength(2);
    recipeId = body.recipe.id;
  });

  test('Peso total padrão é a soma dos ingredientes em g/ml', async () => {
    const body = await callAssertSuccess(RecipesController.createRecipe, { body: { ...cake, total_weight_g: undefined } }, 201);
    expect(body.recipe.total_weight_g).toBe(600);
  });

  test('Exige peso total quando houver unidade não-peso', async () => {
    await callAssertError(
      RecipesController.createRecipe,
      { body: { name: 'Omelete', ingredients: [{ name: 'Ovo', quantity: 2, unit: 'un', kcal: 140 }] } },
      'Peso total da receita não informado',
    );
  });

  test('Valida campos', async () => {
    await callAssertError(RecipesController.createRecipe, { body: {} }, 'Nome da receita não informado');
    await callAssertError(RecipesController.createRecipe, { body: { name: 'X' } }, 'Ingredientes não informados');
    await callAssertError(RecipesController.createRecipe, { body: { name: 'X', ingredients: [] } }, 'Ingredientes não informados');
    await callAssertError(
      RecipesController.createRecipe,
      { body: { name: 'X', ingredients: [{ name: ' ', quantity: 1, kcal: 1 }] } },
      'Nome do ingrediente não informado',
    );
    await callAssertError(
      RecipesController.createRecipe,
      { body: { name: 'X', ingredients: [{ name: 'a', quantity: 0, kcal: 1 }] } },
      'Quantidade do ingrediente inválida',
    );
    await callAssertError(RecipesController.createRecipe, { body: { ...cake, total_weight_g: 0 } }, 'Peso total da receita inválido');
  });

  test('Lista e busca receita', async () => {
    const list = await callAssertSuccess(RecipesController.getAllRecipes, {}, 200);
    expect(list.recipes.length).toBeGreaterThanOrEqual(2);
    expect(list.recipes[0].ingredients).toBeUndefined();

    const one = await callAssertSuccess(RecipesController.getRecipe, { params: { recipe_id: recipeId } }, 200);
    expect(one.recipe.ingredients).toHaveLength(2);

    await callAssertError(RecipesController.getRecipe, { params: { recipe_id: 'inexistente' } }, 'Receita não encontrada');
  });

  test('Não acessa receita de outro usuário', async () => {
    await callAssertError(RecipesController.getRecipe, { params: { recipe_id: recipeId }, user: OTHER_USER }, 'Receita não encontrada');
    await callAssertError(
      RecipesController.getPortion,
      { params: { recipe_id: recipeId }, body: { grams: 30 }, user: OTHER_USER },
      'Receita não encontrada',
    );
  });

  test('Calcula porção: bolo 1500 kcal / 900 g -> 30 g = 50 kcal', async () => {
    const body = await callAssertSuccess(RecipesController.getPortion, { params: { recipe_id: recipeId }, body: { grams: 30 } }, 200);
    expect(body.portion).toMatchObject({ grams: 30, kcal: 50, protein: 1.33, carbs: 10.67, fat: 0.13 });
    expect(body.meal_id).toBeUndefined();
  });

  test('Valida porção', async () => {
    await callAssertError(RecipesController.getPortion, { params: { recipe_id: recipeId }, body: {} }, 'Gramas inválidas');
    await callAssertError(RecipesController.getPortion, { params: { recipe_id: recipeId }, body: { grams: -1 } }, 'Gramas inválidas');
    await callAssertError(
      RecipesController.getPortion,
      { params: { recipe_id: recipeId }, body: { grams: 30, type: 'X' } },
      'Tipo de refeição inválido',
    );
  });

  test('Lança porção em nova refeição (EATEN por padrão)', async () => {
    const body = await callAssertSuccess(
      RecipesController.getPortion,
      { params: { recipe_id: recipeId }, body: { grams: 30, log: true, date: '2027-01-05', type: 'SNACK' } },
      201,
    );
    expect(body.date).toBe('2027-01-05');
    const meals = await callAssertSuccess(MealsController.getAllMeals, { query: { date: '2027-01-05' } }, 200);
    const meal = meals.meals.find((m: any) => m.id === body.meal_id);
    expect(meal).toMatchObject({ type: 'SNACK', status: 'EATEN' });
    expect(meal.items[0]).toMatchObject({ name: 'Bolo', quantity: 30, kcal: 50, recipe_id: recipeId });
  });

  test('Lança porção em refeição existente', async () => {
    const created = await callAssertSuccess(
      MealsController.createMeal,
      { body: { date: '2027-01-06', items: [{ name: 'Café', quantity: 100, unit: 'ml', kcal: 2 }] } },
      201,
    );
    const body = await callAssertSuccess(
      RecipesController.getPortion,
      { params: { recipe_id: recipeId }, body: { grams: 60, log: true, meal_id: created.meal.id } },
      201,
    );
    expect(body.meal_id).toBe(created.meal.id);
    const meals = await callAssertSuccess(MealsController.getAllMeals, { query: { date: '2027-01-06' } }, 200);
    expect(meals.meals.find((m: any) => m.id === created.meal.id).totals.kcal).toBe(102);

    await callAssertError(
      RecipesController.getPortion,
      { params: { recipe_id: recipeId }, body: { grams: 60, log: true, meal_id: 'nope' } },
      'Refeição não encontrada',
    );
  });
});
