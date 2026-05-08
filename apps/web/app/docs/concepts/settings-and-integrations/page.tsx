import Link from 'next/link';

import { InfoPageShell } from '@/components/legal/info-page-shell';

export default function SettingsAndIntegrationsConceptPage() {
  return (
    <InfoPageShell
      eyebrow="Settings And Integrations"
      title="Settings And Integrations Concepts"
      description="These concepts explain what integration states, AI/runtime settings, and Step 5 extension connection fields mean inside DioTest."
    >
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">Saved config vs saved secret</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          Structured integration config holds visible settings like project keys or spreadsheet names. Sensitive
          credentials are stored separately and encrypted.
        </p>
      </div>
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">Extension installed vs extension connected</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          Installed means the browser extension is present on the page. Connected means the extension has successfully
          verified itself against this exact DioTest project using the Step 5 URL and key.
        </p>
      </div>
      <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
        <div className="text-sm font-semibold text-white">AI / Runtime settings</div>
        <p className="mt-2 text-sm leading-6 text-[#8c9098]">
          These settings control which provider DioTest should use and whether project-level encrypted provider keys are
          available for runtime analysis and generation.
        </p>
      </div>
      <Link href="/help/setup" className="inline-flex text-sm font-semibold text-[#53dca4] hover:text-[#7be8bb]">
        Need the exact credential source? Open Setup Help →
      </Link>
    </InfoPageShell>
  );
}
