import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

const links = [
  {
    href: '/docs/concepts',
    label: 'Concepts index',
    copy: 'The high-level map for onboarding meanings, settings semantics, and future workflow concepts.',
  },
  {
    href: '/docs/concepts/repository-onboarding',
    label: 'Repository onboarding concepts',
    copy: 'Explains default branch, webhook provisioning, GitHub App setup, and GitLab differences.',
  },
  {
    href: '/docs/concepts/settings-and-integrations',
    label: 'Settings and integrations concepts',
    copy: 'Explains connection states, extension setup, integration credentials, and runtime settings.',
  },
  {
    href: '/docs/env-setup',
    label: 'Environment setup guide',
    copy: 'Use this when you need to know where credential values come from or how deployment URLs are wired.',
  },
] as const;

export default function SetupHelpPage() {
  return (
    <InfoPageShell
      eyebrow="Setup Help"
      title="Setup Help"
      description="Use this page when onboarding or settings copy tells you what something means, but you need the full explanation or the exact setup instructions."
    >
      <p>
        DioTest keeps product semantics and credential setup separate on purpose. Concepts pages explain what fields
        and states mean. Setup docs explain how to obtain values and where to place them.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {links.map((item) => (
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
