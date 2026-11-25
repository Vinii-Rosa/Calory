import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../db.js';
import { hashApiToken } from '../utils/hash.js';

declare module 'fastify' {
  interface FastifyRequest {
    mcp_user_id: string;
  }
}

// Autentica o cliente MCP pelo token pessoal: Authorization: Bearer <token>
export async function authenticateMcp(request: FastifyRequest, reply: FastifyReply) {
  const { authorization = '' } = request.headers;
  // O formato "Bearer <token>" já é garantido pelo schema da rota
  const token = authorization.slice(7).trim();

  if (!token) {
    return reply.status(401).send({ message: 'Token MCP ausente' });
  }

  const apiToken = await db.api_tokens.findFirst({
    where: { token_hash: hashApiToken(token), revoked_at: null },
    select: { id: true, user_id: true },
  });

  if (!apiToken) {
    return reply.status(401).send({ message: 'Token MCP inválido' });
  }

  await db.api_tokens.update({ where: { id: apiToken.id }, data: { last_used_at: new Date() } });
  request.mcp_user_id = apiToken.user_id;
}
