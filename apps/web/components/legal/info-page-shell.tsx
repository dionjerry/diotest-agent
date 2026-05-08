import type { ReactNode } from 'react';
import Link from 'next/link';

import { LogoLockup } from '@/components/ui/logo';

export function InfoPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0d0d10] px-6 py-10 text-white">
      <div className="mx-auto max-w-[920px]">
        <Link href="/" className="inline-flex">
          <LogoLockup studio />
        </Link>
        <div className="mt-12 rounded-[10px] border border-white/6 bg-[#131419] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#53dca4]">{eyebrow}</div>
          <h1 className="mt-4 text-[2.4rem] font-bold tracking-[-0.05em] text-white">{title}</h1>
          <p className="mt-4 max-w-[44rem] text-base leading-8 text-[#8c9098]">{description}</p>
          <div className="mt-8 space-y-6 text-sm leading-7 text-[#b8bcc4]">{children}</div>
        </div>
      </div>
    </main>
  );
}
