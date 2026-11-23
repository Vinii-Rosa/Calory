import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { hashPassword } from '../../utils/hash.js';

const UsersController = {
  createUser: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

      if (!name?.trim()) {
        return res.status(400).send({ message: 'Nome não informado' });
      }
      if (!email?.trim()) {
        return res.status(400).send({ message: 'Email não informado' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).send({ message: 'Email inválido' });
      }
      if (!password) {
        return res.status(400).send({ message: 'Senha não informada' });
      }
      if (password.length < 6) {
        return res.status(400).send({ message: 'Senha deve ter no mínimo 6 caracteres' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const emailEmUso = await db.users.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (emailEmUso) {
        return res.status(400).send({ message: 'Email já em uso' });
      }

      const hashed = await hashPassword(password);

      await db.users.create({ data: { name: name.trim(), email: normalizedEmail, password: hashed } });

      return res.status(201).send({ message: 'Usuário criado com sucesso' });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao criar usuário');
      return res.status(500).send({ message: 'Erro ao criar usuário', error: error.message });
    }
  },

  getUserById: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };

      if (user_id !== req.user.user_id) {
        return res.status(401).send({ message: 'Usuário sem permissão para acessar este usuário' });
      }

      const user = await db.users.findUnique({
        where: { id: user_id },
        select: { id: true, name: true, email: true, created_at: true },
      });

      if (!user) {
        return res.status(404).send({ message: 'Usuário não encontrado' });
      }

      return res.status(200).send({ user });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao buscar usuário');
      return res.status(500).send({ message: 'Erro ao buscar usuário', error: error.message });
    }
  },
};

export default UsersController;
