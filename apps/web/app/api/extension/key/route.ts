import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { decryptPayload, encryptPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError, logServerEvent } from '@/lib/server-logger';

async function userOwnsProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(project);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
    }

    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });
    }

    const existing = await prisma.encryptedSecret.findFirst({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.apiKey',
      },
    });

    if (existing) {
      try {
        const decrypted = decryptPayload<{ apiKey?: string }>({
          cipherText: existing.cipherText,
          iv: existing.iv,
          tag: existing.tag,
        });

        if (decrypted.apiKey) {
          logServerDebug('extension.key.retrieved', {
            projectId,
            durationMs: Date.now() - startedAt,
          });
          return NextResponse.json({ ok: true, apiKey: decrypted.apiKey });
        }
      } catch (error) {
        logServerError('extension.key.decrypt_failed', 'internal_error', { projectId }, error);
      }

      if (existing.cipherText) {
        logServerDebug('extension.key.retrieved', {
          projectId,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    const token = randomBytes(24).toString('hex');
    const encoded = Buffer.from(projectId).toString('base64url');
    const apiKey = `dto_${encoded}_${token}`;

    const encrypted = encryptPayload({ apiKey });
    await prisma.encryptedSecret.deleteMany({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.apiKey',
      },
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

    logServerEvent('extension.key.generated', {
      projectId,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, apiKey });
  } catch (error) {
    logServerError('extension.key.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
