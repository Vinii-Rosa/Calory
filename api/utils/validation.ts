export function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isInvalidOptional(value: unknown): boolean {
  return value !== undefined && !isNonNegative(value);
}
