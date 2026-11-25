import type { FastifyError, FastifyInstance } from 'fastify';
import McpController from '../controllers/mcp/index.js';
import { authenticateMcp } from '../middleware/auth_mcp.js';

const headers = {
  type: 'object',
  properties: { authorization: { type: 'string', pattern: '^Bearer .+$' } },
  required: ['authorization'],
};

export default async function McpRoutes(fastify: FastifyInstance) {
  // Header ausente ou fora do formato Bearer falha no schema; responde 401 em vez do 400 padrão
  fastify.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error.validation) {
      return reply.status(401).send({ message: 'Token MCP ausente ou inválido' });
    }
    return reply.send(error);
  });

  fastify.post('/', { schema: { headers }, preHandler: authenticateMcp }, McpController.handle);
}
