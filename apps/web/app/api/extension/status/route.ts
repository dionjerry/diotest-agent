import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError } from '@/lib/server-logger';

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

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
    }

    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });
    }

    const connectedAtSetting = await prisma.systemSetting.findFirst({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'extension.connectedAt',
      },
    });

    const connected = !!connectedAtSetting?.value;
    const connectedAt = connected ? String(connectedAtSetting.value) : undefined;

    logServerDebug('extension.status.check', {
      projectId,
      connected,
    });

    return NextResponse.json({ ok: true, connected, connectedAt });
  } catch (error) {
    logServerError('extension.status.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
