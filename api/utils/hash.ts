import { createHash, randomBytes } from 'node:crypto';
import { hash, compare } from 'bcrypt';

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function comparePassword(password: string, hashValue: string) {
  return compare(password, hashValue);
}

export function generateApiToken() {
  return `cal_${randomBytes(32).toString('hex')}`;
}

export function hashApiToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
