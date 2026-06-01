import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RecorderStepList } from '@/components/studio/recorder-step-list';
import { RunAgentPanel } from '@/components/studio/run-agent-panel';
import { StudioShell } from '@/components/studio/studio-shell';
import { getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

// ─── Shared types ────────────────────────────────────────────────────────────

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
  steps?: string[];
  source?: 'flow' | 'page';
}

interface TestPlan {
  unit: Array<{ title: string }>;
  integration: Array<{ title: string }>;
  e2e: Array<{ title: string }>;
}

interface DebugInfo {
  warnings?: string[];
  filesDetected?: number;
  filesSent?: number;
  deepScanUsed?: boolean;
  extractionSource?: string;
}

interface RecorderStep {
  id: string;
  timestamp: string;
  action: string;
  title: string;
  selector?: string;
  url: string;
  value?: string;
  kept: boolean;
  screenshot?: { id: string; capturedAt: string; dataUrl: string };
}

interface RecorderPageSummary {
  id: string;
  url: string;
  title: string;
  capturedAt: string;
  summary: string;
  headings: string[];
  actions: string[];
  fields: string[];
  sections: string[];
}

interface GeneratedOutput {
  manual_test_cases: ManualTestCase[];
  playwright_scenario: {
    title: string;
    goal: string;
    steps: Array<{ action: string; target: string | null; assertion: string | null }>;
    notes: string[];
  };
}

type RuntimeStatus = {
  configured: boolean;
  provider: 'openai' | 'openrouter';
  model: string;
  missingKeyFor: 'openai' | 'openrouter' | null;
};

type AnalysisDetailProps = {
  organizationId: string;
  projectId: string;
  runtimeStatus: RuntimeStatus | null;
  session: {
    id: string;
    repo: string;
    ref: string;
    pageType: string;
    riskScore: number;
    coverageLevel: string;
    analysisQuality: string;
    mode: string;
    riskAreas: unknown;
    manualTestCases: unknown;
    testPlan: unknown;
    debug: unknown;
    createdAt: Date;
    title: string | null;
  };
  userInitials: string;
  userEmail: string;
};

type RecorderDetailProps = {
  organizationId: string;
  projectId: string;
  runtimeStatus: RuntimeStatus | null;
  session: {
    id: string;
    name: string;
    domain: string;
    startUrl: string;
    lastUrl: string;
    status: string;
    steps: unknown;
    pageSummaries: unknown;
    generated: unknown;
    warnings: unknown;
    screenshotsCaptured: number;
    startedAt: Date;
    stoppedAt: Date | null;
  };
  userInitials: string;
  userEmail: string;
};

// ─── Analysis detail view ────────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 7) return 'text-red-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-emerald-400';
}

