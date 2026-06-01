import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { verifyExtensionApiKey } from '@/lib/extension-auth';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError, logServerEvent } from '@/lib/server-logger';

type JsonInput = Prisma.InputJsonValue;

interface RawStep {
  id?: string;
  screenshot?: {
    id?: string;
    capturedAt?: string;
    dataUrl?: string;
  };
  [key: string]: unknown;
}

function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  // data:image/jpeg;base64,/9j/4AAQ...
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  try {
    return {
      mimeType: match[1]!,
      buffer: Buffer.from(match[2]!, 'base64'),
    };
  } catch {
    return null;
  }
}

async function persistScreenshots(
  projectId: string,
  sessionId: string,
  steps: RawStep[],
): Promise<RawStep[]> {
  const processed: RawStep[] = [];

  for (const step of steps) {
    const dataUrl = step.screenshot?.dataUrl;
    const screenshotId = step.screenshot?.id;

    // No screenshot or already a URL (not a dataUrl) — pass through
    if (!dataUrl || !screenshotId || !dataUrl.startsWith('data:')) {
      processed.push(step);
      continue;
    }

    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      // Can't decode — drop the dataUrl, keep metadata shell
      processed.push({
        ...step,
        screenshot: { id: screenshotId, capturedAt: step.screenshot?.capturedAt, dataUrl: '' },
      });
      continue;
    }

    // Key on screenshotId so the serve URL and DB row always match
    await prisma.recorderScreenshot.upsert({
      where: { extensionSessionId_stepId: { extensionSessionId: sessionId, stepId: screenshotId } },
      create: {
        projectId,
        extensionSessionId: sessionId,
        stepId: screenshotId,
        mimeType: decoded.mimeType,
        data: new Uint8Array(decoded.buffer),
      },
      update: {
        mimeType: decoded.mimeType,
        data: new Uint8Array(decoded.buffer),
      },
    });

    const serveUrl = `/api/extension/recorder/screenshots/${screenshotId}`;
    processed.push({
      ...step,
      screenshot: { id: screenshotId, capturedAt: step.screenshot?.capturedAt, dataUrl: serveUrl },
    });
  }

  return processed;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json() as Record<string, unknown>;
    const auth = await verifyExtensionApiKey(body.apiKey);

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { projectId } = auth;
    const session = body.session as Record<string, unknown>;

    if (!session || typeof session !== 'object' || typeof session.id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid session payload' }, { status: 400 });
    }

    const startedAtDate = new Date(session.startedAt as string);
    const stoppedAtDate = session.stoppedAt ? new Date(session.stoppedAt as string) : null;

    const rawSteps = Array.isArray(session.steps) ? (session.steps as RawStep[]) : [];
    const steps = (await persistScreenshots(projectId, session.id, rawSteps)) as JsonInput[];

    const pageSummaries = (Array.isArray(session.pageSummaries) ? session.pageSummaries : []) as JsonInput[];
    const warnings = (Array.isArray(session.warnings) ? session.warnings : []) as JsonInput[];
    const generated = session.generated != null ? (session.generated as JsonInput) : Prisma.JsonNull;
    const lastGenOpts = session.lastGenerationOptions != null ? (session.lastGenerationOptions as JsonInput) : Prisma.JsonNull;

    const screenshotCount = rawSteps.filter((s) => s.screenshot?.dataUrl?.startsWith('data:')).length;

    await prisma.recorderSession.upsert({
      where: { extensionSessionId: session.id },
      create: {
        projectId,
        extensionSessionId: session.id,
        name: String(session.name ?? ''),
        domain: String(session.domain ?? ''),
        startUrl: String(session.startUrl ?? ''),
        lastUrl: String(session.lastUrl ?? ''),
        status: String(session.status ?? 'review'),
        steps,
        pageSummaries,
        generated,
        lastGenerationOptions: lastGenOpts,
        warnings,
        screenshotsCaptured: Number(session.screenshotsCaptured ?? 0),
        storageTrimmed: Boolean(session.storageTrimmed ?? false),
        startedAt: startedAtDate,
        stoppedAt: stoppedAtDate,
      },
      update: {
        name: String(session.name ?? ''),
        lastUrl: String(session.lastUrl ?? ''),
        status: String(session.status ?? 'review'),
        steps,
        pageSummaries,
        generated,
        lastGenerationOptions: lastGenOpts,
        warnings,
        screenshotsCaptured: Number(session.screenshotsCaptured ?? 0),
        storageTrimmed: Boolean(session.storageTrimmed ?? false),
        stoppedAt: stoppedAtDate,
        updatedAt: new Date(),
      },
    });

    logServerEvent('extension.recorder.session.uploaded', {
      projectId,
      sessionId: session.id,
      status: session.status,
      stepCount: rawSteps.length,
      screenshotCount,
      durationMs: Date.now() - startedAt,
    });

    logServerDebug('extension.recorder.session.uploaded.debug', {
      projectId,
      sessionId: session.id,
      domain: session.domain,
      status: session.status,
      stepCount: rawSteps.length,
      screenshotCount,
      hasGenerated: Boolean(session.generated),
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (error) {
    logServerError('extension.recorder.session.upload.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const auth = await verifyExtensionApiKey(apiKey);

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const sessions = await prisma.recorderSession.findMany({
      where: { projectId: auth.projectId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ ok: true, sessions });
  } catch (error) {
    logServerError('extension.recorder.session.list.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
