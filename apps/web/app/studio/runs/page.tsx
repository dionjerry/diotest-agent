import Link from 'next/link';

import { StudioShell } from '@/components/studio/studio-shell';
import { requireOnboardedUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

function riskColor(score: number) {
  if (score >= 7) return 'text-red-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-emerald-400';
}

function riskLabel(score: number) {
  if (score >= 7) return 'High Risk';
  if (score >= 4) return 'Medium Risk';
  return 'Low Risk';
}

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function RunsPage() {
  const { user, bootstrap, unavailable } = await requireOnboardedUser();

  if (unavailable || !bootstrap?.project) {
    return (
      <StudioShell section="runs" userLabel={user?.email ?? ''} userInitials="?">
        <div className="flex items-center justify-center h-[60vh] text-zinc-500">No project selected.</div>
      </StudioShell>
    );
  }

  const projectId = bootstrap.project.id;
  const userInitials = (user.name ?? user.email ?? 'U').slice(0, 2).toUpperCase();

  const [analysisSessions, recorderSessions] = await Promise.all([
    prisma.analysisSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.recorderSession.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
  ]);

  const analysisCount = analysisSessions.length;
  const recorderCount = recorderSessions.length;
  const totalRuns = analysisCount + recorderCount;

  return (
    <StudioShell section="runs" userLabel={user.email ?? ''} userInitials={userInitials}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">

        {/* Sub-header */}
        <div className="px-8 py-5 bg-[#131316] border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{bootstrap.project.name}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Runs</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                Test Runs <span className="text-zinc-500 font-normal">({totalRuns})</span>
              </h1>
            </div>
            {/* Summary chips */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#19191d] rounded border border-zinc-800/40 text-zinc-400">
                <span className="material-symbols-outlined text-[14px]">analytics</span>
                {analysisCount} PR analysis
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#19191d] rounded border border-zinc-800/40 text-zinc-400">
                <span className="material-symbols-outlined text-[14px]">videocam</span>
                {recorderCount} recorder sessions
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 bg-[#131316] border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex gap-8">
            <button className="py-3 text-sm font-semibold border-b-2 border-emerald-400 text-emerald-400">All Runs</button>
            <button className="py-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300">PR Analysis</button>
            <button className="py-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300">Recorder</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6 pb-12 space-y-3">
          {totalRuns === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-3">
              <span className="material-symbols-outlined text-5xl">play_circle</span>
              <p className="text-sm">No runs yet. Connect the extension and run a PR analysis or record a session.</p>
            </div>
          ) : null}

          {/* Analysis sessions */}
          {analysisSessions.map((session) => {
            const caseCount = Array.isArray(session.manualTestCases) ? (session.manualTestCases as unknown[]).length : 0;
            const isPr = session.pageType === 'pull_request';
            const repoShort = session.repo.split('/')[1] ?? session.repo;
            const refLabel = isPr ? `PR #${session.ref}` : session.ref.slice(0, 12);

            return (
              <Link
                key={session.id}
                href={`/studio/runs/${session.id}`}
                className="flex items-center justify-between bg-[#19191d] border border-zinc-800/30 rounded-lg p-4 hover:bg-[#1f1f24] hover:border-zinc-700/40 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">analytics</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-50 truncate">{repoShort} / {refLabel}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${riskColor(session.riskScore)}`}>
                        {riskLabel(session.riskScore)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">commit</span>
                        {session.repo}
                      </span>
                      <span>·</span>
                      <span>{caseCount} test case{caseCount !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{session.mode}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  {/* Risk score ring */}
                  <div className="text-center hidden sm:block">
                    <div className={`text-2xl font-bold tracking-tighter ${riskColor(session.riskScore)}`}>
                      {session.riskScore.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600">Risk</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-zinc-400">{timeAgo(session.createdAt)}</div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Analysis</div>
                  </div>
                  <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-400 transition-colors">chevron_right</span>
                </div>
              </Link>
            );
          })}

          {/* Recorder sessions */}
          {recorderSessions.map((session) => {
            const stepCount = Array.isArray(session.steps) ? (session.steps as unknown[]).length : 0;
            const hasGenerated = Boolean(session.generated);

            return (
              <Link
                key={session.id}
                href={`/studio/runs/rec_${session.id}`}
                className="flex items-center justify-between bg-[#19191d] border border-zinc-800/30 rounded-lg p-4 hover:bg-[#1f1f24] hover:border-purple-500/20 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                    <span className="material-symbols-outlined text-purple-400 text-[18px]">videocam</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-50 truncate">{session.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${hasGenerated ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {hasGenerated ? 'Generated' : session.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">language</span>
                        {session.domain}
                      </span>
                      <span>·</span>
                      <span>{stepCount} steps</span>
                      {session.screenshotsCaptured > 0 && (
                        <>
                          <span>·</span>
                          <span>{session.screenshotsCaptured} screenshots</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-zinc-400">{timeAgo(session.startedAt)}</div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Recorder</div>
                  </div>
                  <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-400 transition-colors">chevron_right</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </StudioShell>
  );
}
