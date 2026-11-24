import { describe, expect, test } from '@jest/globals';
import { portionOf, sumItems } from '../../utils/nutrition.js';
import { addDays, weekStart, parseDate } from '../../utils/dates.js';

describe('Nutrição', () => {
  test('Porção proporcional da receita', () => {
    expect(portionOf(1500, 900, 30)).toBe(50);
  });

  test('Soma itens com decimais', () => {
    const total = sumItems([
      { kcal: '100.10', protein: 1.1, carbs: 2.2, fat: 0, fiber: null },
      { kcal: 50.25, protein: 2, carbs: 0, fat: 3.3, fiber: 1.5 },
    ]);
    expect(total).toEqual({ kcal: 150.35, protein: 3.1, carbs: 2.2, fat: 3.3, fiber: 1.5 });
  });

  test('Semana começa na segunda', () => {
    expect(weekStart(parseDate('2026-04-05')!).toISOString().slice(0, 10)).toBe('2026-03-30'); // domingo
    expect(weekStart(parseDate('2026-03-30')!).toISOString().slice(0, 10)).toBe('2026-03-30');
    expect(addDays(parseDate('2026-03-30')!, 7).toISOString().slice(0, 10)).toBe('2026-04-06');
  });
});
