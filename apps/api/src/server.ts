import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';

import { env } from './env.js';
import { toSafeApiError } from './lib/errors.js';
import { classifyError, logDebug, logError, logEvent } from './lib/logging.js';
import { registerActionRoutes } from './routes/actions.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerInternalRoutes } from './routes/internal.js';
import { registerSettingsRoutes } from './routes/settings.js';

const app = Fastify({ logger: true });
const requestStartedAt = new WeakMap<FastifyRequest, number>();

app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health' || request.url === '/ready') {
    return;
  }

  requestStartedAt.set(request, Date.now());

  logEvent(request.log, 'request.received', {
    requestId: request.id,
    method: request.method,
    path: request.url,
  });
  logDebug(request.log, 'request.received.debug', {
    requestId: request.id,
    method: request.method,
    path: request.url,
    hasInternalApiKey: Boolean(request.headers['x-internal-api-key']),
  });

  const internalKey = request.headers['x-internal-api-key'];
  if (internalKey !== env.INTERNAL_API_KEY) {
    reply.code(401);
    throw new Error('Unauthorized');
  }
});

app.addHook('onResponse', async (request, reply) => {
  if (request.url === '/health' || request.url === '/ready') {
    return;
  }

  const startedAt = requestStartedAt.get(request);
  const durationMs = typeof startedAt === 'number' ? Date.now() - startedAt : undefined;

  logDebug(request.log, 'request.completed.debug', {
    requestId: request.id,
    method: request.method,
    path: request.url,
    statusCode: reply.statusCode,
    durationMs,
    slow: typeof durationMs === 'number' ? durationMs > 500 : undefined,
  });
});

app.setErrorHandler((error: Error, request, reply) => {
  if (reply.sent) {
    return;
  }

  const presetStatusCode = reply.statusCode >= 400 ? reply.statusCode : undefined;
  const safeError = presetStatusCode && presetStatusCode < 500
    ? { statusCode: presetStatusCode, message: error.message || 'Request failed' }
    : toSafeApiError(error);

  logError(
    request.log,
    'request.failed',
    classifyError(error, safeError.statusCode),
    {
      requestId: request.id,
      path: request.url,
      method: request.method,
      statusCode: safeError.statusCode,
      durationMs: (() => {
        const startedAt = requestStartedAt.get(request);
        return typeof startedAt === 'number' ? Date.now() - startedAt : undefined;
      })(),
    },
    error,
  );

  reply.code(safeError.statusCode).send({
    message: safeError.message,
  });
});

app.get('/', async () => ({
  service: 'diotest-api',
  status: 'ok',
}));

await registerHealthRoutes(app);
await registerInternalRoutes(app);
await registerSettingsRoutes(app);
await registerActionRoutes(app);

app
  .listen({ port: env.PORT, host: env.HOST })
  .then(() => {
    app.log.info(`DioTest API listening on ${env.HOST}:${env.PORT}`);
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
