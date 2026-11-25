import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import MealsController from '../meals/index.js';
import WaterController from '../water/index.js';
import WorkoutsController from '../workouts/index.js';
import RecipesController from '../recipes/index.js';
import SummaryController from '../summary/index.js';
import SettingsController from '../settings/index.js';

export type ToolContext = { user_id: string; log: FastifyBaseLogger };
export type ToolResult = { status: number; body: any };

export type McpTool = {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  run: (args: any, ctx: ToolContext) => Promise<ToolResult>;
};

type Handler = (req: any, res: any) => Promise<unknown>;

// Roda um controller existente sem HTTP: mesma validação e mesmas regras da API REST
async function runController(
  handler: Handler,
  ctx: ToolContext,
  input: { body?: unknown; params?: Record<string, string>; query?: Record<string, string | undefined> },
): Promise<ToolResult> {
  let status = 200;
  let body: any;

  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    send(payload: unknown) {
      body = payload;
      return res;
    },
  };

  // JSON.parse(JSON.stringify) remove chaves undefined, que os controllers tratam como "não informado"
  const req = {
    body: JSON.parse(JSON.stringify(input.body ?? {})),
    params: input.params ?? {},
    query: input.query ?? {},
    user: { user_id: ctx.user_id, email: '', type: 'access' },
    log: ctx.log,
  };

  await handler(req, res);
  return { status, body };
}

const MEAL_TYPE = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER']);
const MEAL_STATUS = z.enum(['PLANNED', 'EATEN']);

const mealItem = z.object({
  name: z.string().describe('Nome do alimento'),
  quantity: z.number().describe('Quantidade consumida (na unidade informada)'),
  unit: z.string().optional().describe('Unidade: g ou ml (padrão g)'),
  kcal: z.number().describe('Calorias totais desse item'),
  protein: z.number().optional().describe('Proteína em g'),
  carbs: z.number().optional().describe('Carboidratos em g'),
  fat: z.number().optional().describe('Gordura em g'),
  fiber: z.number().nullable().optional().describe('Fibras em g'),
  recipe_id: z.string().nullable().optional().describe('ID de receita, se o item vier de uma receita'),
});

const ingredient = z.object({
  name: z.string().describe('Nome do ingrediente'),
  quantity: z.number().describe('Quantidade usada'),
  unit: z.string().optional().describe('Unidade: g ou ml (padrão g)'),
  kcal: z.number().describe('Calorias totais desse ingrediente'),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
});

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'log_meal_items',
    description:
      'Registra uma refeição com os itens consumidos. Estime kcal e macros de cada item antes de chamar. ' +
      'Use status EATEN para o que foi comido (padrão) e PLANNED para planejamento.',
    inputSchema: {
      date: z.string().optional().describe('Dia no formato AAAA-MM-DD (padrão hoje)'),
      type: MEAL_TYPE.optional().describe('Tipo da refeição (padrão OTHER)'),
      status: MEAL_STATUS.default('EATEN'),
      note: z.string().nullable().optional(),
      items: z.array(mealItem).describe('Itens da refeição'),
    },
    run: (args, ctx) => runController(MealsController.createMeal, ctx, { body: args }),
  },
  {
    name: 'log_water',
    description: 'Registra ingestão de água em mililitros.',
    inputSchema: {
      amount_ml: z.number().int().describe('Quantidade em ml'),
      date: z.string().optional().describe('Dia no formato AAAA-MM-DD (padrão hoje)'),
    },
    run: (args, ctx) => runController(WaterController.createWaterLog, ctx, { body: args }),
  },
  {
    name: 'log_workout',
    description: 'Registra um treino. kcal_burned é estimada pelo LLM/usuário.',
    inputSchema: {
      name: z.string().describe('Nome do treino'),
      date: z.string().optional().describe('Dia no formato AAAA-MM-DD (padrão hoje)'),
      duration_min: z.number().int().nullable().optional(),
      kcal_burned: z.number().nullable().optional(),
      note: z.string().nullable().optional(),
    },
    run: (args, ctx) => runController(WorkoutsController.createWorkout, ctx, { body: args }),
  },
  {
    name: 'create_recipe',
    description:
      'Cria uma receita com ingredientes. Os totais de kcal e macros são calculados pela API. ' +
      'Sem total_weight_g, a soma das quantidades é usada (só se todas forem g/ml).',
    inputSchema: {
      name: z.string().describe('Nome da receita'),
      total_weight_g: z.number().optional().describe('Peso final da receita em g'),
      ingredients: z.array(ingredient).describe('Ingredientes da receita'),
    },
    run: (args, ctx) => runController(RecipesController.createRecipe, ctx, { body: args }),
  },
  {
    name: 'log_recipe_portion',
    description: 'Calcula a porção de uma receita em gramas e lança como item de refeição (status EATEN por padrão).',
    inputSchema: {
      recipe_id: z.string().describe('ID da receita'),
      grams: z.number().describe('Gramas consumidas'),
      meal_id: z.string().optional().describe('Se informado, adiciona à refeição existente'),
      date: z.string().optional().describe('Dia no formato AAAA-MM-DD (padrão hoje), para nova refeição'),
      type: MEAL_TYPE.optional(),
      status: MEAL_STATUS.default('EATEN'),
    },
    run: ({ recipe_id, ...args }, ctx) =>
      runController(RecipesController.getPortion, ctx, { params: { recipe_id }, body: { ...args, log: true } }),
  },
  {
    name: 'get_daily_summary',
    description: 'Resumo do dia: consumido, planejado, água, calorias queimadas, metas e saldo.',
    inputSchema: {
      date: z.string().optional().describe('Dia no formato AAAA-MM-DD (padrão hoje)'),
    },
    run: (args, ctx) => runController(SummaryController.getDailySummary, ctx, { query: args }),
  },
  {
    name: 'get_goals',
    description: 'Retorna as metas do usuário: calorias, proteína, carboidratos, gordura e água.',
    inputSchema: {},
    run: (_args, ctx) => runController(SettingsController.getSettings, ctx, {}),
  },
  {
    name: 'set_goals',
    description: 'Atualiza metas do usuário. Campos omitidos não mudam; null remove a meta.',
    inputSchema: {
      kcal_goal: z.number().nullable().optional(),
      protein_goal: z.number().nullable().optional(),
      carbs_goal: z.number().nullable().optional(),
      fat_goal: z.number().nullable().optional(),
      water_goal_ml: z.number().nullable().optional(),
    },
    run: (args, ctx) => runController(SettingsController.updateSettings, ctx, { body: args }),
  },
];
