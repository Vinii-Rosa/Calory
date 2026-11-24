import { describe, expect, test } from '@jest/globals';
import WaterController from '../../controllers/water/index.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;

describe('Água', () => {
  let logId = '';

  test('Registra água em uma data', async () => {
    const body = await callAssertSuccess(WaterController.createWaterLog, { body: { amount_ml: 300, date: '2026-03-10' } }, 201);
    expect(body.water_log.date).toBe('2026-03-10');
    expect(body.water_log.amount_ml).toBe(300);
    logId = body.water_log.id;
  });

  test('Usa a data de hoje quando omitida', async () => {
    const body = await callAssertSuccess(WaterController.createWaterLog, { body: { amount_ml: 200 } }, 201);
    expect(body.water_log.date).toBe(new Date().toISOString().slice(0, 10));
  });

  test('Valida quantidade e data', async () => {
    await callAssertError(WaterController.createWaterLog, { body: {} }, 'Quantidade de água não informada');
    await callAssertError(WaterController.createWaterLog, { body: { amount_ml: 0 } }, 'Quantidade de água inválida');
    await callAssertError(WaterController.createWaterLog, { body: { amount_ml: 1.5 } }, 'Quantidade de água inválida');
    await callAssertError(WaterController.createWaterLog, { body: { amount_ml: 100, date: '10/03/2026' } }, 'Data inválida. Use o formato AAAA-MM-DD');
    await callAssertError(WaterController.createWaterLog, { body: { amount_ml: 100, date: '2026-02-30' } }, 'Data inválida. Use o formato AAAA-MM-DD');
  });

  test('Lista por data com total', async () => {
    await callAssertSuccess(WaterController.createWaterLog, { body: { amount_ml: 500, date: '2026-03-10' } }, 201);
    const body = await callAssertSuccess(WaterController.getAllWaterLogs, { query: { date: '2026-03-10' } }, 200);
    expect(body.water_logs).toHaveLength(2);
    expect(body.total_ml).toBe(800);
  });

  test('Lista por intervalo', async () => {
    await callAssertSuccess(WaterController.createWaterLog, { body: { amount_ml: 250, date: '2026-03-12' } }, 201);
    const body = await callAssertSuccess(
      WaterController.getAllWaterLogs,
      { query: { start_date: '2026-03-11', end_date: '2026-03-13' } },
      200,
    );
    expect(body.total_ml).toBe(250);
  });

  test('Rejeita filtro de data inválido', async () => {
    await callAssertError(WaterController.getAllWaterLogs, { query: { date: 'x' } }, 'Data inválida. Use o formato AAAA-MM-DD');
  });

  test('Não lista nem remove registro de outro usuário', async () => {
    const body = await callAssertSuccess(WaterController.getAllWaterLogs, { user: OTHER_USER, query: { date: '2026-03-10' } }, 200);
    expect(body.water_logs).toHaveLength(0);
    await callAssertError(
      WaterController.deleteWaterLog,
      { params: { water_log_id: logId }, user: OTHER_USER },
      'Registro de água não encontrado',
    );
  });

  test('Remove registro e depois retorna 404', async () => {
    await callAssertSuccess(WaterController.deleteWaterLog, { params: { water_log_id: logId } }, 200);
    await callAssertError(WaterController.deleteWaterLog, { params: { water_log_id: logId } }, 'Registro de água não encontrado');
  });
});
