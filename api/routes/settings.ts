import type { FastifyInstance } from 'fastify';
import SettingsController from '../controllers/settings/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function SettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/settings', { preHandler: authenticate }, SettingsController.getSettings);
  fastify.put('/update-settings', { preHandler: authenticate }, SettingsController.updateSettings);
}
