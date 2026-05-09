import Link from 'next/link';

import { SettingsIcon } from '@/components/settings/settings-icons';

export function SettingsOverviewStrip({
  organizationName,
  organizationMeta,
  projectName,
  projectMeta,
  repositoryName,
  repositoryMeta,
  integrationsValue,
  integrationsMeta,
}: {
  organizationName: string;
  organizationMeta: string;
  projectName: string;
  projectMeta: string;
  repositoryName: string;
  repositoryMeta: string;
  integrationsValue: string;
  integrationsMeta: string;
}) {
  const items = [
    { label: 'Organization', value: organizationName, meta: organizationMeta },
    { label: 'Project', value: projectName, meta: projectMeta },
    { label: 'Repository', value: repositoryName, meta: repositoryMeta },
    { label: 'Integrations', value: integrationsValue, meta: integrationsMeta },
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="settings-card p-5">
          <div className="settings-kicker">{item.label}</div>
          <div className="mt-3 text-xl font-semibold text-white">{item.value}</div>
          <div className="mt-2 text-sm text-[#8d8f96]">{item.meta}</div>
        </div>
      ))}
    </div>
  );
}

export function SettingsCardLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="settings-card group p-6 transition-all duration-150 hover:border-white/10 hover:bg-[#1f2127]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <p className="mt-2 text-sm leading-6 text-[#8d8f96]">{body}</p>
        </div>
        <SettingsIcon name="chevron" className="h-5 w-5 text-[#7c7e86] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#53dca4]" />
      </div>
    </Link>
  );
}
