import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = (await request.json()) as { projectId?: string };
  if (!projectId) {
    return Response.json({ error: 'Missing projectId' }, { status: 400 });
  }

  try {
    // Clear the repository connection for this project
    await prisma.repositoryConnection.deleteMany({
      where: { projectId },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to disconnect repository:', error);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
