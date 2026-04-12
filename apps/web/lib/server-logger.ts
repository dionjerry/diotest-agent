type LogCategory =
  | 'validation_error'
  | 'auth_error'
  | 'permission_error'
  | 'provider_error'
  | 'database_error'
  | 'network_error'
  | 'internal_error';

type SafeMeta = Record<string, unknown>;
const DEBUG_BACKEND = process.env.DEBUG_BACKEND === 'true';

function sanitizeMeta(meta: SafeMeta) {
  const blocked = [
    'password',
    'token',
    'apiToken',
    'apiKey',
    'clientSecret',
    'smtpPass',
    'serviceAccountJson',
    'authorization',
    'resetUrl',
    'secretJson',
    'secretPreview',
    'privateKey',
    'cipherText',
    'openaiApiKey',
    'openrouterApiKey',
    'access_token',
    'refresh_token',
    'id_token',
  ];
  return Object.fromEntries(
    Object.entries(meta).filter(([key, value]) => value !== undefined && !blocked.some((blockedKey) => key.toLowerCase().includes(blockedKey.toLowerCase()))),
  );
}

export function logServerEvent(event: string, meta: SafeMeta = {}) {
  console.info(
    JSON.stringify({
      level: 'info',
      event,
      timestamp: new Date().toISOString(),
      ...sanitizeMeta(meta),
    }),
  );
}

export function logServerDebug(event: string, meta: SafeMeta = {}) {
  if (!DEBUG_BACKEND) return;

  console.info(
    JSON.stringify({
      level: 'info',
      debug: true,
      event,
      timestamp: new Date().toISOString(),
      ...sanitizeMeta(meta),
    }),
  );
}

export function logServerError(
  event: string,
  category: LogCategory,
  meta: SafeMeta = {},
  error?: unknown,
) {
  const err =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
        }
      : undefined;

  console.error(
    JSON.stringify({
      level: 'error',
      event,
      category,
      timestamp: new Date().toISOString(),
      ...sanitizeMeta(meta),
      ...(err ? { error: err } : {}),
    }),
  );

  if (!DEBUG_BACKEND) return;

  console.error(
    JSON.stringify({
      level: 'error',
      debug: true,
      event: `${event}.debug`,
      category,
      timestamp: new Date().toISOString(),
      ...sanitizeMeta(meta),
      ...(err ? { error: { ...err, stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined } } : {}),
    }),
  );
}
