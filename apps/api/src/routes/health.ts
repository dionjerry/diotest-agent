import type { FastifyInstance } from 'fastify';

import { prisma } from '../db.js';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      reply.code(503);
      return { status: 'degraded' };
    }
  });
}
