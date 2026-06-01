import Link from 'next/link';

import { StudioShell } from '@/components/studio/studio-shell';
import { requireOnboardedUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

interface RecorderStep {
  id: string;
  action: string;
  title: string;
  url: string;
  kept: boolean;
  screenshot?: { id: string; dataUrl: string };
}

interface ManualTestCase {
  id: string;
  title: string;
}

interface GeneratedOutput {
  manual_test_cases: ManualTestCase[];
  playwright_scenario: { title: string; steps: unknown[] };
}

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    recording: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles[status] ?? 'bg-zinc-800/40 text-zinc-500 border-zinc-700/30'}`}>
      {status}
    </span>
  );
}

export default async function RecorderPage() {
  const { user, bootstrap, unavailable } = await requireOnboardedUser();

  if (unavailable || !bootstrap?.project) {
    return (
      <StudioShell section="recorder" userLabel={user?.email ?? ''} userInitials="?">
        <div className="flex items-center justify-center h-[60vh] text-zinc-500">No project selected.</div>
      </StudioShell>
    );
  }

  const projectId = bootstrap.project.id;
  const userInitials = (user.name ?? user.email ?? 'U').slice(0, 2).toUpperCase();

  const sessions = await prisma.recorderSession.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  // Group by domain
  const byDomain = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = byDomain.get(s.domain) ?? [];
    list.push(s);
    byDomain.set(s.domain, list);
  }
  const domains = Array.from(byDomain.entries()).sort((a, b) =>
    (b[1][0]?.startedAt?.getTime() ?? 0) - (a[1][0]?.startedAt?.getTime() ?? 0)
  );

  return (
    <StudioShell section="recorder" userLabel={user.email ?? ''} userInitials={userInitials}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">

        {/* Sub-header */}
        <div className="px-8 py-5 bg-[#131316] border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{bootstrap.project.name}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Recorder</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                Recorder Sessions <span className="text-zinc-500 font-normal">({sessions.length})</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#19191d] rounded border border-zinc-800/40">
                <span className="material-symbols-outlined text-[14px]">domain</span>
                {domains.length} domains
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#19191d] rounded border border-zinc-800/40">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                {sessions.filter((s) => Boolean(s.generated)).length} generated
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6 pb-12">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-3">
              <span className="material-symbols-outlined text-5xl">videocam_off</span>
              <p className="text-sm">No recorder sessions yet.</p>
              <p className="text-xs text-zinc-700">Use the browser extension to record a session, then sync.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {domains.map(([domain, domainSessions]) => (
                <div key={domain}>
                  {/* Domain header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="material-symbols-outlined text-[16px] text-zinc-500">language</span>
                    <h2 className="text-sm font-bold text-zinc-300">{domain}</h2>
                    <span className="text-xs text-zinc-600">{domainSessions.length} session{domainSessions.length !== 1 ? 's' : ''}</span>
                    <div className="flex-1 h-px bg-zinc-800/50" />
                  </div>

                  {/* Sessions grid */}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {domainSessions.map((session) => {
                      const steps = (session.steps as unknown as RecorderStep[]) ?? [];
                      const keptSteps = steps.filter((s) => s.kept);
                      const generated = session.generated as GeneratedOutput | null;
                      const caseCount = generated?.manual_test_cases.length ?? 0;
                      const screenshots = steps.filter((s) => s.screenshot?.dataUrl && s.screenshot.dataUrl.length > 0);
                      const firstScreenshot = screenshots[0]?.screenshot;

                      return (
                        <Link
                          key={session.id}
                          href={`/studio/runs/rec_${session.id}`}
                          className="bg-[#19191d] border border-zinc-800/30 rounded-lg overflow-hidden hover:border-purple-500/30 hover:bg-[#1f1f24] transition-all group"
                        >
                          {/* Screenshot preview */}
                          <div className="aspect-video bg-zinc-950 relative overflow-hidden border-b border-zinc-800/30">
                            {firstScreenshot?.dataUrl && firstScreenshot.dataUrl.startsWith('/') ? (
                              <img
                                src={firstScreenshot.dataUrl}
                                alt={session.name}
                                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-zinc-800">videocam</span>
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              <StatusChip status={session.status} />
                            </div>
                            {session.screenshotsCaptured > 0 && (
                              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5 text-[10px] text-zinc-400">
                                <span className="material-symbols-outlined text-[12px]">image</span>
                                {session.screenshotsCaptured}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-zinc-50 truncate group-hover:text-white">{session.name}</h3>
                            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
                              <span>{steps.length} steps</span>
                              <span>·</span>
                              <span>{keptSteps.length} kept</span>
                              {caseCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-400">{caseCount} test cases</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-[10px] text-zinc-600">{timeAgo(session.startedAt)}</span>
                              <span className="material-symbols-outlined text-[16px] text-zinc-700 group-hover:text-purple-400 transition-colors">arrow_forward</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
