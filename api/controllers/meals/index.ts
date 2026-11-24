import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { addDays, formatDate, parseDate, todayDate, weekStart } from '../../utils/dates.js';
import { sumItems } from '../../utils/nutrition.js';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'];
const MEAL_STATUSES = ['PLANNED', 'EATEN'];

type ItemBody = {
  name?: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number | null;
  recipe_id?: string | null;
};

type MealBody = {
  date?: string;
  type?: string;
  status?: string;
  note?: string | null;
  items?: ItemBody[];
};

function formatItem(item: any) {
  return {
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    kcal: Number(item.kcal),
    protein: Number(item.protein),
    carbs: Number(item.carbs),
    fat: Number(item.fat),
    fiber: item.fiber != null ? Number(item.fiber) : null,
    recipe_id: item.recipe_id,
  };
}

function formatMeal(meal: any) {
  return {
    id: meal.id,
    date: formatDate(meal.date),
    type: meal.type,
    status: meal.status,
    note: meal.note,
    items: meal.items.map(formatItem),
    totals: sumItems(meal.items),
    created_at: meal.created_at,
  };
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isInvalidOptional(value: unknown): boolean {
  return value !== undefined && !isNonNegative(value);
}

function validateItem(raw: ItemBody): string | null {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return 'Nome do item não informado';
  if (typeof raw.quantity !== 'number' || !Number.isFinite(raw.quantity) || raw.quantity <= 0) return 'Quantidade do item inválida';
  if (!isNonNegative(raw.kcal)) return 'Calorias do item inválidas';
  if ([raw.protein, raw.carbs, raw.fat].some(isInvalidOptional)) return 'Macronutrientes do item inválidos';
  if (raw.fiber !== null && isInvalidOptional(raw.fiber)) return 'Fibras do item inválidas';
  if (raw.unit !== undefined && (typeof raw.unit !== 'string' || !raw.unit.trim())) return 'Unidade do item inválida';
  return null;
}

async function parseItems(items: unknown, user_id: string): Promise<{ error: string } | { data: any[] }> {
  if (!Array.isArray(items)) return { error: 'Itens inválidos' };

  const data: any[] = [];
  for (const raw of items as ItemBody[]) {
    const invalid = validateItem(raw);
    if (invalid) return { error: invalid };

    if (raw.recipe_id) {
      const recipe = await db.recipes.findFirst({ where: { id: raw.recipe_id, user_id }, select: { id: true } });
      if (!recipe) return { error: 'Receita não encontrada' };
    }

    data.push({
      name: raw.name!.trim(),
      quantity: raw.quantity!,
      unit: raw.unit?.trim() || 'g',
      kcal: raw.kcal!,
      protein: raw.protein ?? 0,
      carbs: raw.carbs ?? 0,
      fat: raw.fat ?? 0,
      fiber: raw.fiber ?? null,
      recipe_id: raw.recipe_id || null,
    });
  }
  return { data };
}

const MealsController = {
  createMeal: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const body = req.body as MealBody;
      const { user_id } = req.user;

      if (body.type !== undefined && !MEAL_TYPES.includes(body.type)) {
        return res.status(400).send({ message: 'Tipo de refeição inválido' });
      }
      if (body.status !== undefined && !MEAL_STATUSES.includes(body.status)) {
        return res.status(400).send({ message: 'Status da refeição inválido' });
      }
      if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
        return res.status(400).send({ message: 'Observação inválida' });
      }

      let date = todayDate();
      if (body.date !== undefined) {
        const parsed = parseDate(body.date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        date = parsed;
      }

      if (body.items === undefined || (Array.isArray(body.items) && body.items.length === 0)) {
        return res.status(400).send({ message: 'Itens não informados' });
      }
      const parsedItems = await parseItems(body.items, user_id);
      if ('error' in parsedItems) {
        return res.status(400).send({ message: parsedItems.error });
      }

      const meal = await db.$transaction(async (tx) => {
        return tx.meals.create({
          data: {
            user_id,
            date,
            type: (body.type as any) ?? 'OTHER',
            status: (body.status as any) ?? 'PLANNED',
            note: body.note?.trim() || null,
            items: { create: parsedItems.data },
          },
          include: { items: { orderBy: { created_at: 'asc' } } },
        });
      });

      return res.status(201).send({ message: 'Refeição registrada com sucesso', meal: formatMeal(meal) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao registrar refeição');
      return res.status(500).send({ message: 'Erro ao registrar refeição', error: error.message });
    }
  },

  getAllMeals: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { date, week, start_date, end_date, status, type } = req.query as Record<string, string | undefined>;
      const { user_id } = req.user;

      const where: Record<string, unknown> = { user_id };

      if (status !== undefined) {
        if (!MEAL_STATUSES.includes(status)) return res.status(400).send({ message: 'Status da refeição inválido' });
        where.status = status;
      }
      if (type !== undefined) {
        if (!MEAL_TYPES.includes(type)) return res.status(400).send({ message: 'Tipo de refeição inválido' });
        where.type = type;
      }

      if (date !== undefined) {
        const parsed = parseDate(date);
        if (!parsed) return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        where.date = parsed;
      } else if (week !== undefined) {
        const parsed = parseDate(week);
        if (!parsed) return res.status(400).send({ message: 'Data da semana inválida. Use o formato AAAA-MM-DD' });
        const start = weekStart(parsed);
        where.date = { gte: start, lte: addDays(start, 6) };
      } else if (start_date !== undefined || end_date !== undefined) {
        const range: Record<string, Date> = {};
        if (start_date !== undefined) {
          const parsed = parseDate(start_date);
          if (!parsed) return res.status(400).send({ message: 'Data inicial inválida. Use o formato AAAA-MM-DD' });
          range.gte = parsed;
        }
        if (end_date !== undefined) {
          const parsed = parseDate(end_date);
          if (!parsed) return res.status(400).send({ message: 'Data final inválida. Use o formato AAAA-MM-DD' });
          range.lte = parsed;
        }
        where.date = range;
      }

      const meals = await db.meals.findMany({
        where,
        include: { items: { orderBy: { created_at: 'asc' } } },
        orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      });

      const allItems = meals.flatMap((meal) => meal.items);
      const totals = sumItems(allItems);
      const formattedMeals = meals.map(formatMeal);

      return res.status(200).send({ meals: formattedMeals, totals });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao listar refeições');
      return res.status(500).send({ message: 'Erro ao listar refeições', error: error.message });
    }
  },

  updateMeal: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { meal_id } = req.params as { meal_id: string };
      const body = req.body as MealBody;
      const { user_id } = req.user;

      const meal = await db.meals.findFirst({ where: { id: meal_id, user_id }, select: { id: true } });

      if (!meal) {
        return res.status(404).send({ message: 'Refeição não encontrada' });
      }

      const data: Record<string, unknown> = {};

      if (body.date !== undefined) {
        const parsed = parseDate(body.date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        data.date = parsed;
      }
      if (body.type !== undefined) {
        if (!MEAL_TYPES.includes(body.type)) return res.status(400).send({ message: 'Tipo de refeição inválido' });
        data.type = body.type;
      }
      if (body.status !== undefined) {
        if (!MEAL_STATUSES.includes(body.status)) return res.status(400).send({ message: 'Status da refeição inválido' });
        data.status = body.status;
      }
      if (body.note !== undefined) {
        if (body.note !== null && typeof body.note !== 'string') return res.status(400).send({ message: 'Observação inválida' });
        data.note = body.note?.trim() || null;
      }

      let newItems: any[] | null = null;
      if (body.items !== undefined) {
        if (Array.isArray(body.items) && body.items.length === 0) {
          return res.status(400).send({ message: 'Itens não informados' });
        }
        const parsedItems = await parseItems(body.items, user_id);
        if ('error' in parsedItems) {
          return res.status(400).send({ message: parsedItems.error });
        }
        newItems = parsedItems.data;
      }

      if (Object.keys(data).length === 0 && !newItems) {
        return res.status(400).send({ message: 'Nenhum campo informado para atualização' });
      }

      const updated = await db.$transaction(async (tx) => {
        if (newItems) {
          await tx.meal_items.deleteMany({ where: { meal_id: meal.id } });
          data.items = { create: newItems };
        }
        return tx.meals.update({
          where: { id: meal.id },
          data,
          include: { items: { orderBy: { created_at: 'asc' } } },
        });
      });

      return res.status(200).send({ message: 'Refeição atualizada com sucesso', meal: formatMeal(updated) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao atualizar refeição');
      return res.status(500).send({ message: 'Erro ao atualizar refeição', error: error.message });
    }
  },

  deleteMeal: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { meal_id } = req.params as { meal_id: string };
      const { user_id } = req.user;

      const meal = await db.meals.findFirst({ where: { id: meal_id, user_id }, select: { id: true } });

      if (!meal) {
        return res.status(404).send({ message: 'Refeição não encontrada' });
      }

      await db.$transaction(async (tx) => {
        await tx.meals.delete({ where: { id: meal.id } });
      });

      return res.status(200).send({ message: 'Refeição removida com sucesso' });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao remover refeição');
      return res.status(500).send({ message: 'Erro ao remover refeição', error: error.message });
    }
  },

  // Replica as refeições de uma semana (seg–dom) em outra, mantendo o dia da semana
  copyWeek: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const body = req.body as { source_date?: string; target_date?: string; status?: string };
      const { user_id } = req.user;

      const source = parseDate(body.source_date);
      if (!source) {
        return res.status(400).send({ message: 'Data da semana de origem inválida. Use o formato AAAA-MM-DD' });
      }
      const target = parseDate(body.target_date);
      if (!target) {
        return res.status(400).send({ message: 'Data da semana de destino inválida. Use o formato AAAA-MM-DD' });
      }
      if (body.status !== undefined && !MEAL_STATUSES.includes(body.status)) {
        return res.status(400).send({ message: 'Status da refeição inválido' });
      }

      const sourceStart = weekStart(source);
      const targetStart = weekStart(target);
      if (sourceStart.getTime() === targetStart.getTime()) {
        return res.status(400).send({ message: 'A semana de destino deve ser diferente da origem' });
      }
      const offsetDays = Math.round((targetStart.getTime() - sourceStart.getTime()) / 86400000);

      const sourceMeals = await db.meals.findMany({
        where: {
          user_id,
          status: (body.status as any) ?? 'PLANNED',
          date: { gte: sourceStart, lte: addDays(sourceStart, 6) },
        },
        include: { items: true },
      });

      if (sourceMeals.length === 0) {
        return res.status(404).send({ message: 'Nenhuma refeição encontrada na semana de origem' });
      }

      const created = await db.$transaction(async (tx) => {
        const result = [];
        for (const meal of sourceMeals) {
          result.push(
            await tx.meals.create({
              data: {
                user_id,
                date: addDays(meal.date, offsetDays),
                type: meal.type,
                status: 'PLANNED',
                note: meal.note,
                items: {
                  create: meal.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    kcal: item.kcal,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                    fiber: item.fiber,
                    recipe_id: item.recipe_id,
                  })),
                },
              },
              include: { items: { orderBy: { created_at: 'asc' } } },
            }),
          );
        }
        return result;
      });

      return res.status(201).send({
        message: 'Semana copiada com sucesso',
        week_start: formatDate(targetStart),
        meals: created.map(formatMeal),
      });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao copiar semana');
      return res.status(500).send({ message: 'Erro ao copiar semana', error: error.message });
    }
  },
};

export default MealsController;
