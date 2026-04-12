import { ActionConsole } from '@/components/studio/action-console';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { LogoLockup } from '@/components/ui/logo';
import { getActions } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';
import { logServerEvent } from '@/lib/server-logger';

const leftMenu = [
  ['PR-123 Analysis', true],
  ['Login Page Recorder', false],
] as const;

const savedTests = ['Authentication Flow', 'Checkout Pipeline', 'Onboarding UI'];

export default async function StudioPage() {
  const startedAt = Date.now();
  const { user, bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load studio data.'} />
      </main>
    );
  }

  const actionState = bootstrap.project ? await getActions(bootstrap.project.id) : { actions: [], tasks: [] };
  const durationMs = Date.now() - startedAt;
  logServerEvent('studio.rendered', {
    status: 'success',
    userId: user.id,
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
    durationMs,
    slow: durationMs > 500,
  });

  const recommendationItems = [
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

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-white">
      <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
        <div className="flex items-center gap-8">
          <LogoLockup studio />
          <nav className="flex items-center gap-7 text-sm font-medium">
            <span className="text-[#8b8d94]">Dashboard</span>
            <span className="text-[#53dca4]">Studio</span>
            <span className="text-[#8b8d94]">Library</span>
            <span className="text-[#8b8d94]">Runs</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-[4px] border border-white/8 bg-[#14151a] px-4 py-2 text-sm text-[#6e7078]">
            Search tests or logs...
          </div>
          <div className="text-sm text-[#8b8d94]">{bootstrap.organization?.name ?? 'Organization Switcher'}</div>
          <span className="text-[#8b8d94]">◦</span>
          <span className="text-[#8b8d94]">⚙</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-[#17181d]">◦</span>
          <SignOutButton variant="ghost" className="h-9 rounded-full border border-white/8 bg-[#1b1c21] px-3 text-white hover:bg-[#27292f]" />
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[240px_minmax(0,1fr)_260px]">
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
              {leftMenu.map(([label, active]) => (
                <div
                  key={label}
                  className={`rounded-[4px] px-4 py-3 text-sm ${active ? 'bg-[#1f2c25] text-[#53dca4]' : 'text-[#8b8d94] hover:bg-white/[0.03]'}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Saved Tests</div>
            <div className="space-y-1">
              {savedTests.map((label) => (
                <div key={label} className="rounded-[4px] px-4 py-3 text-sm text-[#8b8d94] hover:bg-white/[0.03]">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto hidden lg:flex lg:h-[calc(100vh-520px)] lg:flex-col lg:justify-end">
            <div className="space-y-3 text-sm text-[#6f7178]">
              <div>◦ System Stable</div>
              <div>runner-aws-us-east-1</div>
            </div>
          </div>
        </aside>

        <section className="border-r border-white/6 px-5 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-[#7b7d85]">
            <span className="rounded-[3px] bg-[#15161a] px-3 py-2 text-white">PR-123 Analysis</span>
            <span className="rounded-[3px] bg-[#15161a] px-3 py-2 text-[#7b7d85]">Login Page Recorder</span>
            <span>+</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">
                <span>Pull Request #123</span>
                <Badge tone="brand">Active Agent Scan</Badge>
              </div>
              <h1 className="mt-3 max-w-[36rem] text-[2.65rem] font-bold leading-[1.02] tracking-[-0.06em] text-white">
                Feature: Multi-Factor Authentication Redesign
              </h1>
            </div>
            <div className="flex gap-3">
              <button className="h-11 rounded-[4px] border border-white/8 bg-[#17181d] px-5 text-sm text-white">Rescan PR</button>
              <button className="h-11 rounded-[4px] bg-[#53dca4] px-5 text-sm font-semibold text-[#103223]">Apply Recommendations</button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Change Impact Analysis</div>
              <div className="mt-5 space-y-4">
                {[
                  ['Validation Logic Updated', 'Agent verified new regex matches across 4 components.', 'success'],
                  ['Schema Mismatch in `user_profile.go`', 'Field `mfa_enabled` was expected but found `mfa_status`.', 'warn'],
                  ['Critical: Broken Auth Endpoint', 'POST /v/auth/verify returns 404. Existing tests will fail.', 'danger'],
                ].map(([title, body, tone]) => (
                  <div key={title} className="rounded-[4px] border border-white/6 bg-[#111216] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{title}</div>
                        <div className="mt-2 text-sm leading-6 text-[#7e8087]">{body}</div>
                      </div>
                      <span className={`mt-1 h-3 w-3 rounded-full ${tone === 'success' ? 'bg-[#53dca4]' : tone === 'warn' ? 'bg-[#ffb24a]' : 'bg-[#ff8780]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[4px] border border-white/6 bg-[#17181d] p-5 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Stability Score</div>
                <div className="mx-auto mt-6 flex h-40 w-40 items-center justify-center rounded-full border-[10px] border-[#ffb24a] text-center">
                  <div>
                    <div className="text-[3rem] font-bold tracking-[-0.05em] text-white">72</div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#ffb24a]">Medium Risk</div>
                  </div>
                </div>
                <p className="mx-auto mt-4 max-w-[14rem] text-sm leading-6 text-[#8b8d94]">
                  Coverage dropped by 4.2% due to new authentication paths.
                </p>
                <button className="mt-4 h-10 rounded-[4px] border border-white/8 px-4 text-sm text-white">View Details</button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  ['Regression Impact', '1,245', 'Tests affected across 3 environments.'],
                  ['Agent Efficiency', '94%', 'Auto-fix success rate for this PR.'],
                  ['CI Run Time', '12m 45s', 'Estimated duration for validation.'],
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
              {[
                ['AuthComponent.tsx', '100%', 'Valid', 'success'],
                ['LoginService.java', '65%', 'Coverage', 'warn'],
              ].map(([file, pct, label, tone]) => (
                <div key={file} className="rounded-[4px] border border-white/6 bg-[#17181d] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-white">{file}</div>
                    <div className="flex min-w-[180px] items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-[#111216]">
                        <div className={`h-2 rounded-full ${tone === 'success' ? 'bg-[#53dca4]' : 'bg-[#ffb24a]'}`} style={{ width: pct }} />
                      </div>
                      <div className="text-sm text-[#a7a9af]">{pct}</div>
                      <div className={`text-sm ${tone === 'success' ? 'text-[#53dca4]' : 'text-[#ffb24a]'}`}>{label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {bootstrap.project ? <div className="mt-8"><ActionConsole projectId={bootstrap.project.id} actions={actionState.actions} tasks={actionState.tasks} /></div> : null}
        </section>

        <aside className="bg-[#141519] px-5 py-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#53dca4] text-[#0f2d21]">✦</span>
            <div className="text-lg font-semibold text-white">Agent Recommendations</div>
          </div>
          <div className="space-y-4">
            {recommendationItems.map((item) => (
              <div key={item.title} className="rounded-[4px] border border-white/6 bg-[#17181d] p-4">
                <div className="font-medium text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#7e8087]">{item.body}</p>
                <button className={`mt-4 h-10 w-full rounded-[4px] text-sm font-medium ${item.tone === 'success' ? 'bg-[#111216] text-[#53dca4]' : item.tone === 'warn' ? 'bg-[#111216] text-[#ffb24a]' : 'bg-[#111216] text-[#7e8087]'}`}>
                  {item.button}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[4px] border border-white/6 bg-[#111216] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">Active Thought</div>
            <p className="mt-3 text-sm leading-7 text-[#d3d4d8]">
              I&apos;ve identified a possible null-pointer exception in the AuthMiddleware. Generating a patch proposal now...
            </p>
            <div className="mt-4 flex gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d6f76]">
              <span className="rounded-[3px] bg-[#1b1c21] px-2 py-1">#security</span>
              <span className="rounded-[3px] bg-[#1b1c21] px-2 py-1">#edge-case</span>
            </div>
          </div>

          <div className="mt-auto hidden lg:block">
            <div className="mt-10 rounded-[4px] border border-white/6 bg-[#111216] p-4">
              <div className="text-sm font-semibold text-[#53dca4]">DioAgent v2.4</div>
              <div className="mt-2 text-sm text-[#7e8087]">Monitoring PR-123...</div>
              <div className="mt-6 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#666870]">
                <span>CMD+K for command menu</span>
                <span>v0.14.2-beta</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
