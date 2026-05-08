import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

const conceptPages = [
  {
    href: '/docs/concepts/repository-onboarding',
    label: 'Repository onboarding',
    copy: 'Covers provider selection, default branch meaning, webhook provisioning, and saved repository identity.',
  },
  {
    href: '/docs/concepts/settings-and-integrations',
    label: 'Settings and integrations',
    copy: 'Covers integration credentials, AI/runtime settings, and Step 5 extension connection behavior.',
  },
] as const;

export default function ConceptsIndexPage() {
  return (
    <InfoPageShell
      eyebrow="Concepts"
      title="Concepts Documentation"
      description="Concept pages explain what DioTest fields, states, and workflow steps mean. They complement setup guides without replacing them."
    >
      <p>
        Use concepts pages when the UI tells you what to do but you need the product meaning behind a setting, a badge,
        or a connection state.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {conceptPages.map((item) => (
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
