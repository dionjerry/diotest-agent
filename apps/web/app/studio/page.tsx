import Link from 'next/link';
import { unstable_cache } from 'next/cache';

import { ActionConsole } from '@/components/studio/action-console';
import { AgentChatPanel } from '@/components/studio/agent-chat-panel';
import { RecommendedActions } from '@/components/studio/recommended-actions';
import { ApplyRecommendationsButton, RescanPRButton } from '@/components/studio/studio-center-actions';
import { StudioPanelsLayout } from '@/components/studio/studio-panels-layout';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { WorkspaceMenu } from '@/components/app-shell/workspace-menu';
import { Badge } from '@/components/ui/badge';
import { LogoLockup } from '@/components/ui/logo';
import { AppApiError, getActions, getAgentThread, getAgentThreads, getHostedAgentRecommendations, getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { logServerEvent } from '@/lib/server-logger';

interface RiskArea {
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  why: string;
  evidence_files: string[];
}

interface ManualTestCase {
  id: string;
  title: string;
  why?: string;
  evidence_files?: string[];
}

interface RecorderStep {
  id: string;
  action: string;
  title: string;
  url: string;
  kept: boolean;
}

interface GeneratedOutput {
  manual_test_cases: ManualTestCase[];
}

type RuntimeStatus = {
  configured: boolean;
  provider: 'openai' | 'openrouter';
  model: string;
  missingKeyFor: 'openai' | 'openrouter' | null;
};

function isRecommendationApiError(error: unknown) {
  return error instanceof AppApiError;
}

function severityTone(severity: RiskArea['severity']) {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  return 'success';
}

function riskScoreTone(score: number) {
  if (score >= 7) return { border: 'border-[#ff8780]', text: 'text-[#ff8780]', label: 'High Risk' };
  if (score >= 4) return { border: 'border-[#ffb24a]', text: 'text-[#ffb24a]', label: 'Medium Risk' };
  return { border: 'border-[#53dca4]', text: 'text-[#53dca4]', label: 'Low Risk' };
}

function timeAgo(value: Date) {
  const seconds = Math.floor((Date.now() - value.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ thread?: string }>;
}) {
  const startedAt = Date.now();
  const { user, bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load studio data.'} />
      </main>
    );
  }

  const resolvedSearchParams = await searchParams;
  const requestedThreadId = resolvedSearchParams?.thread;

  const [actionState, agentThreads, analysisSessions, recorderSessions, settings] = bootstrap.project && bootstrap.organization
    ? await Promise.all([
        getActions(bootstrap.project.id),
        getAgentThreads(bootstrap.project.id).then((result) => result.threads).catch((error) => {
          if (isRecommendationApiError(error)) {
            return [];
          }
          throw error;
        }),
        prisma.analysisSession.findMany({
          where: { projectId: bootstrap.project.id },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        prisma.recorderSession.findMany({
          where: { projectId: bootstrap.project.id },
          orderBy: { startedAt: 'desc' },
          take: 6,
        }),
        getSettings({
          organizationId: bootstrap.organization.id,
          projectId: bootstrap.project.id,
        }, {
          fresh: true,
        }).catch((error) => {
          if (isRecommendationApiError(error)) {
            return null;
          }
          throw error;
        }),
      ])
    : [{ actions: [], tasks: [] }, [], [], [], null];

  // Recommendations: max 5s wait so router.refresh() after chat messages is fast.
  const runtimeRecommendations = bootstrap.project && bootstrap.organization
    ? await Promise.race([
        unstable_cache(
          () => getHostedAgentRecommendations({
            organizationId: bootstrap.organization!.id,
            projectId: bootstrap.project!.id,
            focus: 'Recommend the next best agent actions for the current Studio project.',
          }),
          [`studio-recommendations:${bootstrap.organization.id}:${bootstrap.project.id}`],
          { revalidate: 300 },
        )(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]).catch(() => null)
    : null;
  const selectedThreadId = requestedThreadId && agentThreads.some((thread) => thread.id === requestedThreadId)
    ? requestedThreadId
    : agentThreads[0]?.id;
  const activeThread = selectedThreadId
    ? await getAgentThread(selectedThreadId).then((result) => result.thread).catch((error) => {
        if (isRecommendationApiError(error)) {
          return null;
        }
        throw error;
      })
    : null;
  const durationMs = Date.now() - startedAt;
  logServerEvent('studio.rendered', {
    status: 'success',
    userId: user.id,
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
    durationMs,
    slow: durationMs > 500,
  });

  const fallbackRecommendationItems = [
    {
      title: 'Generate tests for PR changes',
      body: `Agent identified ${Math.max(actionState.actions.length, 4)} new edge cases in the MFA flow.`,
      button: 'Start Generation (3m)',
      tone: 'success' as const,
    },
    {
      title: 'Sync with Jira',
      body: '3 issues in DIO-PROJECT are linked to this PR. Sync test status?',
      button: 'Sync Requirements',
      tone: 'warn' as const,
    },
    {
      title: 'Automated Root Cause',
      body: 'Analyzing test failures... Waiting for CI completion.',
      button: 'Pending CI',
      tone: 'neutral' as const,
    },
  ];
  const combinedRuns = [
    ...analysisSessions.map((session) => ({
      id: session.id,
      href: `/studio/runs/${session.id}`,
      label: `${session.repo.split('/')[1] ?? session.repo} · ${session.pageType === 'pull_request' ? `PR #${session.ref}` : session.ref.slice(0, 7)}`,
      meta: `Risk ${session.riskScore.toFixed(1)} · ${timeAgo(session.createdAt)}`,
      kind: 'analysis' as const,
      createdAt: session.createdAt.getTime(),
    })),
    ...recorderSessions.map((session) => ({
      id: `rec_${session.id}`,
      href: `/studio/runs/rec_${session.id}`,
      label: session.name,
      meta: `${session.domain} · ${timeAgo(session.startedAt)}`,
      kind: 'recorder' as const,
      createdAt: session.startedAt.getTime(),
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  const recentRunLinks = combinedRuns.slice(0, 5);
  const libraryEntries = [
    ...analysisSessions.flatMap((session) => {
      const manualCases = (session.manualTestCases as ManualTestCase[] | null) ?? [];
      return manualCases.slice(0, 3).map((testCase, index) => ({
        key: `analysis-${session.id}-${index}`,
        title: testCase.title,
        href: `/studio/runs/${session.id}`,
        meta: testCase.evidence_files?.[0] ?? session.repo,
      }));
    }),
    ...recorderSessions.flatMap((session) => {
      const generated = session.generated as GeneratedOutput | null;
      const manualCases = generated?.manual_test_cases ?? [];
      return manualCases.slice(0, 2).map((testCase, index) => ({
        key: `recorder-${session.id}-${index}`,
        title: testCase.title,
        href: `/studio/runs/rec_${session.id}`,
        meta: session.domain,
      }));
    }),
  ].slice(0, 6);
  const activeAnalysis = analysisSessions[0] ?? null;
  const activeRecorder = !activeAnalysis ? recorderSessions[0] ?? null : null;
  const activeAnalysisRisks = ((activeAnalysis?.riskAreas as RiskArea[] | null) ?? []).slice(0, 3);
  const activeAnalysisCases = (activeAnalysis?.manualTestCases as ManualTestCase[] | null) ?? [];
  const activeRecorderSteps = ((activeRecorder?.steps as RecorderStep[] | null) ?? []).filter((step) => step.kept);
  const activeRecorderGenerated = activeRecorder?.generated as GeneratedOutput | null;
  const activeRecorderCases = activeRecorderGenerated?.manual_test_cases ?? [];
  const queuedTasks = actionState.tasks.filter((task) => task.status !== 'passed').length;
  const pendingApprovals = actionState.actions.filter((action) => action.status === 'awaiting_approval').length;
  const latestThreadPreview = activeThread?.messages.at(-1)?.content.slice(0, 96);
  const runtimeStatus: RuntimeStatus | null = settings
    ? {
        configured: settings.ai.preferredProvider === 'openrouter' ? settings.ai.hasOpenRouterKey : settings.ai.hasOpenAiKey,
        provider: settings.ai.preferredProvider,
        model: settings.ai.model,
        missingKeyFor: settings.ai.preferredProvider === 'openrouter'
          ? (settings.ai.hasOpenRouterKey ? null : 'openrouter')
          : (settings.ai.hasOpenAiKey ? null : 'openai'),
      }
    : null;
  const leftSidebar = (
    <aside className="border-r border-white/6 bg-[#141519] px-4 py-4">
      <div className="rounded-[4px] border border-white/6 bg-[#1b1c21] px-4 py-4">
        <div className="text-lg font-semibold text-white">{bootstrap.project?.name ?? 'Project Alpha'}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#72747b]">Testing Environment</div>
      </div>
      <button className="mt-4 flex h-11 w-full items-center justify-center rounded-[4px] bg-[#53dca4] text-sm font-semibold text-[#103223]">
        + New Test Case
      </button>

      <div className="mt-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Open Reviews</div>
        <div className="space-y-1">
          {recentRunLinks.length > 0 ? recentRunLinks.map((run, index) => (
            <Link
              key={run.id}
              href={run.href}
              className={`block rounded-[4px] px-4 py-3 text-sm ${index === 0 ? 'bg-[#1f2c25] text-[#53dca4]' : 'text-[#8b8d94] hover:bg-white/[0.03]'}`}
            >
              <div className="truncate">{run.label}</div>
              <div className="mt-1 truncate text-[11px] text-[#666870]">{run.meta}</div>
            </Link>
          )) : (
            <div className="rounded-[4px] px-4 py-3 text-sm text-[#8b8d94]">No analysis or recorder runs yet</div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Saved Tests</div>
        <div className="space-y-1">
          {libraryEntries.length > 0 ? libraryEntries.map((entry) => (
            <Link key={entry.key} href={entry.href} className="block rounded-[4px] px-4 py-3 text-sm text-[#8b8d94] hover:bg-white/[0.03]">
              <div className="truncate">{entry.title}</div>
              <div className="mt-1 truncate text-[11px] text-[#666870]">{entry.meta}</div>
            </Link>
          )) : (
            <div className="rounded-[4px] px-4 py-3 text-sm text-[#8b8d94]">No generated library entries yet</div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3 text-sm text-[#6f7178] lg:mt-auto lg:flex lg:h-[calc(100vh-520px)] lg:flex-col lg:justify-end">
        <div>Pending approvals: {pendingApprovals}</div>
        <div>Queued tasks: {queuedTasks}</div>
        <div>Library cases: {libraryEntries.length}</div>
      </div>
    </aside>
  );

  const rightSidebar = bootstrap.organization && bootstrap.project ? (
    <aside className="border-l border-white/6">
      <AgentChatPanel
        organizationId={bootstrap.organization.id}
        projectId={bootstrap.project.id}
        threads={agentThreads}
        activeThread={activeThread}
        runtimeStatus={runtimeStatus}
      />
    </aside>
  ) : runtimeRecommendations && bootstrap.project ? (
    <aside className="border-l border-white/6 bg-[#141519] px-5 py-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#53dca4] text-[#0f2d21]">✦</span>
        <div className="text-lg font-semibold text-white">Agent Recommendations</div>
      </div>
      <RecommendedActions
        projectId={bootstrap.project.id}
        summary={runtimeRecommendations.summary}
        items={runtimeRecommendations.recommendations}
      />
    </aside>
  ) : (
    <aside className="border-l border-white/6 bg-[#141519] px-5 py-5">
      {latestThreadPreview ? (
        <div className="mb-5 rounded-[4px] border border-white/6 bg-[#111216] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Latest Thread Activity</div>
          <div className="mt-2 text-sm leading-6 text-[#d7d8dc]">{latestThreadPreview}</div>
        </div>
      ) : null}
      <div className="space-y-4">
        {fallbackRecommendationItems.map((item) => (
          <div key={item.title} className="rounded-[4px] border border-white/6 bg-[#17181d] p-4">
            <div className="font-medium text-white">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-[#7e8087]">{item.body}</p>
            <button className={`mt-4 h-10 w-full rounded-[4px] text-sm font-medium ${item.tone === 'success' ? 'bg-[#111216] text-[#53dca4]' : item.tone === 'warn' ? 'bg-[#111216] text-[#ffb24a]' : 'bg-[#111216] text-[#7e8087]'}`}>
              {item.button}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-white">
      <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
        <div className="flex items-center gap-8">
          <LogoLockup studio />
          <nav className="flex items-center gap-7 text-sm font-medium">
            <Link href="/app" className="text-[#8b8d94] hover:text-white">Dashboard</Link>
            <span className="text-[#53dca4]">Studio</span>
            <Link href="/studio/library" className="text-[#8b8d94] hover:text-white">Library</Link>
            <Link href="/studio/runs" className="text-[#8b8d94] hover:text-white">Runs</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-[4px] border border-white/8 bg-[#14151a] px-4 py-2 text-sm text-[#6e7078]">
            Search tests or logs...
          </div>
          <Link href="/app/settings" className="rounded-[4px] border border-white/8 bg-[#1b1c21] px-4 py-2 text-sm text-white transition hover:bg-[#27292f]">
            Settings
          </Link>
          <WorkspaceMenu
            userLabel={user.name ?? user.email ?? 'DioTest User'}
            userSubLabel={user.email}
            organizationName={bootstrap.organization?.name}
            projectName={bootstrap.project?.name}
            repositoryName={bootstrap.repositoryConnection?.fullName}
            integrationCount={bootstrap.integrations.length}
          />
        </div>
      </header>

      <StudioPanelsLayout
        left={leftSidebar}
        right={rightSidebar}
        center={(
          <section className="border-r border-white/6 px-5 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-[#7b7d85]">
            {recentRunLinks.slice(0, 3).map((run, index) => (
              <Link
                key={run.id}
                href={run.href}
                className={`rounded-[3px] px-3 py-2 ${index === 0 ? 'bg-[#15161a] text-white' : 'bg-[#15161a] text-[#7b7d85]'}`}
              >
                {run.label}
              </Link>
            ))}
          </div>
          {activeAnalysis ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">
                    <span>{activeAnalysis.pageType === 'pull_request' ? `Pull Request #${activeAnalysis.ref}` : activeAnalysis.ref.slice(0, 12)}</span>
                    <Badge tone="brand">Latest Analysis Run</Badge>
                  </div>
                  <h1 className="mt-3 max-w-[36rem] text-[2.65rem] font-bold leading-[1.02] tracking-[-0.06em] text-white">
                    {activeAnalysis.title || `${activeAnalysis.repo.split('/')[1] ?? activeAnalysis.repo} analysis overview`}
                  </h1>
                </div>
                <div className="flex items-start gap-3 flex-wrap">
                  <Link href={`/studio/runs/${activeAnalysis.id}`} className="flex h-11 items-center rounded-[4px] border border-white/8 bg-[#17181d] px-5 text-sm text-white hover:bg-[#1f2026] transition">Open Run</Link>
                  {bootstrap.project && (
                    <RescanPRButton
                      projectId={bootstrap.project.id}
                      repo={activeAnalysis.repo}
                      analysisRef={activeAnalysis.ref}
                      pageType={activeAnalysis.pageType}
                      sessionId={activeAnalysis.id}
                    />
                  )}
                  {bootstrap.project && runtimeRecommendations?.recommendations?.length ? (
                    <ApplyRecommendationsButton
                      projectId={bootstrap.project.id}
                      recommendations={runtimeRecommendations.recommendations.map((r) => ({
                        title: r.title,
                        body: r.body,
                        buttonLabel: r.buttonLabel,
                        actionType: r.actionType,
                        target: r.target,
                        priority: r.priority,
                        tone: r.tone,
                        readOnly: r.readOnly,
                        approvalRequired: r.approvalRequired,
                        rationale: r.rationale,
                        input: r.input,
                      }))}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Change Impact Analysis</div>
                  <div className="mt-5 space-y-4">
                    {activeAnalysisRisks.length > 0 ? activeAnalysisRisks.map((risk) => (
                      <div key={`${risk.area}-${risk.severity}`} className="rounded-[4px] border border-white/6 bg-[#111216] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{risk.area}</div>
                            <div className="mt-2 text-sm leading-6 text-[#7e8087]">{risk.why}</div>
                          </div>
                          <span className={`mt-1 h-3 w-3 rounded-full ${severityTone(risk.severity) === 'success' ? 'bg-[#53dca4]' : severityTone(risk.severity) === 'warn' ? 'bg-[#ffb24a]' : 'bg-[#ff8780]'}`} />
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[4px] border border-white/6 bg-[#111216] px-4 py-4 text-sm text-[#7e8087]">
                        No risk areas were stored for the latest analysis run.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Stability Score</div>
                    <div className={`mx-auto mt-6 flex h-40 w-40 items-center justify-center rounded-full border-[10px] ${riskScoreTone(activeAnalysis.riskScore).border} text-center`}>
                      <div>
                        <div className="text-[3rem] font-bold tracking-[-0.05em] text-white">{activeAnalysis.riskScore.toFixed(1)}</div>
                        <div className={`text-sm font-semibold uppercase tracking-[0.16em] ${riskScoreTone(activeAnalysis.riskScore).text}`}>{riskScoreTone(activeAnalysis.riskScore).label}</div>
                      </div>
                    </div>
                    <p className="mx-auto mt-4 max-w-[14rem] text-sm leading-6 text-[#8b8d94]">
                      {activeAnalysis.coverageLevel} coverage · {activeAnalysis.analysisQuality} quality · {activeAnalysisCases.length} manual cases generated.
                    </p>
                    <Link href={`/studio/runs/${activeAnalysis.id}`} className="mt-4 inline-flex h-10 items-center rounded-[4px] border border-white/8 px-4 text-sm text-white">View Details</Link>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                    {[
                      ['Risk Areas', String(((activeAnalysis.riskAreas as RiskArea[] | null) ?? []).length), 'Areas the agent marked for follow-up in the latest analysis.'],
                      ['Manual Cases', String(activeAnalysisCases.length), 'Library-ready cases extracted from the analysis run.'],
                      ['Queued Actions', String(actionState.actions.length), 'Agent actions currently recorded for this project.'],
                    ].map(([label, value, body]) => (
                      <div key={label} className="rounded-[4px] border border-white/6 bg-[#17181d] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">{label}</div>
                        <div className="mt-4 text-[2rem] font-bold tracking-[-0.05em] text-white">{value}</div>
                        <div className="mt-2 text-sm leading-6 text-[#7e8087]">{body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Analysis Trace</div>
                <div className="space-y-3">
                  {activeAnalysisRisks.flatMap((risk) => risk.evidence_files.slice(0, 2)).slice(0, 6).map((file, index) => (
                    <div key={`${file}-${index}`} className="rounded-[4px] border border-white/6 bg-[#17181d] px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-white">{file}</div>
                        <div className="flex min-w-[180px] items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-[#111216]">
                            <div className="h-2 rounded-full bg-[#53dca4]" style={{ width: `${Math.max(28, 100 - index * 12)}%` }} />
                          </div>
                          <div className="text-sm text-[#a7a9af]">{Math.max(28, 100 - index * 12)}%</div>
                          <div className="text-sm text-[#53dca4]">Tracked</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeAnalysisRisks.flatMap((risk) => risk.evidence_files.slice(0, 2)).length === 0 ? (
                    <div className="rounded-[4px] border border-white/6 bg-[#17181d] px-4 py-4 text-sm text-[#7e8087]">
                      No file-level trace data was stored for this run.
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : activeRecorder ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">
                    <span>Recorder Session</span>
                    <Badge tone="brand">Latest Flow Capture</Badge>
                  </div>
                  <h1 className="mt-3 max-w-[36rem] text-[2.65rem] font-bold leading-[1.02] tracking-[-0.06em] text-white">
                    {activeRecorder.name}
                  </h1>
                </div>
                <div className="flex gap-3">
                  <Link href={`/studio/runs/rec_${activeRecorder.id}`} className="flex h-11 items-center rounded-[4px] border border-white/8 bg-[#17181d] px-5 text-sm text-white">Open Session</Link>
                  <Link href="/studio/recorder" className="flex h-11 items-center rounded-[4px] bg-[#53dca4] px-5 text-sm font-semibold text-[#103223]">View Recorder</Link>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Recorded Flow Highlights</div>
                  <div className="mt-5 space-y-4">
                    {activeRecorderSteps.slice(0, 4).map((step) => (
                      <div key={step.id} className="rounded-[4px] border border-white/6 bg-[#111216] px-4 py-4">
                        <div className="font-medium text-white">{step.title}</div>
                        <div className="mt-2 text-sm leading-6 text-[#7e8087]">{step.action} · {step.url}</div>
                      </div>
                    ))}
                    {activeRecorderSteps.length === 0 ? (
                      <div className="rounded-[4px] border border-white/6 bg-[#111216] px-4 py-4 text-sm text-[#7e8087]">
                        No kept recorder steps are available yet.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Recorder Output</div>
                    <div className="mx-auto mt-6 flex h-40 w-40 items-center justify-center rounded-full border-[10px] border-[#8a7cf9] text-center">
                      <div>
                        <div className="text-[3rem] font-bold tracking-[-0.05em] text-white">{activeRecorderCases.length}</div>
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a7cf9]">Generated Cases</div>
                      </div>
                    </div>
                    <p className="mx-auto mt-4 max-w-[14rem] text-sm leading-6 text-[#8b8d94]">
                      {activeRecorder.domain} · {activeRecorder.screenshotsCaptured} screenshots · {activeRecorder.status} status.
                    </p>
                    <Link href={`/studio/runs/rec_${activeRecorder.id}`} className="mt-4 inline-flex h-10 items-center rounded-[4px] border border-white/8 px-4 text-sm text-white">View Details</Link>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                    {[
                      ['Kept Steps', String(activeRecorderSteps.length), 'Steps preserved in the stored recorder flow.'],
                      ['Screenshots', String(activeRecorder.screenshotsCaptured), 'Captured screenshots attached to this recorder session.'],
                      ['Manual Cases', String(activeRecorderCases.length), 'Cases already generated from the recorder flow.'],
                    ].map(([label, value, body]) => (
                      <div key={label} className="rounded-[4px] border border-white/6 bg-[#17181d] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">{label}</div>
                        <div className="mt-4 text-[2rem] font-bold tracking-[-0.05em] text-white">{value}</div>
                        <div className="mt-2 text-sm leading-6 text-[#7e8087]">{body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Flow Trace</div>
                <div className="space-y-3">
                  {activeRecorderSteps.slice(0, 6).map((step, index) => (
                    <div key={step.id} className="rounded-[4px] border border-white/6 bg-[#17181d] px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-white">{step.title}</div>
                        <div className="flex min-w-[180px] items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-[#111216]">
                            <div className="h-2 rounded-full bg-[#8a7cf9]" style={{ width: `${Math.max(32, 100 - index * 10)}%` }} />
                          </div>
                          <div className="text-sm text-[#a7a9af]">{step.action}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center rounded-[4px] border border-white/6 bg-[#17181d] text-center text-[#7e8087]">
              Connect the extension and create an analysis or recorder run to populate Studio.
            </div>
          )}

          {bootstrap.project ? (
            <div className="mt-8">
              <ActionConsole
                projectId={bootstrap.project.id}
                actions={actionState.actions}
                tasks={actionState.tasks}
                recorderSessions={recorderSessions.map((session) => ({
                  id: session.id,
                  name: session.name,
                  domain: session.domain,
                  status: session.status,
                  startedAt: session.startedAt.toISOString(),
                }))}
              />
            </div>
          ) : null}
          </section>
        )}
      />
    </main>
  );
}
