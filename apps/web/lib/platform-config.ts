import { createDecipheriv, createHash } from 'node:crypto';

import type { AiProviderConfig, OAuthProviderConfig } from '@diotest/domain/platform/types';

import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(env.settingsEncryptionKey).digest();
}

function decryptPayload<T>(record: { cipherText: string; iv: string; tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.cipherText, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

export async function getStoredOAuthConfig(): Promise<OAuthProviderConfig | null> {
  const fromEnv: OAuthProviderConfig | null =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          enabled: true,
          provider: 'google' as const,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      : null;

  if (!process.env.DATABASE_URL || !env.settingsEncryptionKey) {
    return fromEnv;
  }

  try {
    const secret = await prisma.encryptedSecret.findFirst({
      where: {
        scope: 'SYSTEM',
        organizationId: null,
        projectId: null,
        key: 'oauth.google',
      },
    });

    const fromDb = secret ? decryptPayload<OAuthProviderConfig>(secret) : null;
    return fromDb ?? fromEnv;
  } catch {
    return fromEnv;
  }
}

async function getStoredOAuthConfigWithSource(): Promise<{ config: OAuthProviderConfig | null; source: 'database' | 'environment' | 'none' }> {
  const fromEnv: OAuthProviderConfig | null =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          enabled: true,
          provider: 'google' as const,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      : null;

  if (!process.env.DATABASE_URL || !env.settingsEncryptionKey) {
    return {
      config: fromEnv,
      source: fromEnv ? 'environment' : 'none',
    };
  }

  try {
    const secret = await prisma.encryptedSecret.findFirst({
      where: {
        scope: 'SYSTEM',
        organizationId: null,
        projectId: null,
        key: 'oauth.google',
      },
    });

    if (secret) {
      return {
        config: decryptPayload<OAuthProviderConfig>(secret),
        source: 'database',
      };
    }
  } catch {
    return {
      config: fromEnv,
      source: fromEnv ? 'environment' : 'none',
    };
  }

  return {
    config: fromEnv,
    source: fromEnv ? 'environment' : 'none',
  };
}

export async function getStoredAiConfig(projectId?: string | null, organizationId?: string | null) {
  if (!process.env.DATABASE_URL || !env.settingsEncryptionKey) {
    return null;
  }

  const candidates = [
    projectId
      ? prisma.encryptedSecret.findFirst({
          where: {
            scope: 'PROJECT',
            organizationId: null,
            projectId,
            key: 'ai.project',
          },
        })
      : null,
    organizationId
      ? prisma.encryptedSecret.findFirst({
          where: {
            scope: 'ORGANIZATION',
            organizationId,
            projectId: null,
            key: 'ai.org',
          },
        })
      : null,
    prisma.encryptedSecret.findFirst({
      where: {
        scope: 'SYSTEM',
        organizationId: null,
        projectId: null,
        key: 'ai.org',
      },
    }),
  ].filter(Boolean) as Array<Promise<Awaited<ReturnType<typeof prisma.encryptedSecret.findFirst>>>>;

  try {
    for (const candidate of candidates) {
      const secret = await candidate;
      if (secret) {
        return decryptPayload<AiProviderConfig>(secret);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function getGoogleOAuthState() {
  const { config, source } = await getStoredOAuthConfigWithSource();

  return {
    enabled: Boolean(config?.enabled && config.clientId && config.clientSecret),
    source,
  } as const;
}
