import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { LogoLockup } from '@/components/ui/logo';

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Link href="/" className="shrink-0">
        <LogoLockup />
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
        <a href="#community" className="hover:text-text">Community Edition</a>
        <a href="#workflow" className="hover:text-text">Workflow</a>
        <a href="#future" className="hover:text-text">Future Platform</a>
      </nav>
      <div className="flex items-center gap-3">
        <Link href="/login" className="hidden text-sm text-muted hover:text-text md:inline-flex">Sign in</Link>
        <Link href="/signup">
          <Button size="sm">Get Started</Button>
        </Link>
      </div>
    </header>
  );
}
