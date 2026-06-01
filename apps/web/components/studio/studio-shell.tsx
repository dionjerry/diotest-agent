import Link from 'next/link';
import type { ReactNode } from 'react';

type Section = 'workspace' | 'recorder' | 'library' | 'runs' | 'settings';

function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'text-emerald-400 border-b-2 border-emerald-400 pb-1 text-sm font-semibold transition-colors'
          : 'text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium'
      }
    >
      {label}
    </Link>
  );
}

function SidebarBtn({
  icon,
  href,
  active,
  filled = false,
}: {
  icon: string;
  href: string;
  active: boolean;
  filled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'p-3 text-emerald-400 bg-emerald-500/10 border-r-2 border-emerald-400 w-full flex justify-center'
          : 'p-3 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 w-full flex justify-center transition-all duration-200'
      }
    >
      <Icon name={icon} filled={active && filled} className="text-[20px]" />
    </Link>
  );
}

export function StudioShell({
  children,
  section,
  userLabel,
  userInitials,
}: {
  children: ReactNode;
  section: Section;
  userLabel: string;
  userInitials: string;
}) {
  return (
    <div className="min-h-screen bg-[#0e0e10] text-[#e7e4ec]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-14 bg-zinc-950 border-b border-zinc-800/50 tracking-tight text-zinc-50">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-tighter text-emerald-400">DioTest Studio</span>
          <nav className="hidden md:flex items-center gap-6 h-full">
            <NavLink href="/studio" label="PR Workspace" active={section === 'workspace'} />
            <NavLink href="/studio/recorder" label="Recorder" active={section === 'recorder'} />
            <NavLink href="/studio/library" label="Library" active={section === 'library'} />
            <NavLink href="/studio/runs" label="Runs" active={section === 'runs'} />
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-zinc-400 hover:bg-zinc-900 transition-all duration-200 rounded-md">
            <Icon name="search" className="text-[20px]" />
          </button>
          <button className="p-2 text-zinc-400 hover:bg-zinc-900 transition-all duration-200 rounded-md">
            <Icon name="notifications" className="text-[20px]" />
          </button>
          <Link href="/app/settings" className="p-2 text-zinc-400 hover:bg-zinc-900 transition-all duration-200 rounded-md">
            <Icon name="settings" className="text-[20px]" />
          </Link>
          <div className="h-8 w-8 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 ml-1 text-xs font-bold text-emerald-400">
            {userInitials}
          </div>
        </div>
      </header>

      {/* Vertical sidebar */}
      <aside className="fixed left-0 top-14 bottom-0 w-14 flex flex-col items-center py-3 z-40 bg-zinc-950 border-r border-zinc-800/50">
        <div className="flex flex-col gap-1 items-center w-full">
          <SidebarBtn icon="terminal" href="/studio" active={section === 'workspace'} />
          <SidebarBtn icon="fiber_manual_record" href="/studio/recorder" active={section === 'recorder'} />
          <SidebarBtn icon="inventory_2" href="/studio/library" active={section === 'library'} filled />
          <SidebarBtn icon="play_circle" href="/studio/runs" active={section === 'runs'} filled />
          <div className="my-1 border-t border-zinc-800/50 w-8" />
          <SidebarBtn icon="settings" href="/app/settings" active={section === 'settings'} />
        </div>
        <div className="mt-auto flex flex-col gap-1 items-center w-full pb-3">
          <Link href="/docs" className="p-3 text-zinc-500 hover:text-zinc-300 w-full flex justify-center">
            <Icon name="help_outline" className="text-[20px]" />
          </Link>
          <Link href="/docs" className="p-3 text-zinc-500 hover:text-zinc-300 w-full flex justify-center">
            <Icon name="description" className="text-[20px]" />
          </Link>
        </div>
      </aside>

      {/* Page content */}
      <div className="pl-14 pt-14 min-h-screen">
        {children}
      </div>

      {/* Status bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-6 bg-[#131316] border-t border-zinc-800/30 z-50 flex items-center justify-between px-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System: Operational
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-700">DioTest Studio</span>
        </div>
      </footer>
    </div>
  );
}
