import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { generateApiToken, hashApiToken } from '../../utils/hash.js';

const ApiTokensController = {
  createApiToken: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { name } = req.body as { name?: string };
      const { user_id } = req.user;

      if (!name?.trim()) {
        return res.status(400).send({ message: 'Nome não informado' });
      }

      const token = generateApiToken();

      const apiToken = await db.api_tokens.create({
        data: { user_id, name: name.trim(), token_hash: hashApiToken(token) },
        select: { id: true, name: true, created_at: true },
      });

      return res.status(201).send({
        message: 'Token criado com sucesso. Guarde-o agora, ele não será exibido novamente',
        api_token: { ...apiToken, token },
      });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao criar token');
      return res.status(500).send({ message: 'Erro ao criar token', error: error.message });
    }
  },

  getAllApiTokens: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { user_id } = req.user;

      const api_tokens = await db.api_tokens.findMany({
        where: { user_id, revoked_at: null },
        select: { id: true, name: true, last_used_at: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });

      return res.status(200).send({ api_tokens });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao listar tokens');
      return res.status(500).send({ message: 'Erro ao listar tokens', error: error.message });
    }
  },

  deleteApiToken: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { api_token_id } = req.params as { api_token_id: string };
      const { user_id } = req.user;

      const apiToken = await db.api_tokens.findFirst({
        where: { id: api_token_id, user_id, revoked_at: null },
        select: { id: true },
      });

      if (!apiToken) {
        return res.status(404).send({ message: 'Token não encontrado' });
      }

      await db.api_tokens.update({ where: { id: apiToken.id }, data: { revoked_at: new Date() } });

      return res.status(200).send({ message: 'Token revogado com sucesso' });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao revogar token');
      return res.status(500).send({ message: 'Erro ao revogar token', error: error.message });
    }
  },
};

export default ApiTokensController;
