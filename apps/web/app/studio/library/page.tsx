import Link from 'next/link';

import { StudioShell } from '@/components/studio/studio-shell';
import { requireOnboardedUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

interface ManualTestCase {
  id: string;
  title: string;
  why?: string;
  evidence_files?: string[];
  steps?: string[];
  source?: 'flow' | 'page';
}

interface GeneratedOutput {
  manual_test_cases: ManualTestCase[];
}

type RiskLevel = 'high' | 'medium' | 'low';

interface LibraryEntry {
  key: string;
  caseId: string;
  title: string;
  sourcePath: string;
  risk: RiskLevel;
  sourceType: 'pr' | 'commit' | 'recorder';
  sourceLabel: string;
  sessionId: string;
  why?: string;
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    high: 'bg-red-500/10 text-red-400 border border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  };
  const labels: Record<RiskLevel, string> = { high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk' };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${styles[risk]}`}>
      {labels[risk]}
    </span>
  );
}

function SourceBadge({ type, label }: { type: 'pr' | 'commit' | 'recorder'; label: string }) {
  const icons: Record<string, string> = { pr: 'rebase', commit: 'commit', recorder: 'videocam' };
  return (
    <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs">
      <span className="material-symbols-outlined text-[14px]">{icons[type]}</span>
      {label}
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; risk?: string; page?: string }>;
}) {
  const { user, bootstrap, unavailable } = await requireOnboardedUser();

  if (unavailable || !bootstrap?.project) {
    return (
      <StudioShell section="library" userLabel={user?.email ?? ''} userInitials="?">
        <div className="flex items-center justify-center h-[60vh] text-zinc-500">No project selected.</div>
      </StudioShell>
    );
  }

  const params = await searchParams;
  const sourceFilter = params?.source ?? 'all';
  const riskFilter = params?.risk ?? 'all';
  const page = Math.max(1, Number(params?.page ?? '1'));
  const perPage = 20;

  const projectId = bootstrap.project.id;

  const [analysisSessions, recorderSessions] = await Promise.all([
    prisma.analysisSession.findMany({
      where: { projectId },
      select: { id: true, repo: true, ref: true, pageType: true, riskScore: true, manualTestCases: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recorderSession.findMany({
      where: { projectId, status: 'generated' },
      select: { id: true, name: true, domain: true, generated: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
    }),
  ]);

  const entries: LibraryEntry[] = [];

  for (const s of analysisSessions) {
    const cases = (s.manualTestCases as ManualTestCase[] | null) ?? [];
    const risk = riskFromScore(s.riskScore);
    const isPr = s.pageType === 'pull_request';
    const sourceType = isPr ? 'pr' : 'commit';
    const repoShort = s.repo.split('/')[1] ?? s.repo;
    const sourceLabel = isPr ? `PR #${s.ref}` : `${repoShort}:${s.ref.slice(0, 7)}`;

    cases.forEach((tc, idx) => {
      entries.push({
        key: `a-${s.id}-${idx}`,
        caseId: tc.id || `TC-${String(idx + 1).padStart(3, '0')}`,
        title: tc.title,
        sourcePath: tc.evidence_files?.[0] ?? s.repo,
        risk,
        sourceType,
        sourceLabel,
        sessionId: s.id,
        why: tc.why,
      });
    });
  }

  for (const s of recorderSessions) {
    const gen = s.generated as GeneratedOutput | null;
    const cases = gen?.manual_test_cases ?? [];

    cases.forEach((tc, idx) => {
      entries.push({
        key: `r-${s.id}-${idx}`,
        caseId: tc.id || `RC-${String(idx + 1).padStart(3, '0')}`,
        title: tc.title,
        sourcePath: s.domain,
        risk: 'low',
        sourceType: 'recorder',
        sourceLabel: 'Recorder',
        sessionId: s.id,
        why: tc.why,
      });
    });
  }

  const filtered = entries.filter((e) => {
    if (sourceFilter !== 'all' && e.sourceType !== sourceFilter) return false;
    if (riskFilter !== 'all' && e.risk !== riskFilter) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const userInitials = (user.name ?? user.email ?? 'U').slice(0, 2).toUpperCase();

  return (
    <StudioShell section="library" userLabel={user.email ?? ''} userInitials={userInitials}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">

        {/* Sub-header */}
        <div className="px-8 py-5 bg-[#131316] border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex justify-between items-end gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{bootstrap.project.name}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Library</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                Test Library <span className="text-zinc-500 font-normal">({total})</span>
              </h1>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {(['all', 'pr', 'commit', 'recorder'] as const).map((s) => (
              <Link
                key={s}
                href={`?source=${s}&risk=${riskFilter}&page=1`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors ${
                  sourceFilter === s
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#19191d] border-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {s === 'all' ? 'filter_list' : s === 'recorder' ? 'videocam' : s === 'pr' ? 'rebase' : 'commit'}
                </span>
                {s === 'all' ? 'All Sources' : s === 'pr' ? 'PR Analysis' : s === 'commit' ? 'Commit' : 'Recorder'}
              </Link>
            ))}
            <div className="w-px h-4 bg-zinc-800" />
            {(['all', 'high', 'medium', 'low'] as const).map((r) => (
              <Link
                key={r}
                href={`?source=${sourceFilter}&risk=${r}&page=1`}
                className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                  riskFilter === r
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#19191d] border-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r === 'all' ? 'All Risk' : `${r.charAt(0).toUpperCase() + r.slice(1)} Risk`}
              </Link>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 bg-[#131316] border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex gap-8">
            <button className="py-3 text-sm font-semibold border-b-2 border-emerald-400 text-emerald-400">All Tests</button>
            <button className="py-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300">Generated</button>
            <button className="py-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300">From PR</button>
            <button className="py-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300">From Recorder</button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 py-6 pb-12">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-3">
              <span className="material-symbols-outlined text-5xl">inventory_2</span>
              <p className="text-sm">No test cases yet. Run a PR analysis or generate from a recorder session.</p>
            </div>
          ) : (
            <div className="w-full bg-[#19191d] border border-zinc-800/30 rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#1f1f24] border-b border-zinc-800/30">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Test ID</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500">Title &amp; Path</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500">Risk</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500">Source</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/20">
                  {paginated.map((entry) => (
                    <tr key={entry.key} className="hover:bg-[#1f1f24] transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{entry.caseId}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-zinc-50 leading-snug">{entry.title}</span>
                          <span className="text-[11px] text-zinc-500 truncate max-w-xs">{entry.sourcePath}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RiskBadge risk={entry.risk} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SourceBadge type={entry.sourceType} label={entry.sourceLabel} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {entry.sourceType !== 'recorder' ? (
                            <Link
                              href={`/studio/runs/${entry.sessionId}`}
                              className="p-1.5 text-zinc-400 hover:text-emerald-400 transition-colors"
                              title="View run"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </Link>
                          ) : null}
                          <button className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors" title="Copy">
                            <span className="material-symbols-outlined text-[18px]">ios_share</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-between items-center text-[11px] font-medium uppercase tracking-widest text-zinc-500">
              <div>
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} tests
              </div>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <Link href={`?source=${sourceFilter}&risk=${riskFilter}&page=${page - 1}`} className="p-1.5 border border-zinc-800/40 rounded-md hover:bg-[#19191d] transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </Link>
                )}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`?source=${sourceFilter}&risk=${riskFilter}&page=${p}`}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-xs ${p === page ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'hover:bg-[#19191d] text-zinc-400'}`}
                  >
                    {p}
                  </Link>
                ))}
                {page < totalPages && (
                  <Link href={`?source=${sourceFilter}&risk=${riskFilter}&page=${page + 1}`} className="p-1.5 border border-zinc-800/40 rounded-md hover:bg-[#19191d] transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
