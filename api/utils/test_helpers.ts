import { jest, expect } from '@jest/globals';
import db from '../db.js';
import { hashPassword } from './hash.js';

export const defaultUserData = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Usuário Teste',
  email: 'teste@calory.com',
  password: '123456',
};

export const defaultReq = { body: {}, params: {}, query: {} };

export async function ensureDefaultData() {
  return db.users.upsert({
    where: { id: defaultUserData.id },
    update: {},
    create: { ...defaultUserData, password: await hashPassword(defaultUserData.password) },
  });
}

export async function loginUser(overrides: Record<string, unknown> = {}) {
  const user = await ensureDefaultData();
  const req = {
    ...defaultReq,
    user: { user_id: user.id, email: user.email, type: 'access' },
    ...overrides,
  };
  return { req, user };
}

export function mockReply() {
  const reply: any = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    jwtSign: jest.fn<() => Promise<string>>().mockResolvedValue('token-test'),
    setCookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return reply;
}

function buildReq(req: Record<string, any>, user: unknown) {
  return {
    body: {},
    params: {},
    query: {},
    log: { error: jest.fn(), info: jest.fn() },
    user,
    ...req,
  };
}

export async function callAssertSuccess(
  fn: (req: any, res: any) => Promise<unknown>,
  req: Record<string, any> = {},
  status?: number,
) {
  const { req: logged } = await loginUser();
  const res = mockReply();
  await fn(buildReq(req, req.user ?? logged.user), res);
  const code = res.status.mock.calls[0]?.[0];
  if (status) expect(code).toBe(status);
  else expect(code).toBeGreaterThanOrEqual(200), expect(code).toBeLessThan(300);
  return res.send.mock.calls[0]?.[0];
}

export async function callAssertError(
  fn: (req: any, res: any) => Promise<unknown>,
  req: Record<string, any> = {},
  message?: string,
) {
  const { req: logged } = await loginUser();
  const res = mockReply();
  await fn(buildReq(req, req.user ?? logged.user), res);
  const code = res.status.mock.calls[0]?.[0];
  expect(code).toBeGreaterThanOrEqual(400);
  const body = res.send.mock.calls[0]?.[0];
  if (message) expect(body.message).toBe(message);
  return body;
}
