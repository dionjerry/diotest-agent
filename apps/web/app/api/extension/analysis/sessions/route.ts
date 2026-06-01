import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

type JsonInput = Prisma.InputJsonValue;

import { verifyExtensionApiKey } from '@/lib/extension-auth';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError, logServerEvent } from '@/lib/server-logger';

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json() as Record<string, unknown>;
    const auth = await verifyExtensionApiKey(body.apiKey);

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { projectId } = auth;
    const run = body.run as Record<string, unknown>;

    if (!run || typeof run !== 'object' || typeof run.id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid run payload' }, { status: 400 });
    }

    const debug = (run.debug ?? {}) as JsonInput;
    const riskAreas = (Array.isArray(run.riskAreas) ? run.riskAreas : []) as JsonInput[];
    const testPlan = (run.testPlan ?? {}) as JsonInput;
    const manualTestCases = (Array.isArray(run.manualTestCases) ? run.manualTestCases : []) as JsonInput[];

    await prisma.analysisSession.upsert({
      where: { extensionRunId: run.id },
      create: {
        projectId,
        extensionRunId: run.id,
        threadId: String(run.threadId ?? ''),
        repo: String(run.repo ?? ''),
        ref: String(run.ref ?? ''),
        pageType: String(run.pageType ?? 'pull_request'),
        title: run.title ? String(run.title) : null,
        url: run.url ? String(run.url) : null,
        mode: String(run.mode ?? 'pr_commit'),
        coverageLevel: String(run.coverageLevel ?? 'partial'),
        analysisQuality: String(run.analysisQuality ?? 'full'),
        riskScore: Number(run.riskScore ?? 0),
        riskAreas,
        testPlan,
        manualTestCases,
        debug,
      },
      update: {
        threadId: String(run.threadId ?? ''),
        title: run.title ? String(run.title) : null,
        url: run.url ? String(run.url) : null,
        coverageLevel: String(run.coverageLevel ?? 'partial'),
        analysisQuality: String(run.analysisQuality ?? 'full'),
        riskScore: Number(run.riskScore ?? 0),
        riskAreas,
        testPlan,
        manualTestCases,
        debug,
        updatedAt: new Date(),
      },
    });

    logServerEvent('extension.analysis.session.uploaded', {
      projectId,
      runId: run.id,
      riskScore: run.riskScore,
      durationMs: Date.now() - startedAt,
    });

    logServerDebug('extension.analysis.session.uploaded.debug', {
      projectId,
      runId: run.id,
      repo: run.repo,
      ref: run.ref,
      mode: run.mode,
      riskScore: run.riskScore,
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (error) {
    logServerError('extension.analysis.session.upload.error', 'internal_error', {}, error);
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

    const sessions = await prisma.analysisSession.findMany({
      where: { projectId: auth.projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ ok: true, sessions });
  } catch (error) {
    logServerError('extension.analysis.session.list.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