function RiskScoreRing({ score }: { score: number }) {
  const borderColor = score >= 7 ? 'border-red-400' : score >= 4 ? 'border-amber-400' : 'border-emerald-400';
  const textColor = score >= 7 ? 'text-red-400' : score >= 4 ? 'text-amber-400' : 'text-emerald-400';
  const label = score >= 7 ? 'High Risk' : score >= 4 ? 'Medium Risk' : 'Low Risk';
  return (
    <div className="text-center">
      <div className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[8px] ${borderColor}`}>
        <div>
          <div className={`text-4xl font-bold tracking-tighter ${textColor}`}>{score.toFixed(1)}</div>
          <div className={`text-[10px] font-bold uppercase tracking-widest ${textColor} mt-0.5`}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function AnalysisDetail(props: AnalysisDetailProps) {
  const { organizationId, projectId, runtimeStatus, session, userInitials, userEmail } = props;
  const isPr = session.pageType === 'pull_request';
  const repoShort = session.repo.split('/')[1] ?? session.repo;
  const refLabel = isPr ? `PR #${session.ref}` : session.ref.slice(0, 12);
  const riskAreas = (session.riskAreas as RiskArea[]) ?? [];
  const manualCases = (session.manualTestCases as ManualTestCase[]) ?? [];
  const testPlan = (session.testPlan as TestPlan) ?? { unit: [], integration: [], e2e: [] };
  const debug = (session.debug as DebugInfo) ?? {};
  const highCount = riskAreas.filter((r) => r.severity === 'critical' || r.severity === 'high').length;
  const medCount = riskAreas.filter((r) => r.severity === 'medium').length;
  const lowCount = riskAreas.filter((r) => r.severity === 'low').length;
  const totalItems = riskAreas.length + manualCases.length;
  const topRisk = riskAreas[0];

  return (
    <StudioShell section="runs" userLabel={userEmail} userInitials={userInitials}>
      <div className="min-h-screen pb-10">
        {/* Header */}
        <section className="px-8 py-6 bg-[#131316] border-b border-zinc-800/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/studio/runs" className="text-[10px] uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>Runs
                </Link>
                <span className="text-zinc-700">/</span>
                <span className="text-[10px] uppercase tracking-widest font-medium text-zinc-500">{session.mode}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{repoShort} / {refLabel}</h1>
              <div className="flex flex-wrap items-center gap-5 mt-3 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {new Date(session.createdAt).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">source</span>
                  {session.coverageLevel} coverage · {session.analysisQuality} quality
                </span>
                {debug.filesDetected != null && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    {debug.filesSent}/{debug.filesDetected} files
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Bento summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Total Items', value: totalItems, barW: '100%', color: 'bg-zinc-500' },
              { label: 'High / Critical', value: highCount, barW: `${totalItems ? (highCount / totalItems) * 100 : 0}%`, color: 'bg-red-400' },
              { label: 'Medium', value: medCount, barW: `${totalItems ? (medCount / totalItems) * 100 : 0}%`, color: 'bg-amber-400' },
              { label: 'Low', value: lowCount, barW: `${totalItems ? (lowCount / totalItems) * 100 : 0}%`, color: 'bg-emerald-400' },
            ].map((c) => (
              <div key={c.label} className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{c.label}</p>
                <p className="text-3xl font-bold tracking-tighter text-zinc-50">{c.value}</p>
                <div className="h-1 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: c.barW }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs bar */}
        <div className="px-8 border-b border-zinc-800/30 bg-[#0e0e10] flex items-center gap-6">
          <button className="py-4 border-b-2 border-emerald-400 text-emerald-400 text-sm font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">grading</span>Risk Areas
          </button>
          <button className="py-4 border-b-2 border-transparent text-zinc-500 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">task_alt</span>Test Cases ({manualCases.length})
          </button>
          <button className="py-4 border-b-2 border-transparent text-zinc-500 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">science</span>
            Test Plan ({testPlan.unit.length + testPlan.integration.length + testPlan.e2e.length})
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[calc(100vh-420px)]">
          <div className="xl:col-span-8 p-8 space-y-3">
            {riskAreas.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600 gap-3">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
                <p className="text-sm">No risk areas detected.</p>
              </div>
            )}
            {riskAreas.map((risk, i) => {
              const isHigh = risk.severity === 'critical' || risk.severity === 'high';
              const borderClass = isHigh ? 'border-red-500/30' : risk.severity === 'medium' ? 'border-amber-500/20' : 'border-zinc-800/30';
              const badgeClass = risk.severity === 'critical' ? 'text-red-400 border-red-400/30 bg-red-400/10'
                : risk.severity === 'high' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
                : risk.severity === 'medium' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                : 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
              return (
                <div key={i} className={`bg-[#19191d] rounded-lg border overflow-hidden ${borderClass}`}>
                  <div className={`p-4 flex items-center justify-between ${isHigh ? 'bg-red-500/5' : ''}`}>
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`material-symbols-outlined text-[20px] ${isHigh ? 'text-red-400' : 'text-emerald-400'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isHigh ? 'error' : 'check_circle'}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-50">{risk.area}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{risk.evidence_files.slice(0, 2).join(', ') || 'No specific files'}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex-shrink-0 ${badgeClass}`}>{risk.severity}</span>
                  </div>
                  {risk.why && (
                    <div className="px-4 pb-4 border-t border-zinc-800/20 pt-3">
                      <p className="text-sm text-zinc-400 leading-relaxed">{risk.why}</p>
                      {risk.evidence_files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {risk.evidence_files.map((f, fi) => (
                            <span key={fi} className="px-2 py-0.5 bg-zinc-800/60 text-zinc-500 text-[11px] font-mono rounded">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {manualCases.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">task_alt</span>
                  Generated Test Cases ({manualCases.length})
                </div>
                {manualCases.map((tc) => (
                  <div key={tc.id} className="bg-[#19191d] rounded-lg border border-zinc-800/30 p-4 mb-2 flex items-start gap-4 hover:bg-[#1f1f24] transition-colors">
                    <span className="material-symbols-outlined text-emerald-400 text-[20px] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-600">{tc.id}</span>
                        <h3 className="text-sm font-medium text-zinc-200">{tc.title}</h3>
                      </div>
                      {tc.why && <p className="text-xs text-zinc-500 mt-1 leading-5">{tc.why}</p>}
                      {tc.evidence_files && tc.evidence_files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tc.evidence_files.map((f, fi) => (
                            <span key={fi} className="px-1.5 py-0.5 bg-zinc-800/60 text-zinc-600 text-[10px] font-mono rounded">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent panel */}
          <aside className="xl:col-span-4 bg-[#131316] border-l border-zinc-800/30 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-zinc-800/30 pb-4">
              <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center ring-1 ring-emerald-500/20">
                <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-50">DioTest Agent</h2>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Analysis Engine</p>
              </div>
            </div>
            <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
              <h3 className="text-xs font-bold text-zinc-50 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-amber-400">warning</span>Risk Score
              </h3>
              <RiskScoreRing score={session.riskScore} />
              <p className="text-xs text-zinc-500 text-center mt-3">{session.coverageLevel} coverage · {session.analysisQuality} quality</p>
            </div>
            {topRisk && (
              <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
                <h3 className="text-xs font-bold text-zinc-50 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-400">psychology</span>Top Risk
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  <span className="text-zinc-200">{topRisk.area}</span> — {topRisk.why}
                </p>
              </div>
            )}
            {debug.warnings && debug.warnings.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">info</span>Warnings
                </h3>
                {debug.warnings.map((w, i) => <p key={i} className="text-xs text-zinc-400 leading-5">{w}</p>)}
              </div>
            )}
            <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
              <h3 className="text-xs font-bold text-zinc-50 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">science</span>Test Plan
              </h3>
              {[
                { label: 'Unit', count: testPlan.unit.length, color: 'text-sky-400' },
                { label: 'Integration', count: testPlan.integration.length, color: 'text-purple-400' },
                { label: 'E2E', count: testPlan.e2e.length, color: 'text-emerald-400' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs py-1">
                  <span className={`font-medium ${row.color}`}>{row.label}</span>
                  <span className="text-zinc-400">{row.count} tests</span>
                </div>
              ))}
            </div>
            <RunAgentPanel
              organizationId={organizationId}
              projectId={projectId}
              runtimeStatus={runtimeStatus}
              prompt={`Inspect analysis run ${session.id} for ${session.repo} ${refLabel}. Summarize the highest-risk findings, the most important test gaps, and the next actions I should take in Studio.`}
              actions={[
                {
                  title: 'Generate tests from this analysis',
                  description: 'Use the current project and analysis context to expand the automated and manual test plan.',
                  type: 'generate_tests',
                  target: 'run',
                  targetId: session.id,
                  readOnly: true,
                  approvalRequired: false,
                  input: {
                    source: 'run_detail',
                    runId: session.id,
                    includeDeepScan: true,
                  },
                },
                {
                  title: 'Plan browser checks for this risk profile',
                  description: 'Build browser-visible validation steps focused on the risks surfaced in this analysis run.',
                  type: 'run_browser_checks',
                  target: 'run',
                  targetId: session.id,
                  readOnly: true,
                  approvalRequired: false,
                  input: {
                    source: 'run_detail',
                    runId: session.id,
                    focus: `Validate the browser-facing flows impacted by ${session.repo} ${refLabel}.`,
                  },
                },
                {
                  title: 'Create Jira follow-up',
                  description: 'Create an approval-gated Jira action for the most important analysis findings.',
                  type: 'sync_jira',
                  target: 'run',
                  targetId: session.id,
                  readOnly: false,
                  approvalRequired: true,
                  input: {
                    mode: 'create',
                    title: `Follow-up for ${repoShort} ${refLabel}`,
                    description: topRisk ? `${topRisk.area}: ${topRisk.why}` : `Review analysis run ${session.id} and address the highest-risk gaps.`,
                  },
                },
              ]}
            />
          </aside>
        </div>
      </div>
    </StudioShell>
  );
}

// ─── Recorder detail view ─────────────────────────────────────────────────────

function formatAction(action: string): string {
  const map: Record<string, string> = {
    click: 'Clicked', input: 'Typed', change: 'Changed', select: 'Selected',
    submit: 'Submitted', focus: 'Focused', blur: 'Blurred', scroll: 'Scrolled',
    keydown: 'Key press', navigation: 'Navigated',
  };
  return map[action] ?? action;
}

function RecorderDetail(props: RecorderDetailProps) {
  const { organizationId, projectId, runtimeStatus, session, userInitials, userEmail } = props;
  const steps = (session.steps as RecorderStep[]) ?? [];
  const pageSummaries = (session.pageSummaries as RecorderPageSummary[]) ?? [];
  const generated = session.generated as GeneratedOutput | null;
  const warnings = (session.warnings as string[]) ?? [];
  const keptSteps = steps.filter((s) => s.kept);
  const stepsWithScreenshots = steps.filter((s) => !!s.screenshot);
  const manualCases = generated?.manual_test_cases ?? [];
  const playwrightSteps = generated?.playwright_scenario.steps ?? [];

  return (
    <StudioShell section="runs" userLabel={userEmail} userInitials={userInitials}>
      <div className="min-h-screen pb-10">
        {/* Header */}
        <section className="px-8 py-6 bg-[#131316] border-b border-zinc-800/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/studio/runs" className="text-[10px] uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>Runs
                </Link>
                <span className="text-zinc-700">/</span>
                <span className="text-[10px] uppercase tracking-widest font-medium text-purple-400">Recorder Session</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{session.name}</h1>
              <div className="flex flex-wrap items-center gap-5 mt-3 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">language</span>{session.domain}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {new Date(session.startedAt).toLocaleString()}
                  {session.stoppedAt ? ` → ${new Date(session.stoppedAt).toLocaleString()}` : ''}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  session.status === 'generated' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                  : session.status === 'review' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                  : 'text-zinc-400 border-zinc-700/30 bg-zinc-800/20'
                }`}>{session.status}</span>
              </div>
            </div>
          </div>

          {/* Bento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Total Steps', value: steps.length, color: 'bg-zinc-500' },
              { label: 'Kept Steps', value: keptSteps.length, color: 'bg-purple-400' },
              { label: 'Screenshots', value: session.screenshotsCaptured, color: 'bg-blue-400' },
              { label: 'Page Summaries', value: pageSummaries.length, color: 'bg-emerald-400' },
            ].map((c) => (
              <div key={c.label} className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{c.label}</p>
                <p className="text-3xl font-bold tracking-tighter text-zinc-50">{c.value}</p>
                <div className="h-1 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: c.value > 0 ? '100%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs */}
        <div className="px-8 border-b border-zinc-800/30 bg-[#0e0e10] flex items-center gap-6">
          <button className="py-4 border-b-2 border-purple-400 text-purple-400 text-sm font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">list</span>Steps ({steps.length})
          </button>
          {generated && (
            <button className="py-4 border-b-2 border-transparent text-zinc-500 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">task_alt</span>Results ({manualCases.length} cases)
            </button>
          )}
          {pageSummaries.length > 0 && (
            <button className="py-4 border-b-2 border-transparent text-zinc-500 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">web</span>Pages ({pageSummaries.length})
            </button>
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[calc(100vh-420px)]">
          {/* Steps list */}
          <div className="xl:col-span-8 p-8">
            {warnings.length > 0 && (
              <div className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-400">
                {warnings.join(' · ')}
              </div>
            )}
            <RecorderStepList steps={steps} />
          </div>

          {/* Right panel */}
          <aside className="xl:col-span-4 bg-[#131316] border-l border-zinc-800/30 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-zinc-800/30 pb-4">
              <div className="h-10 w-10 bg-purple-500/10 rounded-lg flex items-center justify-center ring-1 ring-purple-500/20">
                <span className="material-symbols-outlined text-purple-400" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-50">DioTest Agent</h2>
                <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Recorder Intelligence</p>
              </div>
            </div>

            {/* Session overview */}
            <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30 space-y-2">
              <h3 className="text-xs font-bold text-zinc-50 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-purple-400">info</span>Session Overview
              </h3>
              {[
                { label: 'Start URL', value: session.startUrl },
                { label: 'Last URL', value: session.lastUrl },
                { label: 'Status', value: session.status },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{row.label}</p>
                  <p className="text-xs text-zinc-300 font-mono truncate mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>

            {/* Screenshots — delegated to client component for lightbox */}
            {stepsWithScreenshots.length > 0 && (
              <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
                <h3 className="text-xs font-bold text-zinc-50 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-blue-400">image</span>
                  Screenshots ({stepsWithScreenshots.length})
                </h3>
                <p className="text-[10px] text-zinc-600 mb-3">Click any screenshot in the steps list to zoom in.</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {stepsWithScreenshots.slice(0, 9).map((step) => (
                    step.screenshot?.dataUrl ? (
                      <img
                        key={step.id}
                        src={step.screenshot.dataUrl}
                        alt={step.title}
                        className="w-full aspect-video object-cover rounded border border-zinc-800/40"
                        loading="lazy"
                      />
                    ) : null
                  ))}
                </div>
              </div>
            )}

            {/* Generated results */}
            {generated && (
              <>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">task_alt</span>
                    Generated — {manualCases.length} Test Cases
                  </h3>
                  {manualCases.slice(0, 4).map((tc) => (
                    <div key={tc.id} className="py-2 border-b border-emerald-500/10 last:border-0">
                      <p className="text-xs text-zinc-300 font-medium">{tc.title}</p>
                      {tc.why && <p className="text-[11px] text-zinc-600 mt-0.5 leading-4">{tc.why}</p>}
                    </div>
                  ))}
                  {manualCases.length > 4 && (
                    <p className="text-[10px] text-zinc-600 mt-2">+{manualCases.length - 4} more cases</p>
                  )}
                </div>
                {playwrightSteps.length > 0 && (
                  <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30">
                    <h3 className="text-xs font-bold text-zinc-50 mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-sky-400">code</span>
                      Playwright Scenario ({playwrightSteps.length} steps)
                    </h3>
                    <p className="text-xs text-zinc-500 mb-2">{generated.playwright_scenario.goal}</p>
                    {playwrightSteps.slice(0, 5).map((s, i) => (
                      <div key={i} className="text-[11px] text-zinc-400 py-1 border-b border-zinc-800/20 last:border-0 font-mono">
                        {[s.action, s.target, s.assertion].filter(Boolean).join(' → ')}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!generated && (
              <div className="bg-[#19191d] p-4 rounded-lg border border-zinc-800/30 text-center">
                <span className="material-symbols-outlined text-3xl text-zinc-700 block mb-2">auto_awesome</span>
                <p className="text-xs text-zinc-500 leading-5">
                  No generated output yet. Open the session in the extension and click Generate Outputs.
                </p>
              </div>
            )}

            <RunAgentPanel
              organizationId={organizationId}
              projectId={projectId}
              runtimeStatus={runtimeStatus}
              prompt={`Inspect recorder session ${session.id} named "${session.name}" on ${session.domain}. Tell me what looks important in the steps, screenshots, and generated output, and what I should do next.`}
              actions={[
                {
                  title: 'Generate outputs from this recorder session',
                  description: 'Run hosted recorder generation from the stored session and refresh the generated cases and Playwright scenario.',
                  type: 'generate_from_recorder',
                  target: 'recorder_session',
                  targetId: session.id,
                  readOnly: true,
                  approvalRequired: false,
                  input: {
                    sessionId: session.id,
                    options: {
                      includeVision: true,
                      includePageSummaries: true,
                    },
                  },
                },
                {
                  title: 'Plan browser checks from this session',
                  description: 'Turn this recorder session into a browser QA plan for the same flow.',
                  type: 'run_browser_checks',
                  target: 'recorder_session',
                  targetId: session.id,
                  readOnly: true,
                  approvalRequired: false,
                  input: {
                    source: 'recorder_run_detail',
                    sessionId: session.id,
                    focus: `Validate the flow recorded in ${session.name} on ${session.domain}.`,
                  },
                },
              ]}
            />
          </aside>
        </div>
      </div>
    </StudioShell>
  );
}

// ─── Page router ──────────────────────────────────────────────────────────────

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, bootstrap, unavailable } = await requireOnboardedUser();

  if (unavailable || !bootstrap?.project) {
    return (
      <StudioShell section="runs" userLabel={user?.email ?? ''} userInitials="?">
        <div className="flex items-center justify-center h-[60vh] text-zinc-500">No project selected.</div>
      </StudioShell>
    );
  }

  const userInitials = (user.name ?? user.email ?? 'U').slice(0, 2).toUpperCase();
  const projectId = bootstrap.project.id;
  const organizationId = bootstrap.organization?.id;
  if (!organizationId) {
    return (
      <StudioShell section="runs" userLabel={user?.email ?? ''} userInitials={userInitials}>
        <div className="flex items-center justify-center h-[60vh] text-zinc-500">No organization selected.</div>
      </StudioShell>
    );
  }

  const settings = await getSettings({
    organizationId,
    projectId,
  }, {
    fresh: true,
  }).catch(() => null);
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

  // rec_ prefix = RecorderSession
  if (id.startsWith('rec_')) {
    const sessionId = id.slice(4);
    const session = await prisma.recorderSession.findFirst({
      where: { id: sessionId, projectId },
    });
    if (!session) notFound();
    return (
      <RecorderDetail
        organizationId={organizationId}
        projectId={projectId}
        runtimeStatus={runtimeStatus}
        session={session}
        userInitials={userInitials}
        userEmail={user.email ?? ''}
      />
    );
  }

  // Default = AnalysisSession
  const session = await prisma.analysisSession.findFirst({
    where: { id, projectId },
  });
  if (!session) notFound();
  return (
    <AnalysisDetail
      organizationId={organizationId}
      projectId={projectId}
      runtimeStatus={runtimeStatus}
      session={session}
      userInitials={userInitials}
      userEmail={user.email ?? ''}
    />
  );
}
