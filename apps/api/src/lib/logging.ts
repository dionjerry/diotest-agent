import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { env } from '../env.js';
import { isDatabaseUnavailableError } from './errors.js';

type ErrorCategory =
  | 'validation_error'
  | 'auth_error'
  | 'permission_error'
  | 'provider_error'
  | 'database_error'
  | 'network_error'
  | 'internal_error';

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'confirmpassword',
  'token',
  'apikey',
  'apitoken',
  'clientsecret',
  'smtppass',
  'serviceaccountjson',
  'authorization',
  'reseturl',
  'secretjson',
  'secretpreview',
  'ciphertext',
  'iv',
  'tag',
  'privatekey',
  'private_key',
  'openaiapikey',
  'openrouterapikey',
  'access_token',
  'refresh_token',
  'id_token',
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        isSensitiveKey(key) ? '[REDACTED]' : sanitizeValue(inner),
      ]),
    );
  }

  return value;
}

function sanitizeMeta(meta: Record<string, unknown>) {
  return sanitizeValue(meta) as Record<string, unknown>;
}

function toErrorMeta(error: unknown) {
  if (!(error instanceof Error)) return undefined;

  return env.DEBUG_BACKEND
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      }
    : {
        name: error.name,
        message: error.message,
      };
}

export function classifyError(error: unknown, statusCode?: number): ErrorCategory {
  if (error instanceof ZodError || statusCode === 400) return 'validation_error';
  if (statusCode === 401) return 'auth_error';
  if (statusCode === 403) return 'permission_error';
  if (isDatabaseUnavailableError(error) || error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) {
    return 'database_error';
  }
  if (error instanceof Error && /provider|jira|trello|google|oauth|smtp/i.test(error.message)) return 'provider_error';
  if (error instanceof Error && /network|fetch|econn|enotfound|timed out/i.test(error.message)) return 'network_error';
  return 'internal_error';
}

export function logEvent(log: { info: (obj: unknown, msg?: string) => void }, event: string, meta: Record<string, unknown> = {}) {
  log.info(
    {
      event,
      ...sanitizeMeta(meta),
    },
    event,
  );
}

export function logDebug(log: { info: (obj: unknown, msg?: string) => void }, event: string, meta: Record<string, unknown> = {}) {
  if (!env.DEBUG_BACKEND) return;

  log.info(
    {
      event,
      debug: true,
      ...sanitizeMeta(meta),
    },
    event,
  );
}

export function logError(
  log: { error: (obj: unknown, msg?: string) => void },
  event: string,
  category: ErrorCategory,
  meta: Record<string, unknown> = {},
  error?: unknown,
) {
  log.error(
    {
      event,
      category,
      ...sanitizeMeta(meta),
      error: toErrorMeta(error),
    },
    event,
  );

  if (!env.DEBUG_BACKEND) return;

  log.error(
    {
      event: `${event}.debug`,
      debug: true,
      category,
      ...sanitizeMeta(meta),
      error: toErrorMeta(error),
    },
    `${event}.debug`,
  );
}
