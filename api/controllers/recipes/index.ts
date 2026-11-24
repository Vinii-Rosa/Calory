import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { parseDate, todayDate, formatDate } from '../../utils/dates.js';
import { portionOf, round2, sumItems } from '../../utils/nutrition.js';
import { isInvalidOptional, isNonNegative } from '../../utils/validation.js';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'];
const MEAL_STATUSES = ['PLANNED', 'EATEN'];
const WEIGHT_UNITS = ['g', 'ml'];

type IngredientBody = {
  name?: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type RecipeBody = {
  name?: string;
  total_weight_g?: number;
  ingredients?: IngredientBody[];
};

type PortionBody = {
  grams?: number;
  log?: boolean;
  meal_id?: string;
  date?: string;
  type?: string;
  status?: string;
};

function formatIngredient(ingredient: any) {
  return {
    id: ingredient.id,
    name: ingredient.name,
    quantity: Number(ingredient.quantity),
    unit: ingredient.unit,
    kcal: Number(ingredient.kcal),
    protein: Number(ingredient.protein),
    carbs: Number(ingredient.carbs),
    fat: Number(ingredient.fat),
  };
}

function formatRecipe(recipe: any, withIngredients = true) {
  const data: Record<string, unknown> = {
    id: recipe.id,
    name: recipe.name,
    total_weight_g: Number(recipe.total_weight_g),
    total_kcal: Number(recipe.total_kcal),
    total_protein: Number(recipe.total_protein),
    total_carbs: Number(recipe.total_carbs),
    total_fat: Number(recipe.total_fat),
    created_at: recipe.created_at,
  };
  if (withIngredients) data.ingredients = recipe.ingredients.map(formatIngredient);
  return data;
}

function validateIngredient(raw: IngredientBody): string | null {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return 'Nome do ingrediente não informado';
  if (typeof raw.quantity !== 'number' || !Number.isFinite(raw.quantity) || raw.quantity <= 0) return 'Quantidade do ingrediente inválida';
  if (!isNonNegative(raw.kcal)) return 'Calorias do ingrediente inválidas';
  if ([raw.protein, raw.carbs, raw.fat].some(isInvalidOptional)) return 'Macronutrientes do ingrediente inválidos';
  if (raw.unit !== undefined && (typeof raw.unit !== 'string' || !raw.unit.trim())) return 'Unidade do ingrediente inválida';
  return null;
}

const RecipesController = {
  createRecipe: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const body = req.body as RecipeBody;
      const { user_id } = req.user;

      if (typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).send({ message: 'Nome da receita não informado' });
      }
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
        return res.status(400).send({ message: 'Ingredientes não informados' });
      }

      for (const raw of body.ingredients) {
        const invalid = validateIngredient(raw);
        if (invalid) return res.status(400).send({ message: invalid });
      }

      const ingredients = body.ingredients.map((raw) => ({
        name: raw.name!.trim(),
        quantity: raw.quantity!,
        unit: raw.unit?.trim() || 'g',
        kcal: raw.kcal!,
        protein: raw.protein ?? 0,
        carbs: raw.carbs ?? 0,
        fat: raw.fat ?? 0,
      }));

      // Sem peso final informado, assume a soma dos ingredientes (só vale se todos forem g/ml)
      let totalWeight = body.total_weight_g;
      if (totalWeight === undefined) {
        if (!ingredients.every((i) => WEIGHT_UNITS.includes(i.unit))) {
          return res.status(400).send({ message: 'Peso total da receita não informado' });
        }
        totalWeight = ingredients.reduce((acc, i) => acc + i.quantity, 0);
      }
      if (typeof totalWeight !== 'number' || !Number.isFinite(totalWeight) || totalWeight <= 0) {
        return res.status(400).send({ message: 'Peso total da receita inválido' });
      }

      const totals = sumItems(ingredients);

      const recipe = await db.$transaction(async (tx) => {
        return tx.recipes.create({
          data: {
            user_id,
            name: body.name!.trim(),
            total_weight_g: totalWeight,
            total_kcal: totals.kcal,
            total_protein: totals.protein,
            total_carbs: totals.carbs,
            total_fat: totals.fat,
            ingredients: { create: ingredients },
          },
          include: { ingredients: { orderBy: { created_at: 'asc' } } },
        });
      });

      return res.status(201).send({ message: 'Receita criada com sucesso', recipe: formatRecipe(recipe) });
    } catch (error) {
      req.log.error(error);
      return res.status(500).send({ message: 'Erro ao criar receita' });
    }
  },

  getAllRecipes: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { user_id } = req.user;
      const recipes = await db.recipes.findMany({ where: { user_id }, orderBy: { name: 'asc' } });
      return res.status(200).send({ recipes: recipes.map((r) => formatRecipe(r, false)) });
    } catch (error) {
      req.log.error(error);
      return res.status(500).send({ message: 'Erro ao listar receitas' });
    }
  },

  getRecipe: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { recipe_id } = req.params as { recipe_id: string };
      const { user_id } = req.user;

      const recipe = await db.recipes.findFirst({
        where: { id: recipe_id, user_id },
        include: { ingredients: { orderBy: { created_at: 'asc' } } },
      });
      if (!recipe) return res.status(404).send({ message: 'Receita não encontrada' });

      return res.status(200).send({ recipe: formatRecipe(recipe) });
    } catch (error) {
      req.log.error(error);
      return res.status(500).send({ message: 'Erro ao buscar receita' });
    }
  },

  getPortion: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { recipe_id } = req.params as { recipe_id: string };
      const body = req.body as PortionBody;
      const { user_id } = req.user;

      if (typeof body.grams !== 'number' || !Number.isFinite(body.grams) || body.grams <= 0) {
        return res.status(400).send({ message: 'Gramas inválidas' });
      }
      if (body.type !== undefined && !MEAL_TYPES.includes(body.type)) {
        return res.status(400).send({ message: 'Tipo de refeição inválido' });
      }
      if (body.status !== undefined && !MEAL_STATUSES.includes(body.status)) {
        return res.status(400).send({ message: 'Status da refeição inválido' });
      }

      let date = todayDate();
      if (body.date !== undefined) {
        const parsed = parseDate(body.date);
        if (!parsed) return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        date = parsed;
      }

      const recipe = await db.recipes.findFirst({ where: { id: recipe_id, user_id } });
      if (!recipe) return res.status(404).send({ message: 'Receita não encontrada' });

      const weight = Number(recipe.total_weight_g);
      const portion = {
        recipe_id: recipe.id,
        name: recipe.name,
        grams: body.grams,
        kcal: portionOf(Number(recipe.total_kcal), weight, body.grams),
        protein: portionOf(Number(recipe.total_protein), weight, body.grams),
        carbs: portionOf(Number(recipe.total_carbs), weight, body.grams),
        fat: portionOf(Number(recipe.total_fat), weight, body.grams),
      };

      if (!body.log) {
        return res.status(200).send({ portion });
      }

      const itemData = {
        recipe_id: recipe.id,
        name: recipe.name,
        quantity: round2(body.grams),
        unit: 'g',
        kcal: portion.kcal,
        protein: portion.protein,
        carbs: portion.carbs,
        fat: portion.fat,
      };

      if (body.meal_id !== undefined) {
        const meal = await db.meals.findFirst({ where: { id: body.meal_id, user_id }, select: { id: true } });
        if (!meal) return res.status(404).send({ message: 'Refeição não encontrada' });

        await db.$transaction(async (tx) => {
          await tx.meal_items.create({ data: { ...itemData, meal_id: meal.id } });
        });
        return res.status(201).send({ message: 'Porção lançada na refeição', portion, meal_id: meal.id });
      }

      const meal = await db.$transaction(async (tx) => {
        return tx.meals.create({
          data: {
            user_id,
            date,
            type: (body.type as any) ?? 'OTHER',
            status: (body.status as any) ?? 'EATEN',
            items: { create: [itemData] },
          },
        });
      });
      return res.status(201).send({
        message: 'Porção lançada em nova refeição',
        portion,
        meal_id: meal.id,
        date: formatDate(meal.date),
      });
    } catch (error) {
      req.log.error(error);
      return res.status(500).send({ message: 'Erro ao calcular porção' });
    }
  },
};

export default RecipesController;
