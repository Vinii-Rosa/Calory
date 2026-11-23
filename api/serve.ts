import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import db from './db.js';
import { JWT_SECRET } from './config/jwt.js';

export const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 3001;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não definido. Configure no arquivo .env');
}

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

await app.register(cookie);
await app.register(cors, {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
await app.register(jwt, { secret: JWT_SECRET, cookie: { cookieName: 'refresh_token', signed: false } });

app.get('/health', async (_req, res) => {
  return res.status(200).send({ status: 'ok' });
});

await db.$queryRaw`SELECT 1`;

if (process.env.NODE_ENV !== 'test') {
  app.listen({ port, host: '0.0.0.0' }, () => {
    console.log(`App listening on port ${port}`);
  });
}
