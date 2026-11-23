import type { FastifyInstance } from 'fastify';
import UsersController from '../controllers/users/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function UsersRoutes(fastify: FastifyInstance) {
  fastify.post('/user/create', UsersController.createUser);
  fastify.get('/user/:user_id', { preHandler: authenticate }, UsersController.getUserById);
}
