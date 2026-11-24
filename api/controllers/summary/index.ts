import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { addDays, formatDate, parseDate, todayDate, weekStart } from '../../utils/dates.js';
import { addMacros, emptyMacros, round2, sumItems } from '../../utils/nutrition.js';

function remaining(goal: unknown, used: number): number | null {
  return goal != null ? round2(Number(goal) - used) : null;
}

function formatGoals(settings: any) {
  return {
    kcal_goal: settings?.kcal_goal ?? null,
    protein_goal: settings?.protein_goal != null ? Number(settings.protein_goal) : null,
    carbs_goal: settings?.carbs_goal != null ? Number(settings.carbs_goal) : null,
    fat_goal: settings?.fat_goal != null ? Number(settings.fat_goal) : null,
    water_goal_ml: settings?.water_goal_ml ?? null,
  };
}

// Dados de um intervalo de datas agrupados por dia (YYYY-MM-DD)
async function loadRange(user_id: string, start: Date, end: Date) {
  const range = { gte: start, lte: end };
  const [meals, water, workouts, settings] = await Promise.all([
    db.meals.findMany({ where: { user_id, date: range }, include: { items: true } }),
    db.water_logs.findMany({ where: { user_id, date: range } }),
    db.workouts.findMany({ where: { user_id, date: range } }),
    db.user_settings.findUnique({ where: { user_id } }),
  ]);

  const days = new Map<string, { eaten: any[]; planned: any[]; water_ml: number; kcal_burned: number }>();
  const day = (date: Date) => {
    const key = formatDate(date);
    if (!days.has(key)) days.set(key, { eaten: [], planned: [], water_ml: 0, kcal_burned: 0 });
    return days.get(key)!;
  };

  for (const meal of meals) day(meal.date)[meal.status === 'EATEN' ? 'eaten' : 'planned'].push(...meal.items);
  for (const log of water) day(log.date).water_ml += log.amount_ml;
  for (const workout of workouts) day(workout.date).kcal_burned += workout.kcal_burned != null ? Number(workout.kcal_burned) : 0;

  return { days, goals: formatGoals(settings) };
}

function buildDay(data?: { eaten: any[]; planned: any[]; water_ml: number; kcal_burned: number }) {
  return {
    consumed: sumItems(data?.eaten ?? []),
    planned: sumItems(data?.planned ?? []),
    water_ml: data?.water_ml ?? 0,
    kcal_burned: round2(data?.kcal_burned ?? 0),
  };
}

const SummaryController = {
  getDailySummary: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { date } = req.query as { date?: string };
      const { user_id } = req.user;

      let day = todayDate();
      if (date !== undefined) {
        const parsed = parseDate(date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        day = parsed;
      }

      const { days, goals } = await loadRange(user_id, day, day);
      const summary = buildDay(days.get(formatDate(day)));

      // Saldo: o que ainda resta da meta (calorias queimadas aumentam o saldo de calorias)
      const balance = {
        kcal: goals.kcal_goal != null ? round2(goals.kcal_goal - summary.consumed.kcal + summary.kcal_burned) : null,
        protein: remaining(goals.protein_goal, summary.consumed.protein),
        carbs: remaining(goals.carbs_goal, summary.consumed.carbs),
        fat: remaining(goals.fat_goal, summary.consumed.fat),
        water_ml: remaining(goals.water_goal_ml, summary.water_ml),
      };

      return res.status(200).send({ date: formatDate(day), ...summary, goals, balance });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao gerar resumo diário');
      return res.status(500).send({ message: 'Erro ao gerar resumo diário', error: error.message });
    }
  },

  getWeeklySummary: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { date } = req.query as { date?: string };
      const { user_id } = req.user;

      let reference = todayDate();
      if (date !== undefined) {
        const parsed = parseDate(date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        reference = parsed;
      }

      const start = weekStart(reference);
      const end = addDays(start, 6);
      const { days, goals } = await loadRange(user_id, start, end);

      const dailyList = [];
      let consumed = emptyMacros();
      let planned = emptyMacros();
      let water_ml = 0;
      let kcal_burned = 0;

      for (let i = 0; i < 7; i++) {
        const key = formatDate(addDays(start, i));
        const summary = buildDay(days.get(key));
        dailyList.push({ date: key, ...summary });
        consumed = addMacros(consumed, summary.consumed);
        planned = addMacros(planned, summary.planned);
        water_ml += summary.water_ml;
        kcal_burned += summary.kcal_burned;
      }

      const daysWithMeals = dailyList.filter((d) => d.consumed.kcal > 0).length;
      const average_consumed_kcal = daysWithMeals > 0 ? round2(consumed.kcal / daysWithMeals) : 0;

      return res.status(200).send({
        start_date: formatDate(start),
        end_date: formatDate(end),
        consumed,
        planned,
        water_ml,
        kcal_burned: round2(kcal_burned),
        average_consumed_kcal,
        goals,
        // Planejado x consumido na semana
        planned_vs_consumed: {
          kcal: round2(consumed.kcal - planned.kcal),
          protein: round2(consumed.protein - planned.protein),
          carbs: round2(consumed.carbs - planned.carbs),
          fat: round2(consumed.fat - planned.fat),
        },
        days: dailyList,
      });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao gerar resumo semanal');
      return res.status(500).send({ message: 'Erro ao gerar resumo semanal', error: error.message });
    }
  },
};

export default SummaryController;
