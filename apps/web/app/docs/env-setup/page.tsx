import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

export default function EnvSetupDocPage() {
  return (
    <InfoPageShell
      eyebrow="Environment Setup"
      title="Environment Setup Guide"
      description="Use this page when you need the operational setup side of DioTest: environment variables, provider credentials, public URLs, and callback/webhook expectations."
    >
      <p>
        The repo-root <code className="rounded bg-black/30 px-1.5 py-0.5">.env</code> file remains the canonical local
        setup surface. Public deployment URLs, webhook endpoints, and provider callback URLs must be updated per
        environment when dev, staging, and production differ.
      </p>
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">Key setup areas</div>
        <ul className="mt-3 space-y-2 text-sm text-[#8c9098]">
          <li>Core app variables such as <code>NEXTAUTH_URL</code> and API base URLs</li>
          <li>GitHub App and GitLab provider credentials</li>
          <li>SMTP and OAuth configuration</li>
          <li>Environment-specific public URL and webhook alignment</li>
        </ul>
      </div>
      <Link href="/help/setup" className="inline-flex text-sm font-semibold text-[#53dca4] hover:text-[#7be8bb]">
        Back to Setup Help →
      </Link>
    </InfoPageShell>
  );
}
