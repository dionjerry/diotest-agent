import Link from 'next/link';

import { LogoLockup } from '@/components/ui/logo';

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-7xl flex-col gap-5 border-t border-line/70 px-6 py-8 text-sm text-muted lg:flex-row lg:items-center lg:justify-between lg:px-10">
      <LogoLockup subtle />
      <div className="flex flex-wrap gap-5">
        <Link href="/signup" className="hover:text-text">Create account</Link>
        <Link href="/login" className="hover:text-text">Sign in</Link>
        <a href="/app" className="hover:text-text">App shell</a>
      </div>
    </footer>
  );
}
