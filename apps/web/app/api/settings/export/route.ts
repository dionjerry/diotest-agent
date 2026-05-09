import { NextResponse } from 'next/server';

import { getSettingsExport } from '@/lib/api';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

async function userOwnsOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId') || undefined;
  const projectId = searchParams.get('projectId') || undefined;

  if (projectId && !(await userOwnsProject(session.user.id, projectId))) {
    return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });
  }

  if (!projectId && organizationId && !(await userOwnsOrganization(session.user.id, organizationId))) {
    return NextResponse.json({ ok: false, error: 'Organization not found.' }, { status: 404 });
  }

  const payload = await getSettingsExport({ organizationId, projectId });
  const fileName = projectId ? `diotest-settings-${projectId}.json` : 'diotest-settings.json';

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
