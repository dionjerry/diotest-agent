import { Prisma } from '@prisma/client';
import type { UiRecorderGenerationOptions, UiRecorderGenerationResult, UiRecorderSession } from '@diotest/domain/recorder/types';
import { generateUiRecorderArtifacts } from '@diotest/engine/recorder/orchestrator';

import { getLegacyRuntimeSettings } from './runtime.js';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isUiRecorderSession(value: unknown): value is UiRecorderSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  if (typeof session.id !== 'string' || typeof session.name !== 'string') return false;
  if (typeof session.domain !== 'string' || typeof session.startUrl !== 'string' || typeof session.lastUrl !== 'string') return false;
  if (typeof session.startedAt !== 'string' || !Array.isArray(session.steps) || !isStringArray(session.warnings)) return false;
  return session.steps.every((step) => {
    if (!step || typeof step !== 'object') return false;
    const candidate = step as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.timestamp === 'string' &&
      typeof candidate.action === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.url === 'string' &&
      typeof candidate.kept === 'boolean'
    );
  });
}

function normalizeOptions(value: unknown): UiRecorderGenerationOptions {
  if (!value || typeof value !== 'object') {
    return {
      includeVision: true,
      includePageSummaries: true,
    };
  }

  const options = value as Record<string, unknown>;
  return {
    includeVision: options.includeVision !== false,
    includePageSummaries: options.includePageSummaries !== false,
  };
}

async function loadStoredRecorderSession(projectId: string, sessionId: string): Promise<UiRecorderSession | null> {
  const { prisma } = await import('../../db.js');
  const session = await prisma.recorderSession.findFirst({
    where: {
      id: sessionId,
      projectId,
    },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    name: session.name,
    domain: session.domain,
    startUrl: session.startUrl,
    lastUrl: session.lastUrl,
    startedAt: session.startedAt.toISOString(),
    stoppedAt: session.stoppedAt?.toISOString(),
    status: session.status as UiRecorderSession['status'],
    steps: (session.steps as unknown as UiRecorderSession['steps']) ?? [],
    pageSummaries: (session.pageSummaries as unknown as UiRecorderSession['pageSummaries']) ?? [],
    warnings: (session.warnings as string[]) ?? [],
    screenshotsCaptured: session.screenshotsCaptured,
    storageTrimmed: session.storageTrimmed,
    lastGenerationOptions: session.lastGenerationOptions as unknown as UiRecorderSession['lastGenerationOptions'],
    generated: session.generated as unknown as UiRecorderSession['generated'],
  };
}

export async function runHostedRecorderGeneration(params: {
  organizationId: string;
  projectId: string;
  sessionId?: string;
  session?: unknown;
  options?: unknown;
}): Promise<{ ok: true; result: UiRecorderGenerationResult } | { ok: false; error: string; code?: string }> {
  const normalizedOptions = normalizeOptions(params.options);
  const session = params.sessionId
    ? await loadStoredRecorderSession(params.projectId, params.sessionId)
    : (isUiRecorderSession(params.session) ? params.session : null);

  if (!session) {
    return { ok: false, error: 'A valid recorder session payload is required.' };
  }

  const settings = await getLegacyRuntimeSettings({
    organizationId: params.organizationId,
    projectId: params.projectId,
  });

  const result = await generateUiRecorderArtifacts(settings, session, normalizedOptions);
  if (result.ok && params.sessionId) {
    const { prisma } = await import('../../db.js');
    await prisma.recorderSession.update({
      where: { id: params.sessionId },
      data: {
        generated: result.result as unknown as Prisma.InputJsonValue,
        lastGenerationOptions: {
          ...normalizedOptions,
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        status: 'generated',
      },
    });
  }

  return result;
}
