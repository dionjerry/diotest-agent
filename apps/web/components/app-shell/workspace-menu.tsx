'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WorkspaceMenuProps = {
  userLabel: string;
  userSubLabel?: string | null;
  organizationName?: string | null;
  projectName?: string | null;
  repositoryName?: string | null;
  integrationCount?: number;
  className?: string;
  compact?: boolean;
};

const menuLinks = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/studio', label: 'Studio' },
] as const;

function initialsFromLabel(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function WorkspaceMenu({
  userLabel,
  userSubLabel,
  organizationName,
  projectName,
  repositoryName,
  integrationCount = 0,
  className,
  compact = false,
}: WorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initials = initialsFromLabel(userLabel);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          compact
            ? 'flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/8 bg-[#17181d] text-left text-white transition hover:bg-[#24262d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#53dca4]/40'
            : 'flex h-10 items-center gap-3 rounded-full border border-white/8 bg-[#17181d] pl-2 pr-3 text-left text-white transition hover:bg-[#24262d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#53dca4]/40',
          open && 'border-[#53dca4]/40 bg-[#1d2622]',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={cn(
          'flex items-center justify-center rounded-full bg-[#53dca4]/15 text-xs font-semibold text-[#7be8bb]',
          compact ? 'h-8 w-8' : 'h-7 w-7',
        )}>
          {initials}
        </span>
        {!compact ? <span className="hidden min-w-0 md:block">
          <span className="block max-w-[11rem] truncate text-sm font-medium">{userLabel}</span>
          <span className="block max-w-[11rem] truncate text-xs text-[#8b8d94]">
            {projectName ?? organizationName ?? userSubLabel ?? 'Workspace'}
          </span>
        </span> : null}
        {!compact ? <span className="text-xs text-[#8b8d94]">{open ? '▲' : '▼'}</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[20rem] overflow-hidden rounded-[18px] border border-white/8 bg-[#121318] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/6 px-4 py-4">
            <div className="text-sm font-semibold text-white">{userLabel}</div>
            {userSubLabel ? <div className="mt-1 text-xs text-[#8b8d94]">{userSubLabel}</div> : null}
            <div className="mt-3 space-y-2 text-xs text-[#a2a4aa]">
              {organizationName ? <div>Organization: {organizationName}</div> : null}
              {projectName ? <div>Project: {projectName}</div> : null}
              {repositoryName ? <div>Repository: {repositoryName}</div> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={repositoryName ? 'success' : 'warn'}>
                {repositoryName ? 'Repository connected' : 'Repository pending'}
              </Badge>
              <Badge tone={integrationCount > 0 ? 'brand' : 'neutral'}>
                {integrationCount} integration{integrationCount === 1 ? '' : 's'}
              </Badge>
            </div>
          </div>

          <div className="px-2 py-2">
            {menuLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm text-[#d8d9de] transition hover:bg-white/[0.04] hover:text-white"
              >
                <span>{item.label}</span>
                <span className="text-xs text-[#73757c]">→</span>
              </Link>
            ))}
          </div>

          <div className="border-t border-white/6 px-3 py-3">
            <SignOutButton
              variant="ghost"
              className="h-10 w-full justify-center rounded-[12px] border border-white/8 bg-[#1b1c21] text-white hover:bg-[#27292f]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
