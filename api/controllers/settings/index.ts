import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';

const GOAL_FIELDS = ['kcal_goal', 'protein_goal', 'carbs_goal', 'fat_goal', 'water_goal_ml'] as const;
const INTEGER_FIELDS = ['kcal_goal', 'water_goal_ml'];

const LABELS: Record<string, string> = {
  kcal_goal: 'Meta de calorias',
  protein_goal: 'Meta de proteína',
  carbs_goal: 'Meta de carboidratos',
  fat_goal: 'Meta de gordura',
  water_goal_ml: 'Meta de água',
};

function formatSettings(settings: any) {
  return {
    kcal_goal: settings?.kcal_goal ?? null,
    protein_goal: settings?.protein_goal != null ? Number(settings.protein_goal) : null,
    carbs_goal: settings?.carbs_goal != null ? Number(settings.carbs_goal) : null,
    fat_goal: settings?.fat_goal != null ? Number(settings.fat_goal) : null,
    water_goal_ml: settings?.water_goal_ml ?? null,
  };
}

const SettingsController = {
  getSettings: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { user_id } = req.user;

      const settings = await db.user_settings.findUnique({ where: { user_id } });

      return res.status(200).send({ settings: formatSettings(settings) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao buscar configurações');
      return res.status(500).send({ message: 'Erro ao buscar configurações', error: error.message });
    }
  },

  updateSettings: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const body = req.body as Record<string, unknown>;
      const { user_id } = req.user;

      const data: Record<string, number | null> = {};

      for (const field of GOAL_FIELDS) {
        if (!(field in body)) continue;
        const value = body[field];

        if (value === null) {
          data[field] = null;
          continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          return res.status(400).send({ message: `${LABELS[field]} inválida` });
        }
        if (INTEGER_FIELDS.includes(field) && !Number.isInteger(value)) {
          return res.status(400).send({ message: `${LABELS[field]} inválida` });
        }
        data[field] = value;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).send({ message: 'Nenhuma meta informada' });
      }

      const settings = await db.$transaction(async (tx) => {
        return tx.user_settings.upsert({
          where: { user_id },
          update: data,
          create: { user_id, ...data },
        });
      });

      return res.status(200).send({ message: 'Configurações atualizadas com sucesso', settings: formatSettings(settings) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao atualizar configurações');
      return res.status(500).send({ message: 'Erro ao atualizar configurações', error: error.message });
    }
  },
};

export default SettingsController;
