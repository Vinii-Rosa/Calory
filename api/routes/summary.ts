import type { FastifyInstance } from 'fastify';
import SummaryController from '../controllers/summary/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function SummaryRoutes(fastify: FastifyInstance) {
  fastify.get('/daily', { preHandler: authenticate }, SummaryController.getDailySummary);
  fastify.get('/weekly', { preHandler: authenticate }, SummaryController.getWeeklySummary);
}
