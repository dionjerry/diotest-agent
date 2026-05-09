import { cn } from '@/lib/utils';

type SettingsIconName =
  | 'analysis'
  | 'recorder'
  | 'agents'
  | 'settings'
  | 'dashboard'
  | 'project'
  | 'organization'
  | 'integrations'
  | 'runtime'
  | 'docs'
  | 'support'
  | 'notification'
  | 'help'
  | 'chevron'
  | 'code'
  | 'chat'
  | 'clipboard'
  | 'lock'
  | 'globe'
  | 'server'
  | 'branch'
  | 'spark'
  | 'user'
  | 'danger'
  | 'status';

const iconPaths: Record<SettingsIconName, string[]> = {
  analysis: ['M4 5h7v7H4z', 'M13 5h7v4h-7z', 'M13 11h7v8h-7z', 'M4 14h7v5H4z'],
  recorder: ['M8 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M18 10l3-2v8l-3-2'],
  agents: ['M9 11V7a3 3 0 0 1 6 0v4', 'M7 11h10a2 2 0 0 1 2 2v4H5v-4a2 2 0 0 1 2-2z', 'M10 17v2', 'M14 17v2'],
  settings: ['M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5z', 'M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-1 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a2 2 0 0 1 0-4h.2a1 1 0 0 0 1-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H8a1 1 0 0 0 .6-.9V3a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7 1 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V8a1 1 0 0 0 .9.6H21a2 2 0 0 1 0 4h-.2a1 1 0 0 0-1 .7 1 1 0 0 0 .2 1.1z'],
  dashboard: ['M4 4h7v7H4z', 'M13 4h7v5h-7z', 'M13 11h7v9h-7z', 'M4 13h7v7H4z'],
  project: ['M4 7h16', 'M7 4v16', 'M10 10h10v10H10z'],
  organization: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M20 8a3 3 0 0 1 0 6'],
  integrations: ['M8 8h4v4H8z', 'M14 12h4v4h-4z', 'M12 10h2', 'M10 12v2'],
  runtime: ['M5 12h14', 'M12 5v14', 'M7 7l10 10'],
  docs: ['M6 4h9l3 3v13H6z', 'M15 4v4h4'],
  support: ['M9 9a3 3 0 1 1 6 0c0 2-3 2.5-3 5', 'M12 17h.01'],
  notification: ['M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8', 'M10 19a2 2 0 0 0 4 0'],
  help: ['M9.1 9a3 3 0 1 1 5.8 1c0 2-2.9 2.1-2.9 4', 'M12 17h.01'],
  chevron: ['M9 6l6 6-6 6'],
  code: ['M9 8l-4 4 4 4', 'M15 8l4 4-4 4'],
  chat: ['M5 6h14v10H8l-3 3z'],
  clipboard: ['M9 4h6v3H9z', 'M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2'],
  lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M6 11h12v9H6z'],
  globe: ['M12 3a9 9 0 1 0 0 18', 'M3 12h18', 'M12 3a15 15 0 0 1 0 18', 'M12 3a15 15 0 0 0 0 18'],
  server: ['M4 6h16v5H4z', 'M4 13h16v5H4z', 'M8 8h.01', 'M8 15h.01'],
  branch: ['M7 5v6a4 4 0 0 0 4 4h6', 'M15 5a2 2 0 1 0 0 .01', 'M17 15a2 2 0 1 0 0 .01', 'M7 19a2 2 0 1 0 0 .01'],
  spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 20a7 7 0 0 1 14 0'],
  danger: ['M12 8v5', 'M12 16h.01', 'M10.3 3.9 2 2 0 0 1 3.4 0l7.7 13.3A2 2 0 0 1 19.3 20H4.7a2 2 0 0 1-1.8-2.8z'],
  status: ['M5 12h14', 'M12 5v14'],
};

export function SettingsIcon({ name, className }: { name: SettingsIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4', className)}
      aria-hidden="true"
    >
      {iconPaths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
