import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const tones = {
  neutral: 'border-line bg-zinc-900/80 text-zinc-200',
  brand: 'border-brand/30 bg-brand/10 text-emerald-200',
  warn: 'border-warn/30 bg-warn/10 text-amber-200',
  danger: 'border-danger/30 bg-danger/10 text-rose-200',
  success: 'border-brand/30 bg-emerald-500/10 text-emerald-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}
