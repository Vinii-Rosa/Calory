import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../db.js';
import { comparePassword } from '../../utils/hash.js';
import { clearRefreshCookie, setRefreshCookie, signAccessToken, signRefreshToken } from '../../utils/auth_tokens.js';

const LoginController = {
  login: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email) {
        return res.status(400).send({ message: 'Email não informado' });
      }
      if (!password) {
        return res.status(400).send({ message: 'Senha não informada' });
      }

      const user = await db.users.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, name: true, email: true, password: true },
      });

      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).send({ message: 'Email ou senha inválidos' });
      }

      const payload = { user_id: user.id, email: user.email };
      const token = await signAccessToken(res as any, payload);
      const refreshToken = await signRefreshToken(res as any, payload);
      setRefreshCookie(res, refreshToken);

      return res.status(200).send({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao realizar login');
      return res.status(500).send({ message: 'Erro ao realizar login', error: error.message });
    }
  },

  refresh: async function (req: FastifyRequest, res: FastifyReply) {
    try {
      let payload: any;
      try {
        payload = await req.jwtVerify({ onlyCookie: true });
      } catch {
        return res.status(401).send({ message: 'Refresh token inválido ou ausente' });
      }

      if (payload?.type !== 'refresh') {
        return res.status(401).send({ message: 'Refresh token inválido ou ausente' });
      }

      const user = await db.users.findUnique({
        where: { id: payload.user_id },
        select: { id: true, email: true },
      });

      if (!user) {
        return res.status(401).send({ message: 'Usuário não encontrado' });
      }

      const tokenUser = { user_id: user.id, email: user.email };
      const token = await signAccessToken(res as any, tokenUser);
      const refreshToken = await signRefreshToken(res as any, tokenUser);
      setRefreshCookie(res, refreshToken);

      return res.status(200).send({ token });
    } catch (error: any) {
      req.log.error({ err: error }, 'Erro ao renovar token');
      return res.status(500).send({ message: 'Erro ao renovar token', error: error.message });
    }
  },

  logout: async function (_req: FastifyRequest, res: FastifyReply) {
    clearRefreshCookie(res);
    return res.status(200).send({ message: 'Logout realizado com sucesso' });
  },
};

export default LoginController;
