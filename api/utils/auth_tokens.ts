import type { FastifyReply } from 'fastify';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface TokenUser {
  user_id: string;
  email: string;
}

type Signer = {
  jwtSign: (payload: object, options?: { expiresIn: string }) => Promise<string>;
};

export async function signAccessToken(res: Signer, user: TokenUser) {
  return res.jwtSign({ user_id: user.user_id, email: user.email, type: 'access' }, { expiresIn: '15m' });
}

export async function signRefreshToken(res: Signer, user: TokenUser) {
  return res.jwtSign({ user_id: user.user_id, email: user.email, type: 'refresh' }, { expiresIn: '7d' });
}

export function setRefreshCookie(res: FastifyReply, token: string) {
  res.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearRefreshCookie(res: FastifyReply) {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}
