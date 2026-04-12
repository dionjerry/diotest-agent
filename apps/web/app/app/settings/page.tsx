import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { AiSettingsCard, IntegrationSecretsCard, OAuthSettingsCard } from '@/components/settings/settings-panels';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { LogoLockup } from '@/components/ui/logo';
import { getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

const productTabs = ['Analysis', 'Recorder', 'Agents', 'Settings'] as const;
const sideNav = ['Dashboard', 'PR Analysis', 'Live Session', 'Test Vault', 'Analytics'] as const;
const settingSections = ['General', 'Environment Variables', 'Integrations', 'Webhooks', 'Access Tokens'] as const;

export default async function SettingsPage() {
  const { bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load settings data.'} />
      </main>
    );
  }

  const settings = await getSettings({
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
  });

  const envRows = [
    ['API_SECRET_KEY', settings.oauth.clientSecretPreview || '••••••••••••••••'],
    ['BASE_URL', process.env.NEXTAUTH_URL || 'https://app.diotest.studio'],
    ['DB_PASSWORD', '••••••••••••••••'],
    ['MAX_RETRY_ATTEMPTS', '5'],
  ];
  const activeIntegrations = [
    bootstrap.githubConnection
      ? {
          name: 'GitHub',
          subtitle: `Connected as ${bootstrap.githubConnection.repositoryOwner}/${bootstrap.githubConnection.repositoryName}`,
          state: 'CONNECTED',
          action: 'Manage',
        }
      : null,
    ...settings.integrations.map((integration) => ({
      name: integration.type,
      subtitle: integration.health.isConfigured
        ? `${integration.name} is ready`
        : `Missing ${integration.health.missing.join(', ') || 'credentials'}`,
      state: integration.health.isConfigured ? 'READY' : 'INCOMPLETE',
      action: 'Configure',
    })),
  ].filter((item): item is { name: string; subtitle: string; state: string; action: string } => item !== null);

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-white">
      <div className="grid min-h-screen lg:grid-cols-[178px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-white/6 bg-[#101115]">
          <div className="border-b border-white/6 px-4 py-4">
            <LogoLockup subtle />
            <div className="mt-3 rounded-[4px] border border-white/6 bg-[#17181d] px-3 py-2 text-xs text-[#6d6f76]">
              {bootstrap.project?.slug ?? 'diotest-agent'}
            </div>
          </div>
          <div className="px-3 py-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#55575e]">Navigation</div>
            <div className="space-y-1">
              {sideNav.map((item) => (
                <div
                  key={item}
                  className={`rounded-[3px] px-3 py-2 text-sm ${item === 'Analytics' ? 'bg-[#1f2c25] text-[#53dca4]' : 'text-[#868890] hover:bg-white/[0.03]'}`}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto space-y-3 px-4 pb-4 text-sm text-[#6f7178]">
            <button className="flex h-10 w-full items-center justify-center rounded-[4px] border border-white/6 bg-[#17181d]">
              + New Analysis
            </button>
            <div>Documentation</div>
            <div>Support</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
            <div className="flex items-center gap-7 text-sm font-medium">
              <span className="text-white">DioTestStudio</span>
              {productTabs.map((tab) => (
                <span key={tab} className={tab === 'Settings' ? 'text-[#53dca4]' : 'text-[#8b8d94]'}>
                  {tab}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#8b8d94]">◦</span>
              <span className="text-[#8b8d94]">⚙</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-[#17181d]">◦</span>
              <button className="h-9 rounded-[4px] bg-[#53dca4] px-4 text-sm font-semibold text-[#103223]">Run Test</button>
              <SignOutButton variant="ghost" className="h-9 rounded-full border border-white/8 bg-[#1b1c21] px-3 text-white hover:bg-[#27292f]" />
            </div>
          </header>

          <div className="space-y-8 px-8 py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[2.4rem] font-bold tracking-[-0.05em] text-white">Project Settings</h1>
                <p className="mt-2 text-base leading-7 text-[#7e8087]">
                  Manage your agent workflows, connected platforms, and secure credentials.
                </p>
              </div>
              <div className="flex gap-3">
                <button className="h-10 rounded-[4px] border border-white/6 px-4 text-sm text-[#c7c8cc]">Export Settings</button>
                <button className="h-10 rounded-[4px] bg-[#53dca4] px-4 text-sm font-semibold text-[#103223] hover:bg-[#63e3af]">
                  Save Changes
                </button>
              </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-3">
                {settingSections.map((section) => (
                  <div
                    key={section}
                    className={`rounded-[3px] px-3 py-2 text-sm ${
                      section === 'Integrations' ? 'bg-[#1f2c25] text-[#53dca4]' : 'text-[#8d8f96]'
                    }`}
                  >
                    {section}
                  </div>
                ))}
              </div>

              <div className="space-y-8">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Active Integrations</h2>
                    <span className="text-sm text-[#53dca4]">{settings.integrations.length} configured</span>
                  </div>
                  <div className="space-y-3">
                    {activeIntegrations.map(({ name, subtitle, state, action }) => (
                      <div key={name} className="flex items-center justify-between rounded-[4px] border border-white/6 bg-[#17181d] px-5 py-4">
                        <div>
                          <div className="font-medium text-white">{name}</div>
                          <div className="mt-1 text-sm text-[#6f7178]">{subtitle}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-[3px] px-3 py-1 text-[11px] font-semibold ${state === 'READY' || state === 'CONNECTED' ? 'bg-[#1f2c25] text-[#53dca4]' : 'bg-[#3c2f17] text-[#ffb24a]'}`}>{state}</span>
                          <button className="rounded-[3px] bg-[#27292f] px-3 py-1.5 text-xs text-[#c9cacf]">{action}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Environment Variables</h2>
                    <button className="rounded-[3px] bg-[#1b1c21] px-3 py-1.5 text-xs text-white">+ New Variable</button>
                  </div>
                  <div className="overflow-hidden rounded-[4px] border border-white/6 bg-[#17181d]">
                    <div className="grid grid-cols-[1.15fr_1fr_140px] border-b border-white/6 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666870]">
                      <div>Key</div>
                      <div>Value</div>
                      <div>Last Updated</div>
                    </div>
                    {envRows.map(([key, value], index) => (
                      <div key={key} className="grid grid-cols-[1.15fr_1fr_140px] px-5 py-4 text-sm text-[#d4d4d8]">
                        <div>{key}</div>
                        <div className="text-[#8d8f96]">{value}</div>
                        <div className="text-[#6f7178]">{['Oct 24, 2023', 'Oct 20, 2023', 'Sep 19, 2023', 'Aug 30, 2023'][index]}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[4px] border border-[#5a2424] bg-[#1a1113] p-6">
                  <div className="text-lg font-semibold text-[#ff8780]">Dangerous Zone</div>
                  <p className="mt-2 max-w-[36rem] text-sm leading-6 text-[#9c7c7c]">
                    Permanently delete this project and all associated agent test data. This action is irreversible.
                  </p>
                  <button className="mt-4 rounded-[3px] bg-[#7b2d2d] px-4 py-2 text-sm font-semibold text-white">Delete Project</button>
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <OAuthSettingsCard oauth={settings.oauth} />
                  <AiSettingsCard organizationId={bootstrap.organization?.id} projectId={bootstrap.project?.id} ai={settings.ai} />
                </section>
                {bootstrap.project ? <IntegrationSecretsCard projectId={bootstrap.project.id} integrations={settings.integrations} /> : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
