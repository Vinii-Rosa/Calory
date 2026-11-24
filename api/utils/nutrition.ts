export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function emptyMacros(): Macros {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

export function sumItems(items: Array<{ kcal: unknown; protein: unknown; carbs: unknown; fat: unknown; fiber?: unknown }>): Macros {
  const total = emptyMacros();
  for (const item of items) {
    total.kcal += Number(item.kcal);
    total.protein += Number(item.protein);
    total.carbs += Number(item.carbs);
    total.fat += Number(item.fat);
    total.fiber += item.fiber != null ? Number(item.fiber) : 0;
  }
  return roundMacros(total);
}

export function addMacros(a: Macros, b: Macros): Macros {
  return roundMacros({
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  });
}

function roundMacros(m: Macros): Macros {
  return { kcal: round2(m.kcal), protein: round2(m.protein), carbs: round2(m.carbs), fat: round2(m.fat), fiber: round2(m.fiber) };
}

// Proporção de uma receita: ex. bolo 1500 kcal / 900 g -> 30 g = 50 kcal
export function portionOf(total: number, totalWeightG: number, grams: number): number {
  return round2((total * grams) / totalWeightG);
}
