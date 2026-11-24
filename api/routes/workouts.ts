import type { FastifyInstance } from 'fastify';
import WorkoutsController from '../controllers/workouts/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function WorkoutsRoutes(fastify: FastifyInstance) {
  fastify.post('/workout/create', { preHandler: authenticate }, WorkoutsController.createWorkout);
  fastify.get('/workouts', { preHandler: authenticate }, WorkoutsController.getAllWorkouts);
  fastify.put('/update-workout/:workout_id', { preHandler: authenticate }, WorkoutsController.updateWorkout);
  fastify.delete('/delete-workout/:workout_id', { preHandler: authenticate }, WorkoutsController.deleteWorkout);
}
