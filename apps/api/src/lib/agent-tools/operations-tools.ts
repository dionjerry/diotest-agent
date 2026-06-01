import { z } from 'zod';

import type { RuntimeTool } from './types.js';
import { buildProjectContextSnapshot, type ProjectContextSnapshot } from './context-tools.js';

const emptyInput = z.object({}).passthrough();

async function getProjectSnapshot(context: {
  projectId: string;
  cache?: Map<string, unknown>;
}) {
  const cacheKey = `project-snapshot:${context.projectId}`;
  const cached = context.cache?.get(cacheKey);
  if (cached) {
    return cached as ProjectContextSnapshot;
  }

  const snapshot = await buildProjectContextSnapshot(context.projectId);
  context.cache?.set(cacheKey, snapshot);
  return snapshot;
}

export const projectProfileTool: RuntimeTool<Record<string, unknown>> = {
  name: 'project_profile',
  description: 'Returns the organization, project, repository, and canonical project URL snapshot.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    return {
      organization: snapshot.organization,
      project: snapshot.project,
      repository: snapshot.repository,
      url: snapshot.url,
      repoName: snapshot.repoName,
    };
  },
};

export const runtimeStatusTool: RuntimeTool<Record<string, unknown>> = {
  name: 'runtime_status',
  description: 'Returns the configured AI runtime and OAuth status visible for the project.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    return snapshot.runtime;
  },
};

export const integrationStatusTool: RuntimeTool<Record<string, unknown>> = {
  name: 'integration_status',
  description: 'Returns connected integration configuration previews and health state for the project.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    return snapshot.integrations;
  },
};

export const recentOperationsTool: RuntimeTool<Record<string, unknown>> = {
  name: 'recent_operations',
  description: 'Returns the most recent agent actions and tasks for the project.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    return snapshot.operations;
  },
};

