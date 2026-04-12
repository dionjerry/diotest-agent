import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function FormMessage({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'muted';
  children?: ReactNode;
}) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm leading-6',
        tone === 'error' && 'border-danger/30 bg-danger/10 text-rose-200',
        tone === 'success' && 'border-brand/30 bg-brand/10 text-emerald-200',
        tone === 'muted' && 'border-line bg-zinc-950/50 text-muted',
      )}
    >
      {children}
    </div>
  );
}
