import type { FastifyInstance } from 'fastify';
import MealsController from '../controllers/meals/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function MealsRoutes(fastify: FastifyInstance) {
  fastify.post('/meal/create', { preHandler: authenticate }, MealsController.createMeal);
  fastify.get('/meals', { preHandler: authenticate }, MealsController.getAllMeals);
  fastify.put('/update-meal/:meal_id', { preHandler: authenticate }, MealsController.updateMeal);
  fastify.delete('/delete-meal/:meal_id', { preHandler: authenticate }, MealsController.deleteMeal);
  fastify.post('/copy-week', { preHandler: authenticate }, MealsController.copyWeek);
}