export const librarySummaryTool: RuntimeTool<Record<string, unknown>> = {
  name: 'library_summary',
  description: 'Returns counts and recent examples from the project test library aggregated from analysis and recorder sessions.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    const { prisma } = await import('../../db.js');
    const [analysisSessions, recorderSessions] = await Promise.all([
      prisma.analysisSession.findMany({
        where: { projectId: context.projectId },
        select: {
          id: true,
          pageType: true,
          ref: true,
          repo: true,
          riskScore: true,
          manualTestCases: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.recorderSession.findMany({
        where: { projectId: context.projectId, status: 'generated' },
        select: {
          id: true,
          name: true,
          domain: true,
          generated: true,
          startedAt: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    const fromAnalysis = analysisSessions.reduce((count, session) => {
      return count + (Array.isArray(session.manualTestCases) ? session.manualTestCases.length : 0);
    }, 0);
    const fromRecorder = recorderSessions.reduce((count, session) => {
      const generated = session.generated as { manual_test_cases?: unknown[] } | null;
      return count + (Array.isArray(generated?.manual_test_cases) ? generated.manual_test_cases.length : 0);
    }, 0);

    return {
      project: snapshot.project,
      totals: {
        analysisSessionCount: analysisSessions.length,
        recorderGeneratedCount: recorderSessions.length,
        manualCasesFromAnalysis: fromAnalysis,
        manualCasesFromRecorder: fromRecorder,
        totalManualCases: fromAnalysis + fromRecorder,
      },
      recentAnalysisLibraryEntries: analysisSessions.slice(0, 5).map((session) => ({
        id: session.id,
        source: session.pageType,
        ref: session.ref,
        repo: session.repo,
        riskScore: session.riskScore,
        caseCount: Array.isArray(session.manualTestCases) ? session.manualTestCases.length : 0,
        createdAt: session.createdAt.toISOString(),
      })),
      recentRecorderLibraryEntries: recorderSessions.slice(0, 5).map((session) => {
        const generated = session.generated as { manual_test_cases?: unknown[] } | null;
        return {
          id: session.id,
          name: session.name,
          domain: session.domain,
          caseCount: Array.isArray(generated?.manual_test_cases) ? generated.manual_test_cases.length : 0,
          startedAt: session.startedAt.toISOString(),
        };
      }),
    };
  },
};

export const runsSummaryTool: RuntimeTool<Record<string, unknown>> = {
  name: 'runs_summary',
  description: 'Returns recent PR analysis runs and recorder runs with risk/status summaries for the project.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const { prisma } = await import('../../db.js');
    const [analysisSessions, recorderSessions] = await Promise.all([
      prisma.analysisSession.findMany({
        where: { projectId: context.projectId },
        select: {
          id: true,
          repo: true,
          ref: true,
          pageType: true,
          riskScore: true,
          coverageLevel: true,
          mode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.recorderSession.findMany({
        where: { projectId: context.projectId },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          screenshotsCaptured: true,
          startedAt: true,
          generated: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 8,
      }),
    ]);

    return {
      analysisRuns: analysisSessions.map((session) => ({
        id: session.id,
        repo: session.repo,
        ref: session.ref,
        pageType: session.pageType,
        riskScore: session.riskScore,
        coverageLevel: session.coverageLevel,
        mode: session.mode,
        createdAt: session.createdAt.toISOString(),
      })),
      recorderRuns: recorderSessions.map((session) => ({
        id: session.id,
        name: session.name,
        domain: session.domain,
        status: session.status,
        screenshotsCaptured: session.screenshotsCaptured,
        hasGeneratedArtifacts: Boolean(session.generated),
        startedAt: session.startedAt.toISOString(),
      })),
    };
  },
};

export const repositoryDiagnosticsTool: RuntimeTool<Record<string, unknown>> = {
  name: 'repository_diagnostics',
  description: 'Returns repository connection health, webhook state, sync recency, and recent project activity around repository-backed runs.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const snapshot = await getProjectSnapshot(context);
    const { prisma } = await import('../../db.js');
    const [latestAnalysis, latestRecorder] = await Promise.all([
      prisma.analysisSession.findFirst({
        where: { projectId: context.projectId },
        select: {
          id: true,
          repo: true,
          ref: true,
          riskScore: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recorderSession.findFirst({
        where: { projectId: context.projectId },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          startedAt: true,
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      repository: snapshot.repository,
      latestAnalysisRun: latestAnalysis
        ? {
            id: latestAnalysis.id,
            repo: latestAnalysis.repo,
            ref: latestAnalysis.ref,
            riskScore: latestAnalysis.riskScore,
            createdAt: latestAnalysis.createdAt.toISOString(),
          }
        : null,
      latestRecorderRun: latestRecorder
        ? {
            id: latestRecorder.id,
            name: latestRecorder.name,
            domain: latestRecorder.domain,
            status: latestRecorder.status,
            startedAt: latestRecorder.startedAt.toISOString(),
          }
        : null,
      activitySignals: {
        openActionCount: snapshot.operations.actions.filter((action) => action.status !== 'completed').length,
        pendingTaskCount: snapshot.operations.tasks.filter((task) => task.status !== 'passed').length,
        recentRepositorySync: snapshot.repository.lastSyncedAt ?? null,
      },
      summary: snapshot.repository.connected
        ? `Repository ${snapshot.repository.fullName ?? snapshot.repoName} is connected with webhook status ${snapshot.repository.webhookStatus ?? 'unknown'}.`
        : 'No repository connection is configured for this project.',
    };
  },
};

export const latestAnalysisRunTool: RuntimeTool<Record<string, unknown>> = {
  name: 'latest_analysis_run',
  description: 'Returns the latest analysis run with detailed risk areas, manual test cases, and debug metadata.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const { prisma } = await import('../../db.js');
    const session = await prisma.analysisSession.findFirst({
      where: { projectId: context.projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return {
        summary: 'No analysis runs are available for this project yet.',
        run: null,
      };
    }

    const riskAreas = Array.isArray(session.riskAreas) ? session.riskAreas : [];
    const manualTestCases = Array.isArray(session.manualTestCases) ? session.manualTestCases : [];
    const testPlan = Array.isArray(session.testPlan) ? session.testPlan : [];
    const debug = (session.debug && typeof session.debug === 'object') ? session.debug as Record<string, unknown> : {};

    return {
      summary: `Latest analysis run ${session.id} scored ${session.riskScore.toFixed(1)} risk across ${riskAreas.length} risk areas and ${manualTestCases.length} manual test cases.`,
      run: {
        id: session.id,
        repo: session.repo,
        ref: session.ref,
        pageType: session.pageType,
        title: session.title,
        url: session.url,
        mode: session.mode,
        coverageLevel: session.coverageLevel,
        analysisQuality: session.analysisQuality,
        riskScore: session.riskScore,
        createdAt: session.createdAt.toISOString(),
        riskAreas,
        manualTestCases,
        testPlan,
        debug,
      },
    };
  },
};

export const latestRecorderSessionTool: RuntimeTool<Record<string, unknown>> = {
  name: 'latest_recorder_session',
  description: 'Returns the latest recorder session with kept steps, page summaries, warnings, and generated artifacts.',
  inputSchema: emptyInput,
  async execute(_input, context) {
    const { prisma } = await import('../../db.js');
    const session = await prisma.recorderSession.findFirst({
      where: { projectId: context.projectId },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return {
        summary: 'No recorder sessions are available for this project yet.',
        session: null,
      };
    }

    const steps = Array.isArray(session.steps) ? session.steps : [];
    const pageSummaries = Array.isArray(session.pageSummaries) ? session.pageSummaries : [];
    const warnings = Array.isArray(session.warnings) ? session.warnings : [];
    const generated = (session.generated && typeof session.generated === 'object') ? session.generated as Record<string, unknown> : null;
    const keptSteps = steps.filter((step) => step && typeof step === 'object' && 'kept' in (step as Record<string, unknown>) ? Boolean((step as Record<string, unknown>).kept) : true);

    return {
      summary: `Latest recorder session ${session.name} captured ${steps.length} steps, kept ${keptSteps.length}, and is currently ${session.status}.`,
      session: {
        id: session.id,
        extensionSessionId: session.extensionSessionId,
        name: session.name,
        domain: session.domain,
        startUrl: session.startUrl,
        lastUrl: session.lastUrl,
        status: session.status,
        screenshotsCaptured: session.screenshotsCaptured,
        startedAt: session.startedAt.toISOString(),
        stoppedAt: session.stoppedAt?.toISOString() ?? null,
        warnings,
        steps: keptSteps,
        pageSummaries,
        generated,
      },
    };
  },
};
