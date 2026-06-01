import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

function proxySSE(source: ReadableStream<Uint8Array>): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const reader = source.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // backend closed connection — normal for SSE end
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { organizationId?: string; projectId?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid request body', { status: 400 });
  }

  const { organizationId, projectId, content } = body;
  if (!organizationId || !projectId || !content) {
    return new Response('Missing required fields', { status: 400 });
  }

  const backendResponse = await fetch(`${env.apiBaseUrl}/agent-threads/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': env.internalApiKey,
    },
    body: JSON.stringify({ organizationId, projectId, content }),
  }).catch(() => null);

  if (!backendResponse?.ok || !backendResponse.body) {
    return new Response('Stream unavailable', { status: 502 });
  }

  return proxySSE(backendResponse.body);
}
