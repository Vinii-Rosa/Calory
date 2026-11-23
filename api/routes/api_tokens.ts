import type { FastifyInstance } from 'fastify';
import ApiTokensController from '../controllers/api_tokens/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function ApiTokensRoutes(fastify: FastifyInstance) {
  fastify.post('/api-token/create', { preHandler: authenticate }, ApiTokensController.createApiToken);
  fastify.get('/api-tokens', { preHandler: authenticate }, ApiTokensController.getAllApiTokens);
  fastify.delete('/delete-api-token/:api_token_id', { preHandler: authenticate }, ApiTokensController.deleteApiToken);
}
