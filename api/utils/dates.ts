const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayDate(): Date {
  return parseDate(new Date().toISOString().slice(0, 10)) as Date;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// Segunda-feira da semana (seg–dom) que contém a data
export function weekStart(date: Date): Date {
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}
