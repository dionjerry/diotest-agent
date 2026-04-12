import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { Badge } from '@/components/ui/badge';
import { LogoLockup } from '@/components/ui/logo';
import { getActions, getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

export default async function ProjectsPage() {
  const { bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load project data.'} />
      </main>
    );
  }

  const [settings, actionState] = await Promise.all([
    getSettings({
      organizationId: bootstrap.organization?.id,
      projectId: bootstrap.project?.id,
    }),
    bootstrap.project ? getActions(bootstrap.project.id) : Promise.resolve({ actions: [], tasks: [] }),
  ]);

  const cards = [
    {
      name: bootstrap.project?.name ?? 'Project Alpha',
      slug: bootstrap.project?.slug ?? 'project-alpha',
      repo: bootstrap.githubConnection
        ? `${bootstrap.githubConnection.repositoryOwner}/${bootstrap.githubConnection.repositoryName}`
        : 'Repository pending',
      tests: Math.max(48, actionState.actions.length * 4 + 12),
      health: `${settings.ai.preferredProvider.toUpperCase()} • ${settings.ai.model || 'Default model'}`,
    },
    {
      name: 'Merchant Portal',
      slug: 'merchant-portal',
      repo: 'diotest-labs/studio-ui',
      tests: 215,
      health: '72.1% health',
    },
    {
      name: 'Auth Service',
      slug: 'auth-service',
      repo: 'diotest-labs/auth-service',
      tests: 112,
      health: '88.5% health',
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
              <div className="text-lg font-semibold text-white">{bootstrap.organization?.name ?? 'DioTest Org'}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#72747b]">
                Project Workspace
              </div>
            </div>
          </div>
          <nav className="space-y-1 px-4">
            {['Overview', 'Projects', 'Settings', 'Studio'].map((label) => (
              <div
                key={label}
                className={`rounded-[4px] px-4 py-3 text-sm font-medium ${
                  label === 'Projects' ? 'bg-[#1f2c25] text-[#53dca4]' : 'text-[#8b8d94] hover:bg-white/[0.03]'
                }`}
              >
                {label}
              </div>
            ))}
          </nav>
          <div className="mt-auto space-y-4 px-4 pb-5">
            <button className="flex h-11 w-full items-center justify-center rounded-[4px] bg-[#53dca4] text-sm font-semibold text-[#0f2d21]">
              + New Project
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
            <div className="flex items-center gap-7 text-sm font-medium">
              <Link href="/app" className="text-[#8b8d94] hover:text-white">Dashboard</Link>
              <span className="text-white">Projects</span>
              <Link href="/studio" className="text-[#8b8d94] hover:text-white">Studio</Link>
            </div>
            <SignOutButton variant="ghost" className="h-9 rounded-full border border-white/8 bg-[#1b1c21] px-3 text-white" />
          </header>

          <div className="space-y-6 px-6 py-6">
            <div>
              <h1 className="text-[2.35rem] font-bold tracking-[-0.05em] text-white">Projects</h1>
              <p className="mt-2 text-base leading-7 text-[#7e8087]">
                Manage the projects, repositories, and runtime contexts connected to this organization.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {cards.map((card, index) => (
                <div key={card.slug} className="rounded-[4px] border border-white/6 bg-[#17181d] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[1.6rem] font-semibold tracking-[-0.04em] text-white">{card.name}</div>
                      <div className="mt-1 text-sm text-[#6f7178]">{card.slug}</div>
                    </div>
                    <Badge tone={index === 0 ? 'success' : index === 1 ? 'danger' : 'warn'}>
                      {index === 0 ? 'ACTIVE' : index === 1 ? 'FAILED' : 'RUNNING'}
                    </Badge>
                  </div>
                  <div className="mt-5 space-y-3 text-sm">
                    <div className="text-[#8b8d94]">Repository</div>
                    <div className="text-white">{card.repo}</div>
                    <div className="pt-3 text-[#8b8d94]">Test cases</div>
                    <div className="text-white">{card.tests}</div>
                    <div className="pt-3 text-[#8b8d94]">Health / runtime</div>
                    <div className="text-white">{card.health}</div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button className="rounded-[4px] bg-[#53dca4] px-4 py-2 text-sm font-semibold text-[#103223]">Open</button>
                    <button className="rounded-[4px] border border-white/8 px-4 py-2 text-sm text-white">Settings</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
