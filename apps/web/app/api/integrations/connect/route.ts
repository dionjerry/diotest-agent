import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { persistIntegrationConnection, type IntegrationType } from '@/lib/integration-connections';
import { logServerError, logServerEvent } from '@/lib/server-logger';

const schema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['JIRA', 'TRELLO', 'GOOGLE_SHEETS']),
  config: z.record(z.string(), z.string()),
  secret: z.record(z.string(), z.string()),
});

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const session = await auth();

  if (!session?.user?.id) {
    logServerError('integration.connection.failed', 'auth_error', { status: 'failed' });
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());
    const result = await persistIntegrationConnection(
      payload.projectId,
      payload.type as IntegrationType,
      payload.config,
      payload.secret,
    );

    logServerEvent('integration.connected', {
      status: 'success',
      userId: session.user.id,
      projectId: payload.projectId,
      integrationType: payload.type,
      integrationId: result.integrationId,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, message: 'Integration saved successfully.', integrationId: result.integrationId });
  } catch (error) {
    logServerError(
      'integration.connection.failed',
      'validation_error',
      {
        status: 'failed',
        userId: session.user.id,
        durationMs: Date.now() - startedAt,
      },
      error,
    );

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to save the integration.' },
      { status: 400 },
    );
  }
}
