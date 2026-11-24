import { describe, expect, test } from '@jest/globals';
import WorkoutsController from '../../controllers/workouts/index.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;

describe('Treinos', () => {
  let workoutId = '';

  test('Cria treino completo', async () => {
    const body = await callAssertSuccess(
      WorkoutsController.createWorkout,
      { body: { name: ' Corrida ', date: '2026-04-01', duration_min: 40, kcal_burned: 420.5, note: 'Leve' } },
      201,
    );
    expect(body.workout).toMatchObject({ name: 'Corrida', date: '2026-04-01', duration_min: 40, kcal_burned: 420.5, note: 'Leve' });
    workoutId = body.workout.id;
  });

  test('Cria treino só com nome (data = hoje)', async () => {
    const body = await callAssertSuccess(WorkoutsController.createWorkout, { body: { name: 'Yoga' } }, 201);
    expect(body.workout.date).toBe(new Date().toISOString().slice(0, 10));
    expect(body.workout.kcal_burned).toBeNull();
  });

  test('Valida campos', async () => {
    await callAssertError(WorkoutsController.createWorkout, { body: {} }, 'Nome não informado');
    await callAssertError(WorkoutsController.createWorkout, { body: { name: 'x', duration_min: 0 } }, 'Duração inválida');
    await callAssertError(WorkoutsController.createWorkout, { body: { name: 'x', kcal_burned: -5 } }, 'Calorias queimadas inválidas');
    await callAssertError(WorkoutsController.createWorkout, { body: { name: 'x', date: 'ontem' } }, 'Data inválida. Use o formato AAAA-MM-DD');
  });

  test('Lista por data com total de calorias queimadas', async () => {
    await callAssertSuccess(WorkoutsController.createWorkout, { body: { name: 'Bike', date: '2026-04-01', kcal_burned: 200 } }, 201);
    const body = await callAssertSuccess(WorkoutsController.getAllWorkouts, { query: { date: '2026-04-01' } }, 200);
    expect(body.workouts).toHaveLength(2);
    expect(body.total_kcal_burned).toBe(620.5);
  });

  test('Atualiza treino parcialmente', async () => {
    const body = await callAssertSuccess(
      WorkoutsController.updateWorkout,
      { params: { workout_id: workoutId }, body: { kcal_burned: 450, note: null } },
      200,
    );
    expect(body.workout.kcal_burned).toBe(450);
    expect(body.workout.note).toBeNull();
    expect(body.workout.name).toBe('Corrida');
  });

  test('Atualização exige campo e valida valores', async () => {
    await callAssertError(WorkoutsController.updateWorkout, { params: { workout_id: workoutId }, body: {} }, 'Nenhum campo informado para atualização');
    await callAssertError(WorkoutsController.updateWorkout, { params: { workout_id: workoutId }, body: { name: ' ' } }, 'Nome não informado');
  });

  test('Não acessa treino de outro usuário', async () => {
    await callAssertError(
      WorkoutsController.updateWorkout,
      { params: { workout_id: workoutId }, body: { name: 'x' }, user: OTHER_USER },
      'Treino não encontrado',
    );
    await callAssertError(WorkoutsController.deleteWorkout, { params: { workout_id: workoutId }, user: OTHER_USER }, 'Treino não encontrado');
    const body = await callAssertSuccess(WorkoutsController.getAllWorkouts, { user: OTHER_USER }, 200);
    expect(body.workouts).toHaveLength(0);
  });

  test('Remove treino e depois retorna 404', async () => {
    await callAssertSuccess(WorkoutsController.deleteWorkout, { params: { workout_id: workoutId } }, 200);
    await callAssertError(WorkoutsController.deleteWorkout, { params: { workout_id: workoutId } }, 'Treino não encontrado');
  });
});
