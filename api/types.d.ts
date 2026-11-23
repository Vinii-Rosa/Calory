import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { user_id: string; email: string; type: 'access' | 'refresh' };
    user: { user_id: string; email: string; type: 'access' | 'refresh' };
  }
}
