import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(env.settingsEncryptionKey).digest();
}

export function encryptPayload(value: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    algorithm: ALGORITHM,
  };
}

export function decryptPayload<T>(record: { cipherText: string; iv: string; tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(record.cipherText, 'base64')), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}
