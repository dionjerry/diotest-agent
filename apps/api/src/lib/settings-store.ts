import { Prisma } from '@prisma/client';

import { prisma } from '../db.js';
import { encryptPayload } from './secrets.js';

export type SettingsScope = 'SYSTEM' | 'ORGANIZATION' | 'PROJECT';

export async function getSecret(scope: SettingsScope, key: string, organizationId?: string, projectId?: string) {
  return prisma.encryptedSecret.findFirst({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });
}

export async function upsertSecret(
  scope: SettingsScope,
  key: string,
  payload: Record<string, unknown>,
  organizationId?: string,
  projectId?: string,
) {
  const encrypted = encryptPayload(payload);

  await prisma.encryptedSecret.deleteMany({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });

  return prisma.encryptedSecret.create({
    data: {
      scope,
      key,
      organizationId,
      projectId,
      cipherText: encrypted.cipherText,
      iv: encrypted.iv,
      tag: encrypted.tag,
      algorithm: encrypted.algorithm,
    },
  });
}

export async function upsertSetting(
  scope: SettingsScope,
  key: string,
  value: Record<string, unknown>,
  organizationId?: string,
  projectId?: string,
) {
  await prisma.systemSetting.deleteMany({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });

  return prisma.systemSetting.create({
    data: {
      scope,
      key,
      organizationId,
      projectId,
      value: value as Prisma.InputJsonValue,
    },
  });
}
