import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

const docs = [
  {
    href: '/docs/concepts',
    label: 'Concepts',
    copy: 'Understand repository onboarding, settings semantics, extension connection states, and future workflow concepts.',
  },
  {
    href: '/docs/env-setup',
    label: 'Environment setup',
    copy: 'Get the exact credential and environment-variable setup guidance for local, staging, and production deployments.',
  },
] as const;

export default function DocsIndexPage() {
  return (
    <InfoPageShell
      eyebrow="Docs"
      title="Product Documentation"
      description="These in-app pages surface the parts of the project docs that users need while onboarding or repairing settings."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[8px] border border-white/6 bg-[#17181d] p-5 transition hover:border-white/12 hover:bg-[#1b1c21]"
          >
            <div className="text-sm font-semibold text-white">{item.label}</div>
            <div className="mt-2 text-sm leading-6 text-[#8c9098]">{item.copy}</div>
          </Link>
        ))}
      </div>
    </InfoPageShell>
  );
}
