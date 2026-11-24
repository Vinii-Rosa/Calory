import type { FastifyInstance } from 'fastify';
import WaterController from '../controllers/water/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function WaterRoutes(fastify: FastifyInstance) {
  fastify.post('/water-log/create', { preHandler: authenticate }, WaterController.createWaterLog);
  fastify.get('/water-logs', { preHandler: authenticate }, WaterController.getAllWaterLogs);
  fastify.delete('/delete-water-log/:water_log_id', { preHandler: authenticate }, WaterController.deleteWaterLog);
}
