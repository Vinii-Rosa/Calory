import { describe, expect, test } from '@jest/globals';
import SettingsController from '../../controllers/settings/index.js';
import { callAssertError, callAssertSuccess } from '../../utils/test_helpers.js';

const OTHER_USER = { user_id: '00000000-0000-4000-8000-0000000000ff', email: 'outro@calory.com', type: 'access' } as const;

describe('Configurações (metas)', () => {
  test('Retorna metas nulas quando ainda não configuradas', async () => {
    const body = await callAssertSuccess(SettingsController.getSettings, {}, 200);
    expect(body.settings).toEqual({ kcal_goal: null, protein_goal: null, carbs_goal: null, fat_goal: null, water_goal_ml: null });
  });

  test('Cria metas na primeira atualização', async () => {
    const body = await callAssertSuccess(
      SettingsController.updateSettings,
      { body: { kcal_goal: 2000, protein_goal: 150.5, carbs_goal: 200, fat_goal: 60, water_goal_ml: 2500 } },
      200,
    );
    expect(body.settings).toEqual({ kcal_goal: 2000, protein_goal: 150.5, carbs_goal: 200, fat_goal: 60, water_goal_ml: 2500 });
  });

  test('Atualização parcial mantém as demais metas e aceita null para limpar', async () => {
    const body = await callAssertSuccess(SettingsController.updateSettings, { body: { kcal_goal: 1800, fat_goal: null } }, 200);
    expect(body.settings.kcal_goal).toBe(1800);
    expect(body.settings.fat_goal).toBeNull();
    expect(body.settings.protein_goal).toBe(150.5);
  });

  test('Rejeita valores inválidos', async () => {
    await callAssertError(SettingsController.updateSettings, { body: { kcal_goal: -1 } }, 'Meta de calorias inválida');
    await callAssertError(SettingsController.updateSettings, { body: { kcal_goal: 10.5 } }, 'Meta de calorias inválida');
    await callAssertError(SettingsController.updateSettings, { body: { protein_goal: 'abc' } }, 'Meta de proteína inválida');
  });

  test('Exige ao menos uma meta', async () => {
    await callAssertError(SettingsController.updateSettings, { body: {} }, 'Nenhuma meta informada');
  });

  test('Ignora user_id enviado no body e isola por usuário', async () => {
    const other = OTHER_USER;
    const body = await callAssertSuccess(SettingsController.getSettings, { user: other }, 200);
    expect(body.settings.kcal_goal).toBeNull();
  });
});
