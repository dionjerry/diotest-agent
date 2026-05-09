'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SettingsIcon } from '@/components/settings/settings-icons';
import { cn } from '@/lib/utils';

export const settingsSections = [
  { href: '/app/settings', label: 'General', icon: 'dashboard' },
  { href: '/app/settings/organization', label: 'Organization', icon: 'organization' },
  { href: '/app/settings/project', label: 'Project', icon: 'project' },
  { href: '/app/settings/integrations', label: 'Integrations', icon: 'integrations' },
  { href: '/app/settings/runtime', label: 'Runtime', icon: 'runtime' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/app/settings') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {settingsSections.map((section) => {
          const active = isActive(pathname, section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm transition-all duration-150',
                active
                  ? 'border-emerald-500/40 bg-[#1b1d21] text-[#53dca4]'
                  : 'border-transparent bg-[#16171b] text-[#8d8f96] hover:border-white/8 hover:text-white',
              )}
            >
              <SettingsIcon name={section.icon} className="h-3.5 w-3.5" />
              <span>{section.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {settingsSections.map((section) => {
        const active = isActive(pathname, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              'group flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] transition-all duration-150',
              active
                ? 'bg-[#1d1f24] text-[#53dca4]'
                : 'text-[#9a9ca3] hover:bg-[#17181d] hover:text-[#f2f2f4]',
            )}
          >
            <span className="flex items-center gap-3">
              <SettingsIcon name={section.icon} className={cn('h-4 w-4', active ? 'text-[#53dca4]' : 'text-[#70727a] group-hover:text-[#d8d9de]')} />
              <span className={cn(active && 'font-medium')}>{section.label}</span>
            </span>
            <SettingsIcon
              name="chevron"
              className={cn('h-3.5 w-3.5 transition-opacity', active ? 'opacity-100 text-[#53dca4]' : 'opacity-0 text-[#7b7d84] group-hover:opacity-100')}
            />
          </Link>
        );
      })}
    </nav>
  );
}
