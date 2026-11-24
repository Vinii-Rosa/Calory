import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { formatDate, parseDate, todayDate } from '../../utils/dates.js';

type WorkoutBody = {
  name?: string;
  date?: string;
  duration_min?: number | null;
  kcal_burned?: number | null;
  note?: string | null;
};

function formatWorkout(workout: any) {
  return {
    id: workout.id,
    date: formatDate(workout.date),
    name: workout.name,
    duration_min: workout.duration_min,
    kcal_burned: workout.kcal_burned != null ? Number(workout.kcal_burned) : null,
    note: workout.note,
    created_at: workout.created_at,
  };
}

function validateOptionalFields(body: WorkoutBody): string | null {
  const { duration_min, kcal_burned, note } = body;

  if (duration_min !== undefined && duration_min !== null) {
    if (!Number.isInteger(duration_min) || duration_min <= 0) return 'Duração inválida';
  }
  if (kcal_burned !== undefined && kcal_burned !== null) {
    if (typeof kcal_burned !== 'number' || !Number.isFinite(kcal_burned) || kcal_burned < 0) return 'Calorias queimadas inválidas';
  }
  if (note !== undefined && note !== null && typeof note !== 'string') return 'Observação inválida';
  return null;
}

const WorkoutsController = {
  createWorkout: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const body = req.body as WorkoutBody;
      const { user_id } = req.user;

      if (typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).send({ message: 'Nome não informado' });
      }

      const invalid = validateOptionalFields(body);
      if (invalid) {
        return res.status(400).send({ message: invalid });
      }

      let date = todayDate();
      if (body.date !== undefined) {
        const parsed = parseDate(body.date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        date = parsed;
      }

      const workout = await db.$transaction(async (tx) => {
        return tx.workouts.create({
          data: {
            user_id,
            date,
            name: body.name!.trim(),
            duration_min: body.duration_min ?? null,
            kcal_burned: body.kcal_burned ?? null,
            note: body.note?.trim() || null,
          },
        });
      });

      return res.status(201).send({ message: 'Treino registrado com sucesso', workout: formatWorkout(workout) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao registrar treino');
      return res.status(500).send({ message: 'Erro ao registrar treino', error: error.message });
    }
  },

  getAllWorkouts: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { date, start_date, end_date } = req.query as { date?: string; start_date?: string; end_date?: string };
      const { user_id } = req.user;

      const where: Record<string, unknown> = { user_id };

      if (date !== undefined) {
        const parsed = parseDate(date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        where.date = parsed;
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

      const workouts = await db.workouts.findMany({
        where,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      });

      const total_kcal_burned = workouts.reduce((sum, w) => sum + (w.kcal_burned != null ? Number(w.kcal_burned) : 0), 0);

      return res.status(200).send({ workouts: workouts.map(formatWorkout), total_kcal_burned });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao listar treinos');
      return res.status(500).send({ message: 'Erro ao listar treinos', error: error.message });
    }
  },

  updateWorkout: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { workout_id } = req.params as { workout_id: string };
      const body = req.body as WorkoutBody;
      const { user_id } = req.user;

      const workout = await db.workouts.findFirst({ where: { id: workout_id, user_id }, select: { id: true } });

      if (!workout) {
        return res.status(404).send({ message: 'Treino não encontrado' });
      }

      const data: Record<string, unknown> = {};

      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return res.status(400).send({ message: 'Nome não informado' });
        }
        data.name = body.name.trim();
      }
      if (body.date !== undefined) {
        const parsed = parseDate(body.date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        data.date = parsed;
      }

      const invalid = validateOptionalFields(body);
      if (invalid) {
        return res.status(400).send({ message: invalid });
      }
      if (body.duration_min !== undefined) data.duration_min = body.duration_min;
      if (body.kcal_burned !== undefined) data.kcal_burned = body.kcal_burned;
      if (body.note !== undefined) data.note = body.note?.trim() || null;

      if (Object.keys(data).length === 0) {
        return res.status(400).send({ message: 'Nenhum campo informado para atualização' });
      }

      const updated = await db.$transaction(async (tx) => {
        return tx.workouts.update({ where: { id: workout.id }, data });
      });

      return res.status(200).send({ message: 'Treino atualizado com sucesso', workout: formatWorkout(updated) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao atualizar treino');
      return res.status(500).send({ message: 'Erro ao atualizar treino', error: error.message });
    }
  },

  deleteWorkout: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { workout_id } = req.params as { workout_id: string };
      const { user_id } = req.user;

      const workout = await db.workouts.findFirst({ where: { id: workout_id, user_id }, select: { id: true } });

      if (!workout) {
        return res.status(404).send({ message: 'Treino não encontrado' });
      }

      await db.$transaction(async (tx) => {
        await tx.workouts.delete({ where: { id: workout.id } });
      });

      return res.status(200).send({ message: 'Treino removido com sucesso' });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao remover treino');
      return res.status(500).send({ message: 'Erro ao remover treino', error: error.message });
    }
  },
};

export default WorkoutsController;
