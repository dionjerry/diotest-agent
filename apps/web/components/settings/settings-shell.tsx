import type { ReactNode } from 'react';
import Link from 'next/link';

import { WorkspaceMenu } from '@/components/app-shell/workspace-menu';
import { SettingsIcon } from '@/components/settings/settings-icons';
import { SettingsNav } from '@/components/settings/settings-nav';
import { LogoLockup, LogoMark } from '@/components/ui/logo';
import type { BootstrapResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

const productTabs = [
  { href: '/app', label: 'Analysis', icon: 'analysis' },
  { href: '/studio', label: 'Recorder', icon: 'recorder' },
  { href: '/app/projects', label: 'Agents', icon: 'agents' },
  { href: '/app/settings', label: 'Settings', icon: 'settings', active: true },
] as const;

const railItems = [
  { href: '/app', label: 'Dashboard', icon: 'dashboard' },
  { href: '/app/projects', label: 'Projects', icon: 'project' },
  { href: '/studio', label: 'Studio', icon: 'recorder' },
  { href: '/docs', label: 'Documentation', icon: 'docs' },
  { href: '/app/settings', label: 'Settings', icon: 'settings', active: true },
] as const;

function HeaderIconButton({ icon, href }: { icon: 'notification' | 'help'; href: string }) {
  return (
    <Link
      href={href}
      className="flex h-9 w-9 items-center justify-center rounded-md text-[#8f9198] transition-all duration-150 hover:bg-[#17181d] hover:text-[#f5f5f6] active:scale-95"
    >
      <SettingsIcon name={icon} className="h-[18px] w-[18px]" />
    </Link>
  );
}

export function SettingsShell({
  user,
  bootstrap,
  children,
}: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  bootstrap: NonNullable<BootstrapResponse>;
  children: ReactNode;
}) {
  const runHref = bootstrap.project ? '/studio' : '/onboarding';

  return (
    <main className="min-h-screen overflow-hidden bg-[#0e0e10] text-[#e7e4ec]">
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-zinc-800/50 bg-zinc-950 px-4 text-zinc-400 backdrop-blur md:px-6">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/app/settings" className="text-lg font-bold tracking-tight text-zinc-50">
            DioTest Studio
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {productTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'border-b-2 pb-1 text-sm font-medium transition-colors duration-150',
                  ('active' in tab && tab.active)
                    ? 'border-emerald-500 text-zinc-50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-1 md:flex">
            <HeaderIconButton icon="notification" href="/app" />
            <HeaderIconButton icon="help" href="/help/setup" />
          </div>
          <WorkspaceMenu
            compact
            userLabel={user.name ?? user.email ?? 'DioTest User'}
            userSubLabel={user.email}
            organizationName={bootstrap.organization?.name}
            projectName={bootstrap.project?.name}
            repositoryName={bootstrap.repositoryConnection?.fullName}
            integrationCount={bootstrap.integrations.length}
          />
          <Link
            href={runHref}
            className="inline-flex h-10 items-center rounded-md bg-[#53dca4] px-4 text-sm font-bold text-[#053524] transition-all duration-150 hover:opacity-90 active:scale-95"
          >
            Run Test
          </Link>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-zinc-800/50 bg-zinc-950 lg:flex">
          <div className="p-5">
            <div className="rounded-lg bg-[#121216] p-4">
              <div className="flex items-center gap-3 rounded-lg bg-zinc-900/50 p-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                  <LogoMark />
                </div>
                <div>
                  <div className="text-sm font-semibold lowercase text-zinc-50">{bootstrap.project?.slug ?? 'diotest agent'}</div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">v2.4.0-stable</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Navigation</div>
            <nav className="space-y-1">
              {railItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-r-md rounded-l px-4 py-3 text-[15px] transition-all duration-150',
                    ('active' in item && item.active)
                      ? 'border-r-2 border-emerald-500 bg-[#1b1d21] font-medium text-emerald-400'
                      : 'text-zinc-500 hover:bg-zinc-900/30 hover:text-zinc-300',
                  )}
                >
                  <SettingsIcon name={item.icon} className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-zinc-800/50 p-5">
            <Link
              href="/onboarding"
              className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 transition-all duration-150 hover:bg-zinc-800 active:scale-95"
            >
              <span className="text-lg leading-none">+</span>
              <span>New Analysis</span>
            </Link>
            <div className="space-y-2">
              <Link href="/docs" className="flex items-center gap-3 px-3 py-1.5 text-zinc-500 transition hover:text-zinc-300">
                <SettingsIcon name="docs" className="h-4 w-4" />
                Documentation
              </Link>
              <Link href="/help/setup" className="flex items-center gap-3 px-3 py-1.5 text-zinc-500 transition hover:text-zinc-300">
                <SettingsIcon name="support" className="h-4 w-4" />
                Support
              </Link>
            </div>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto bg-[#0e0e10]">
          <div className="sticky top-0 z-20 border-b border-zinc-800/50 bg-[#0f1012]/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <LogoLockup studio subtle />
              <Link
                href={runHref}
                className="inline-flex h-9 items-center rounded-md bg-[#53dca4] px-3 text-sm font-bold text-[#053524] transition-all duration-150 active:scale-95"
              >
                Run Test
              </Link>
            </div>
            <SettingsNav mobile />
          </div>
          <div className="px-4 py-8 md:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
