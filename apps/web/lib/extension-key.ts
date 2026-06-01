import { randomBytes } from 'node:crypto';

import { decryptPayload, encryptPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logServerDebug } from '@/lib/server-logger';

export async function getOrCreateExtensionApiKey(projectId: string): Promise<string> {
  const existing = await prisma.encryptedSecret.findFirst({
    where: { scope: 'PROJECT', projectId, key: 'extension.apiKey' },
  });

  if (existing) {
    try {
      const decrypted = decryptPayload<{ apiKey?: string }>({
        cipherText: existing.cipherText,
        iv: existing.iv,
        tag: existing.tag,
      });
      if (decrypted.apiKey) return decrypted.apiKey;
    } catch {
      logServerDebug('extension.key.decode_failed', { projectId });
    }
  }

  const token = randomBytes(24).toString('hex');
  const encoded = Buffer.from(projectId).toString('base64url');
  const apiKey = `dto_${encoded}_${token}`;

  const encrypted = encryptPayload({ apiKey });
  await prisma.encryptedSecret.deleteMany({
    where: { scope: 'PROJECT', projectId, key: 'extension.apiKey' },
  });

  await prisma.encryptedSecret.create({
    data: {
      scope: 'PROJECT',
      projectId,
      key: 'extension.apiKey',
      cipherText: encrypted.cipherText,
      iv: encrypted.iv,
      tag: encrypted.tag,
      algorithm: encrypted.algorithm,
    },
  });

  return apiKey;
}
