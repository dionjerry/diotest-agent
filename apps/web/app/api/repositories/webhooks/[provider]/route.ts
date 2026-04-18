import { NextRequest, NextResponse } from 'next/server';

import { logServerDebug, logServerEvent } from '@/lib/server-logger';

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const payload = await request.json().catch(() => ({}));

  logServerEvent('repository.webhook.received', {
    status: 'success',
    provider: provider.toUpperCase(),
  });
  logServerDebug('repository.webhook.received.debug', {
    provider: provider.toUpperCase(),
    deliveryKeys: payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>).sort() : [],
  });

  return NextResponse.json({ ok: true });
}
