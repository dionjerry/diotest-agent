import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { Badge } from '@/components/ui/badge';
import { LogoLockup } from '@/components/ui/logo';
import { getActions } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';
import { logServerEvent } from '@/lib/server-logger';

const dashboardNav = [
  ['Overview', true],
  ['Automation', false],
  ['Test Suites', false],
  ['Execution Logs', false],
] as const;

export default async function AppHomePage() {
  const startedAt = Date.now();
  const { user, bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load dashboard data.'} />
      </main>
    );
  }

  const actionState = bootstrap.project ? await getActions(bootstrap.project.id) : { actions: [], tasks: [] };
  const durationMs = Date.now() - startedAt;
  logServerEvent('dashboard.rendered', {
    status: 'success',
    userId: user.id,
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
    durationMs,
    slow: durationMs > 500,
  });

  const stableTasks = actionState.tasks.filter((task) => task.status === 'passed').length;
  const failedTasks = actionState.tasks.filter((task) => task.status === 'failed').length;
  const passRate = actionState.tasks.length ? Math.round((stableTasks / actionState.tasks.length) * 1000) / 10 : 98.2;
  const activityItems = [
    {
      title: bootstrap.githubConnection ? `feat: ${bootstrap.githubConnection.repositoryName}` : 'feat: optimize-worker-pools',
      author: 'alex_dev',
      ref: '#4202',
      risk: 'Critical',
      status: failedTasks > 0 ? 'Failed' : 'Approved',
      riskTone: 'danger' as const,
    },
    {
      title: 'refactor: logging-layer',
      author: 'sarah.m',
      ref: '#4198',
      risk: 'Medium',
      status: 'Approved',
      riskTone: 'warn' as const,
    },
    {
      title: 'docs: update-api-specs',
      author: 'j.smith',
      ref: '#4185',
      risk: 'Low',
      status: 'Merged',
      riskTone: 'success' as const,
    },
  ];

  const runItems = [
    { name: 'Main_Pipeline_#281', status: 'Passed', duration: '14m 22s', date: '2m ago', tone: 'success' as const },
    { name: 'Staging_Dry_Run_#44', status: failedTasks > 0 ? 'Failed' : 'Passed', duration: '03m 11s', date: '1h ago', tone: failedTasks > 0 ? 'danger' as const : 'success' as const },
    { name: 'Auth_Service_Audit', status: 'Running', duration: '08m 45s', date: 'Active', tone: 'warn' as const },
    { name: 'UI_Regression_Pack', status: 'Passed', duration: '32m 01s', date: '4h ago', tone: 'success' as const },
  ];

  const projectCards = [
    {
      name: bootstrap.project?.name ?? 'Core API',
      subtitle: bootstrap.project?.description || 'Cloud-native banking core',
      tests: actionState.actions.length + 482,
      health: `${passRate}%`,
      result: failedTasks > 0 ? 'FAILED (2)' : 'SUCCESS',
      tone: failedTasks > 0 ? 'danger' as const : 'success' as const,
    },
    {
      name: 'Merchant Portal',
      subtitle: 'Next.js internal dashboard',
      tests: 215,
      health: '72.1%',
      result: 'FAILED (2)',
      tone: 'danger' as const,
    },
    {
      name: 'Auth Service',
      subtitle: 'Identity & OAuth provider',
      tests: 112,
      health: '88.5%',
      result: 'IN PROGRESS',
      tone: 'warn' as const,
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-white">
      <div className="grid min-h-screen lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-white/6 bg-[#141519]">
          <div className="border-b border-white/6 px-5 py-5">
            <LogoLockup studio />
          </div>
          <div className="px-4 py-4">
            <div className="rounded-[4px] border border-white/6 bg-[#1a1b20] px-4 py-4">
              <div className="text-lg font-semibold text-white">{bootstrap.project?.name ?? 'Project Alpha'}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#72747b]">
                Testing Environment
              </div>
            </div>
          </div>
          <nav className="px-4">
            {dashboardNav.map(([label, active]) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-[4px] px-4 py-3 text-sm font-medium ${
                  active ? 'bg-[#1e2a24] text-[#53dca4]' : 'text-[#8b8d94] hover:bg-white/[0.03]'
                }`}
              >
                <span className={`h-3 w-3 rounded-[2px] ${active ? 'bg-[#53dca4]' : 'border border-white/15'}`} />
                {label}
              </div>
            ))}
          </nav>
          <div className="mt-auto space-y-4 px-4 pb-5">
            <button className="flex h-11 w-full items-center justify-center rounded-[4px] bg-[#53dca4] text-sm font-semibold text-[#0f2d21]">
              + New Test Case
            </button>
            <div className="space-y-3 text-sm text-[#7c7e86]">
              <div>Documentation</div>
              <div>Support</div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
            <div className="flex items-center gap-7 text-sm font-medium">
              <span className="text-white">Dashboard</span>
              <Link href="/studio" className="text-[#8b8d94] hover:text-white">Studio</Link>
              <span className="text-[#8b8d94]">Library</span>
              <span className="text-[#8b8d94]">Runs</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-[4px] border border-white/8 bg-[#1b1c21] px-4 py-2 text-sm text-[#d1d2d6]">
                Org: {bootstrap.organization?.name ?? 'Organization Switcher'}
              </div>
              <div className="text-[#8b8d94]">◦</div>
              <div className="text-[#8b8d94]">⚙</div>
              <SignOutButton variant="ghost" className="h-9 rounded-full border border-white/8 bg-[#1b1c21] px-3 text-white" />
            </div>
          </header>

          <div className="space-y-6 px-6 py-5">
            <div className="grid gap-4 xl:grid-cols-4">
              {[
                ['Total Tests', '1,284', '+12%↑', 'success'],
                ['Runs This Week', String(actionState.tasks.length || 42), 'Stable', 'neutral'],
                ['Pass Rate (%)', `${passRate}%`, '', 'success'],
                ['High-Risk PRs', String(Math.max(3, failedTasks)), 'Attention △', 'danger'],
              ].map(([label, value, sub, tone]) => (
                <div key={label} className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">{label}</div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className={`text-[2.3rem] font-bold tracking-[-0.05em] ${tone === 'danger' ? 'text-[#ff8780]' : 'text-white'}`}>
                      {value}
                    </div>
                    {sub ? <div className={`text-sm ${tone === 'success' ? 'text-[#53dca4]' : 'text-[#8b8d94]'}`}>{sub}</div> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr]">
              <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-lg font-semibold text-white">Recent PR Activity</div>
                  <div className="text-sm text-[#8b8d94]">View All</div>
                </div>
                <div className="space-y-5">
                  {activityItems.map((item) => (
                    <div key={item.ref} className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="mt-1 text-sm text-[#70727a]">
                          {item.author} • {item.ref}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone={item.riskTone}>{item.risk}</Badge>
                        <div className={`mt-2 text-sm ${item.status === 'Failed' ? 'text-[#ff8780]' : item.status === 'Merged' ? 'text-[#53dca4]' : 'text-[#e2e2e5]'}`}>
                          {item.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
                <div className="mb-5 text-lg font-semibold text-white">Recent Execution Runs</div>
                <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_110px] gap-3 border-b border-white/6 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">
                  <div>Run Name</div>
                  <div>Status</div>
                  <div>Duration</div>
                  <div>Date</div>
                </div>
                <div className="divide-y divide-white/6">
                  {runItems.map((run) => (
                    <div key={run.name} className="grid grid-cols-[minmax(0,1fr)_120px_120px_110px] gap-3 py-4 text-sm">
                      <div className="flex items-center gap-3 text-white">
                        <span className={`h-2.5 w-2.5 rounded-full ${run.tone === 'success' ? 'bg-[#53dca4]' : run.tone === 'danger' ? 'bg-[#ff8780]' : 'bg-[#ffb24a]'}`} />
                        {run.name}
                      </div>
                      <div>
                        <Badge tone={run.tone}>{run.status}</Badge>
                      </div>
                      <div className="text-[#a7a9af]">{run.duration}</div>
                      <div className="text-[#7c7e86]">{run.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4 text-lg font-semibold text-white">Project Overview</div>
              <div className="grid gap-4 xl:grid-cols-3">
                {projectCards.map((card) => (
                  <div key={card.name} className="rounded-[4px] border border-white/6 bg-[#17181d] p-6">
                    <div className="text-[1.6rem] font-semibold tracking-[-0.04em] text-white">{card.name}</div>
                    <div className="mt-1 text-sm text-[#6f7178]">{card.subtitle}</div>
                    <div className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between text-[#8b8d94]">
                        <span>Test Cases</span>
                        <span className="text-white">{card.tests}</span>
                      </div>
                      <div className="flex justify-between text-[#8b8d94]">
                        <span>Health Index</span>
                        <span className={card.tone === 'success' ? 'text-[#53dca4]' : card.tone === 'danger' ? 'text-[#ff8780]' : 'text-[#ffb24a]'}>
                          {card.health}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#8b8d94]">
                        <span>Last Run Result</span>
                        <span className={card.tone === 'success' ? 'text-[#53dca4]' : card.tone === 'danger' ? 'text-[#ff8780]' : 'text-[#ffb24a]'}>
                          {card.result}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
