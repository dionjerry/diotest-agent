import type { ReactNode } from 'react';

import { SettingsNav } from '@/components/settings/settings-nav';
import { cn } from '@/lib/utils';

export function SettingsPageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
  contentClassName,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-10 flex flex-col gap-6 border-b border-white/6 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <div className="text-sm font-medium text-[#53dca4]">{eyebrow}</div> : null}
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-white">{title}</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[#8d8f96]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 hidden md:col-span-3 md:block">
          <div className="sticky top-24">
            <SettingsNav />
          </div>
        </div>
        <div className={cn('col-span-12 space-y-8 md:col-span-9', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
