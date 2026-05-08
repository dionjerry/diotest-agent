import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerEvent, logServerError } from '@/lib/server-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ org: string; projectId: string; provider: string }> }
) {
  const startedAt = Date.now();

  try {
    const { org, projectId, provider } = await params;
    const payload = await request.json().catch(() => ({}));

    // Verify project exists and matches the org slug
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: {
          slug: org,
        },
      },
      select: {
        id: true,
        organization: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      logServerDebug('webhook.project_not_found', {
        org,
        projectId,
        provider: provider.toUpperCase(),
      });
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    logServerEvent('repository.webhook.received', {
      status: 'success',
      provider: provider.toUpperCase(),
      projectId,
      org,
      durationMs: Date.now() - startedAt,
    });

    logServerDebug('repository.webhook.received.debug', {
      provider: provider.toUpperCase(),
      projectId,
      org,
      deliveryKeys: payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>).sort() : [],
    });

    // TODO: Process webhook based on provider (github, gitlab, etc.)
    // For now, just acknowledge receipt

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError('webhook.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
