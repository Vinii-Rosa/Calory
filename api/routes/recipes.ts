import type { FastifyInstance } from 'fastify';
import RecipesController from '../controllers/recipes/index.js';
import { authenticate } from '../middleware/auth.js';

export default async function RecipesRoutes(fastify: FastifyInstance) {
  fastify.post('/recipe/create', { preHandler: authenticate }, RecipesController.createRecipe);
  fastify.get('/recipes', { preHandler: authenticate }, RecipesController.getAllRecipes);
  fastify.get('/recipe/:recipe_id', { preHandler: authenticate }, RecipesController.getRecipe);
  fastify.post('/portion/:recipe_id', { preHandler: authenticate }, RecipesController.getPortion);
}
