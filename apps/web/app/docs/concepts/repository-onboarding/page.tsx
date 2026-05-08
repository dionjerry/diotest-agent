import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

export default function RepositoryOnboardingConceptPage() {
  return (
    <InfoPageShell
      eyebrow="Repository Onboarding"
      title="Repository Onboarding Concepts"
      description="Step 4 connects a real source repository to the current DioTest project so the app can store provider identity, baseline branch selection, and webhook health."
    >
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">What `Default branch` means</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          DioTest stores a baseline branch for the connected project. It does not rename any GitHub or GitLab branch.
          Choose the branch your team actually treats as the main integration or release baseline.
        </p>
      </div>
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">What `Automatic Webhook Configuration` means</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          DioTest creates or repairs the repository webhook when you save the connection. That is how later provider
          events can reach the correct project without manual webhook setup.
        </p>
      </div>
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">GitHub vs GitLab</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          GitHub uses the installed app for repository access and webhook management. GitLab uses OAuth plus a
          project/group token for webhook provisioning.
        </p>
      </div>
      <Link href="/help/setup" className="inline-flex text-sm font-semibold text-[#53dca4] hover:text-[#7be8bb]">
        Need the full setup path? Open Setup Help →
      </Link>
    </InfoPageShell>
  );
}
