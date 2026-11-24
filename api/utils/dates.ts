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
