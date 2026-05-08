import { NextResponse } from 'next/server';

import { decryptPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError, logServerEvent } from '@/lib/server-logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ org: string; projectId: string }> }
) {
  const startedAt = Date.now();

  try {
    const { projectId: urlProjectId } = await params;
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('dto_')) {
      return NextResponse.json({ ok: false, error: 'Invalid key format' }, { status: 401 });
    }

    // Decode projectId from key prefix: dto_{base64url(projectId)}_{token}
    const parts = apiKey.split('_');
    if (parts.length !== 3 || parts[0] !== 'dto') {
      return NextResponse.json({ ok: false, error: 'Invalid key format' }, { status: 401 });
    }

    const encodedProjectId = parts[1];
    let projectId: string;
    try {
      projectId = Buffer.from(encodedProjectId, 'base64url').toString('utf8');
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
    }

    // Verify URL projectId matches API key projectId
    if (projectId !== urlProjectId) {
      logServerDebug('extension.ping.project_mismatch', { urlProjectId, keyProjectId: projectId });
      return NextResponse.json({ ok: false, error: 'Project ID mismatch' }, { status: 401 });
    }

    // Find and decrypt stored key
    const stored = await prisma.encryptedSecret.findFirst({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.apiKey',
      },
    });

    if (!stored) {
      logServerDebug('extension.ping.no_key', { projectId });
      return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
    }

    // Decrypt and compare
    let decrypted: { apiKey?: string };
    try {
      decrypted = decryptPayload({ cipherText: stored.cipherText, iv: stored.iv, tag: stored.tag });
    } catch (error) {
      logServerError('extension.ping.decrypt_failed', 'internal_error', {}, error);
      return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
    }

    if (decrypted.apiKey !== apiKey) {
      logServerDebug('extension.ping.key_mismatch', { projectId });
      return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
    }

    // Record connection timestamp
    await prisma.systemSetting.deleteMany({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.connectedAt',
      },
    });

    await prisma.systemSetting.create({
      data: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.connectedAt',
        value: new Date().toISOString(),
      },
    });

    logServerEvent('extension.ping.success', {
      projectId,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, projectId });
  } catch (error) {
    logServerError('extension.ping.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
