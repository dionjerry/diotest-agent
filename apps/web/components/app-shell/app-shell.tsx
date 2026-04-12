import type { ReactNode } from 'react';
import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LogoLockup } from '@/components/ui/logo';

export function AppShell({
  title,
  description,
  organization,
  project,
  children,
}: {
  title: string;
  description: string;
  organization: { name: string; slug: string } | null;
  project: { name: string; slug: string } | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_28%)] px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-line/80 bg-zinc-950/65 shadow-panel">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line/80 px-6 py-5 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/app">
              <LogoLockup />
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-muted md:flex">
              <Link href="/app" className="hover:text-text">Overview</Link>
              <Link href="/app/projects" className="hover:text-text">Projects</Link>
              <Link href="/app/settings" className="hover:text-text">Settings</Link>
              <Link href="/studio" className="hover:text-text">Studio</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {organization ? <Badge tone="brand">{organization.name}</Badge> : null}
            {project ? <Badge>{project.name}</Badge> : null}
            <SignOutButton variant="secondary" size="sm" />
          </div>
        </header>
        <div className="grid flex-1 gap-6 px-6 py-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
          <aside className="surface-card h-fit p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-soft">Current context</div>
            <div className="mt-4 space-y-4 text-sm text-zinc-200">
              <div>
                <div className="text-soft">Organization</div>
                <div className="mt-1 font-medium text-text">{organization?.name ?? 'Not configured'}</div>
                <div className="text-xs text-soft">{organization?.slug ?? 'finish onboarding'}</div>
              </div>
              <div>
                <div className="text-soft">Project</div>
                <div className="mt-1 font-medium text-text">{project?.name ?? 'Not configured'}</div>
                <div className="text-xs text-soft">{project?.slug ?? 'finish onboarding'}</div>
              </div>
            </div>
          </aside>
          <main>
            <div className="mb-6">
              <div className="label-kicker">Signed-in shell</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">{title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted">{description}</p>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function PlaceholderPanel({ title, body, badge }: { title: string; body: string; badge?: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
        </div>
        {badge ? <Badge tone="warn">{badge}</Badge> : null}
      </div>
    </Card>
  );
}
