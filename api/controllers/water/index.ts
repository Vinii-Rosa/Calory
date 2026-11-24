import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { formatDate, parseDate, todayDate } from '../../utils/dates.js';

function formatWaterLog(log: { id: string; date: Date; amount_ml: number; created_at: Date }) {
  return { id: log.id, date: formatDate(log.date), amount_ml: log.amount_ml, created_at: log.created_at };
}

const WaterController = {
  createWaterLog: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { amount_ml, date } = req.body as { amount_ml?: number; date?: string };
      const { user_id } = req.user;

      if (amount_ml === undefined || amount_ml === null) {
        return res.status(400).send({ message: 'Quantidade de água não informada' });
      }
      if (!Number.isInteger(amount_ml) || amount_ml <= 0) {
        return res.status(400).send({ message: 'Quantidade de água inválida' });
      }

      let logDate = todayDate();
      if (date !== undefined) {
        const parsed = parseDate(date);
        if (!parsed) {
          return res.status(400).send({ message: 'Data inválida. Use o formato AAAA-MM-DD' });
        }
        logDate = parsed;
      }

      const waterLog = await db.$transaction(async (tx) => {
        return tx.water_logs.create({ data: { user_id, date: logDate, amount_ml } });
      });

      return res.status(201).send({ message: 'Água registrada com sucesso', water_log: formatWaterLog(waterLog) });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao registrar água');
      return res.status(500).send({ message: 'Erro ao registrar água', error: error.message });
    }
  },

  getAllWaterLogs: async function (req: FastifyRequest, res: FastifyReply) {
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

      const logs = await db.water_logs.findMany({
        where,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      });

      const total_ml = logs.reduce((sum, log) => sum + log.amount_ml, 0);

      return res.status(200).send({ water_logs: logs.map(formatWaterLog), total_ml });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao listar registros de água');
      return res.status(500).send({ message: 'Erro ao listar registros de água', error: error.message });
    }
  },

  deleteWaterLog: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { water_log_id } = req.params as { water_log_id: string };
      const { user_id } = req.user;

      const waterLog = await db.water_logs.findFirst({
        where: { id: water_log_id, user_id },
        select: { id: true },
      });

      if (!waterLog) {
        return res.status(404).send({ message: 'Registro de água não encontrado' });
      }

      await db.$transaction(async (tx) => {
        await tx.water_logs.delete({ where: { id: waterLog.id } });
      });

      return res.status(200).send({ message: 'Registro de água removido com sucesso' });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao remover registro de água');
      return res.status(500).send({ message: 'Erro ao remover registro de água', error: error.message });
    }
  },
};

export default WaterController;
