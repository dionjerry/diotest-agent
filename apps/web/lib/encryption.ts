import { createDecipheriv, createHash } from 'node:crypto';

import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(env.settingsEncryptionKey).digest();
}

export function decryptPayload<T>(record: { cipherText: string; iv: string; tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(record.cipherText, 'base64')), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}
