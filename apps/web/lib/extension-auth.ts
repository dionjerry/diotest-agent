import { decryptPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

export type ExtensionAuthResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string; status: 401 | 500 };

export async function verifyExtensionApiKey(apiKey: unknown): Promise<ExtensionAuthResult> {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('dto_')) {
    return { ok: false, error: 'Invalid key format', status: 401 };
  }

  const parts = apiKey.split('_');
  if (parts.length !== 3 || parts[0] !== 'dto') {
    return { ok: false, error: 'Invalid key format', status: 401 };
  }

  let projectId: string;
  try {
    projectId = Buffer.from(parts[1]!, 'base64url').toString('utf8');
  } catch {
    return { ok: false, error: 'Invalid key', status: 401 };
  }

  const stored = await prisma.encryptedSecret.findFirst({
    where: { scope: 'PROJECT', projectId, key: 'extension.apiKey' },
  });

  if (!stored) {
    return { ok: false, error: 'Invalid key', status: 401 };
  }

  let decrypted: { apiKey?: string };
  try {
    decrypted = decryptPayload({ cipherText: stored.cipherText, iv: stored.iv, tag: stored.tag });
  } catch {
    return { ok: false, error: 'Invalid key', status: 500 };
  }

  if (decrypted.apiKey !== apiKey) {
    return { ok: false, error: 'Invalid key', status: 401 };
  }

  return { ok: true, projectId };
}
