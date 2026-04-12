'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ActionState } from '@/app/actions';
import {
  completeSetupAction,
  createOrganizationAction,
  createProjectAction,
  finalizeOnboardingAction,
  saveGithubConnectionAction,
} from '@/app/actions';
import { IntegrationModal, type IntegrationProvider } from '@/components/integrations/integration-modal';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import type { BootstrapResponse } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const initialState: ActionState = {};

function FooterBar({
  backHref,
  stepLabel,
  skipHref,
  submitIdleLabel,
  submitPendingLabel,
}: {
  backHref?: string;
  stepLabel: string;
  skipHref?: string;
  submitIdleLabel: string;
  submitPendingLabel: string;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 px-2 pt-6">
      <div className="flex items-center gap-6 text-sm text-[#8c8f97]">
        {backHref ? (
          <Link href={backHref} className="inline-flex items-center gap-2 text-[#a0a3ab] transition hover:text-white">
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>
        ) : (
          <span />
        )}
        <span className="text-xs uppercase tracking-[0.12em] text-[#676973]">{stepLabel}</span>
      </div>
      <div className="flex items-center gap-4">
        {skipHref ? (
          <Link href={skipHref} className="text-sm text-[#9a9da5] transition hover:text-white">
            Skip for now
          </Link>
        ) : null}
        <SubmitButton
          idleLabel={submitIdleLabel}
          pendingLabel={submitPendingLabel}
          className="h-12 rounded-[8px] bg-[#53dca4] px-6 text-sm font-semibold text-[#063523] hover:bg-[#66e6b1] disabled:cursor-not-allowed disabled:bg-[#214e3d] disabled:text-[#5f8e77]"
        />
      </div>
    </div>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-white/6 bg-[#17181d] px-4 py-3 text-sm text-[#b6b8bf]">
      {children}
    </div>
  );
}

export function OrganizationStepForm({ suggestedSlug }: { suggestedSlug: string }) {
  const [state, formAction] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction}>
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Organization name</div>
          <Input name="name" placeholder="DioTest Labs" required className="h-12 rounded-[8px] border-white/6 bg-[#131419]" />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Organization slug</div>
          <Input
            name="slug"
            defaultValue={suggestedSlug}
            placeholder="diotest-labs"
            className="h-12 rounded-[8px] border-white/6 bg-[#131419]"
          />
        </div>
        <InfoChip>
          This becomes your workspace namespace for projects, settings, and synced recorder sessions.
        </InfoChip>
        <FormMessage>{state.error}</FormMessage>
      </div>
      <FooterBar
        stepLabel="Step 1 of 6: Organization"
        submitIdleLabel="Continue to Step 2"
        submitPendingLabel="Saving organization..."
      />
    </form>
  );
}

export function ProjectStepForm({ organizationId }: { organizationId: string }) {
  const [state, formAction] = useActionState(createProjectAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Project name</div>
          <Input name="name" placeholder="Alpha Core" required className="h-12 rounded-[8px] border-white/6 bg-[#131419]" />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Project slug</div>
          <Input name="slug" placeholder="alpha-core" className="h-12 rounded-[8px] border-white/6 bg-[#131419]" />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Description</div>
          <Textarea
            name="description"
            placeholder="Extension-first PR analysis and recorder workflows."
            className="min-h-28 rounded-[8px] border-white/6 bg-[#131419]"
          />
        </div>
        <FormMessage>{state.error}</FormMessage>
      </div>
      <FooterBar
        backHref="/onboarding"
        stepLabel="Step 2 of 6: Project"
        submitIdleLabel="Continue to Step 3"
        submitPendingLabel="Saving project..."
      />
    </form>
  );
}

export function SetupStepForm({
  organizationId,
  projectId,
  integrations = [],
}: {
  organizationId: string;
  projectId: string;
  integrations?: BootstrapResponse['integrations'];
}) {
  const [state, formAction] = useActionState(completeSetupAction, initialState);
  const normalizedExisting = useMemo(
    () => new Set(integrations.filter((i) => i.hasStoredSecret).map((i) => i.type.toUpperCase())),
    [integrations],
  );
  const integrationsByType = useMemo(
    () => Object.fromEntries(integrations.map((i) => [i.type, i])),
    [integrations],
  ) as Record<string, BootstrapResponse['integrations'][number] | undefined>;
  const router = useRouter();

  const [connected, setConnected] = useState<Record<string, boolean>>({
    JIRA: normalizedExisting.has('JIRA'),
    TRELLO: normalizedExisting.has('TRELLO'),
    GOOGLE_SHEETS: normalizedExisting.has('GOOGLE_SHEETS'),
  });

  // Which modal is open
  const [openModal, setOpenModal] = useState<IntegrationProvider | null>(null);

  function handleModalSaved(provider: IntegrationProvider) {
    setConnected((prev) => ({ ...prev, [provider]: true }));
    setOpenModal(null);
    router.refresh();
  }

  const INTEGRATIONS = [
    { key: 'JIRA' as IntegrationProvider, name: 'Jira', copy: 'Issue Management', icon: 'J', iconBg: 'bg-[#0052CC]' },
    { key: 'TRELLO' as IntegrationProvider, name: 'Trello', copy: 'Agile Board Sync', icon: 'T', iconBg: 'bg-[#0052CC]' },
    { key: 'GOOGLE_SHEETS' as IntegrationProvider, name: 'Google Sheets', copy: 'Ticket Export Table', icon: 'G', iconBg: 'bg-[#0F9D58]' },
  ] as const;

  const COMING_SOON = [
    { key: 'slack', name: 'Slack', copy: 'Notifications & Alerts' },
    { key: 'linear', name: 'Linear', copy: 'Streamlined Issues' },
  ] as const;

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="provider" value="openai" />
      <input type="hidden" name="environment" value="staging" />
      <input type="hidden" name="jiraProject" value={connected.JIRA ? 'Jira' : ''} />
      <input type="hidden" name="trelloBoard" value={connected.TRELLO ? 'Trello' : ''} />
      <input type="hidden" name="sheetsName" value={connected.GOOGLE_SHEETS ? 'Google Sheets' : ''} />

      <div className="space-y-4">
        {/* Active integrations */}
        <div className="grid gap-3 md:grid-cols-1">
          {INTEGRATIONS.map((integration) => {
            const isConnected = connected[integration.key];
            const existingConfig = integrationsByType[integration.key]?.configJson as Record<string, string> | undefined;
            return (
              <div
                key={integration.key}
                className={`flex items-center justify-between rounded-[8px] border px-5 py-4 transition ${
                  isConnected ? 'border-[#2f6d55] bg-[#131a17]' : 'border-white/6 bg-[#1a1b20]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${integration.iconBg} text-sm font-bold text-white`}>
                    {integration.icon}
                  </div>
                  <div>
                    <div className="text-[1rem] font-semibold text-white">{integration.name}</div>
                    <div className="text-sm text-[#7f828a]">{integration.copy}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#123224] px-3 py-1.5 text-xs font-semibold text-[#53dca4]">
                      <span>✓</span> Connected
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpenModal(integration.key)}
                    className={`rounded-[6px] px-4 py-2 text-sm font-semibold transition ${
                      isConnected
                        ? 'border border-white/8 text-[#9a9da5] hover:border-white/20 hover:text-white'
                        : 'bg-[#1e3d31] text-[#53dca4] hover:bg-[#243f35]'
                    }`}
                  >
                    {isConnected ? 'Reconfigure' : 'Configure →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming soon */}
        <div className="grid gap-3 md:grid-cols-2">
            {COMING_SOON.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-[8px] border border-white/6 bg-[#16171b] px-5 py-4 opacity-60">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/8 bg-[#24262b] text-sm text-white/60">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[1rem] font-semibold text-white">{item.name}</div>
                  <div className="text-sm text-[#7f828a]">{item.copy}</div>
                </div>
              </div>
              <span className="rounded-[6px] bg-white/6 px-3 py-1.5 text-xs font-semibold text-[#8c9098]">Coming Soon</span>
            </div>
          ))}
        </div>

        <div className="rounded-[8px] border border-white/6 bg-[#141519] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[#ebb04e]">ⓘ</span>
            <div className="text-sm leading-7 text-[#7f828a]">
              Click <strong className="text-white">Configure →</strong> on any integration to enter credentials, test the live connection, optionally create a sample record, and save the connection before continuing.
            </div>
          </div>
        </div>

        <FormMessage>{state.error}</FormMessage>
      </div>

      <FooterBar
        backHref="/onboarding"
        stepLabel="Step 3 of 6: System Integrations"
        skipHref="/onboarding?stage=repository"
        submitIdleLabel="Continue to Step 4"
        submitPendingLabel="Saving integrations..."
      />

      {/* Modals */}
      {openModal ? (
        <IntegrationModal
          projectId={projectId}
          provider={openModal}
          existingConfig={integrationsByType[openModal]?.configJson as Record<string, string> | undefined}
          hasStoredSecret={Boolean(integrationsByType[openModal]?.hasStoredSecret)}
          onClose={() => setOpenModal(null)}
          onSaved={() => handleModalSaved(openModal)}
        />
      ) : null}
    </form>
  );
}

export function GithubStepForm({
  projectId,
  repositoryOwner,
  repositoryName,
}: {
  projectId: string;
  repositoryOwner?: string;
  repositoryName?: string;
}) {
  const [state, formAction] = useActionState(saveGithubConnectionAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="repositoryOwner" value={repositoryOwner ?? 'diotest-labs'} />
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <Input
            name="repositorySearch"
            placeholder="Search repositories..."
            className="h-12 rounded-[4px] border-transparent bg-black/90 text-[#8c8f97] placeholder:text-[#565962]"
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-[4px] border border-white/8 bg-[#202126] text-[#53dca4]">
            ◈
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3">
            {[
              { owner: 'diotest-labs', name: 'core-engine', meta: 'Updated 2h ago • Public', selected: true },
              { owner: 'diotest-labs', name: 'studio-ui', meta: 'Updated 5d ago • Private', selected: false },
              { owner: 'diotest-labs', name: 'documentation', meta: 'Updated 12d ago • Public', selected: false },
            ].map((repo) => (
              <label
                key={repo.name}
                className={`flex cursor-pointer items-center justify-between rounded-[4px] border px-5 py-5 transition ${
                  repo.selected ? 'border-[#2f6d55] bg-[#1e2123]' : 'border-transparent bg-transparent hover:bg-[#1a1b20]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <input
                    type="radio"
                    name="repositoryName"
                    value={repo.name}
                    defaultChecked={repo.selected}
                    className="sr-only"
                  />
                  <div className="text-white/60">⌘</div>
                  <div>
                    <div className="text-[1.05rem] font-semibold text-white">
                      {repo.owner} / {repo.name}
                    </div>
                    <div className="text-sm text-[#72757d]">{repo.meta}</div>
                  </div>
                </div>
                <div
                  className={`rounded-[4px] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                    repo.selected ? 'bg-[#173c2e] text-[#79e6b7]' : 'bg-transparent text-[#c8cbd1]'
                  }`}
                >
                  {repo.selected ? 'Selected' : 'Connect'}
                </div>
              </label>
            ))}
          </div>
        </div>

        <Input type="hidden" name="defaultBranch" defaultValue="main" />
        <Input type="hidden" name="installationId" defaultValue="" />

        <div className="rounded-[4px] border border-white/6 bg-[#17181d] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Automatic Webhook Configuration</div>
              <div className="mt-1 text-sm leading-7 text-[#7f828a]">
                Allow DioTest to create webhooks and comment on Pull Requests for real-time status updates.
              </div>
            </div>
            <div className="h-6 w-11 rounded-full bg-[#53dca4]/20 p-1">
              <div className="ml-auto h-4 w-4 rounded-full bg-[#53dca4]" />
            </div>
          </div>
        </div>

        <FormMessage>{state.error}</FormMessage>
      </div>
      <FooterBar
        backHref="/onboarding?stage=integrations"
        skipHref="/onboarding?stage=extension"
        stepLabel="Step 4 of 6: Repository Connection"
        submitIdleLabel="Continue to Step 5"
        submitPendingLabel="Saving repository..."
      />
    </form>
  );
}

export function ExtensionSetupStep() {
  return (
    <div>
      <div className="rounded-[12px] border border-white/6 bg-[#1a1b20] p-10 shadow-[0_30px_90px_rgba(0,0,0,0.38)]">
        <div className="rounded-[8px] border border-white/5 bg-[#0f1013] px-8 py-12">
          <div className="mx-auto flex max-w-[280px] items-center justify-center gap-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-2xl text-white/80">
              ⇩
            </div>
            <div className="h-px w-12 bg-[#2f6d55]" />
            <div className="flex h-14 w-14 items-center justify-center rounded-[8px] border border-[#2f6d55] bg-[#123224] text-2xl text-[#53dca4]">
              ✦
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[620px] text-center">
          <h2 className="text-[2.2rem] font-bold tracking-[-0.05em] text-white">Install the DioTest Recorder</h2>
          <p className="mx-auto mt-4 max-w-[36rem] text-xl leading-9 text-[#8d9098]">
            The browser extension is the core of your automation workflow. It captures real UI interactions and
            transforms them into resilient, self-healing test scripts.
          </p>
          <div className="mt-7 inline-flex rounded-full border border-[#5f4719] bg-[#1e1708] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#ebb04e]">
            Waiting for extension detection...
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button type="button" className="rounded-[8px] border border-white/6 bg-[#101114] px-5 py-5 text-left transition hover:bg-[#14161a]">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7f828a]">Chrome Web Store</div>
              <div className="mt-1 text-xl font-semibold text-white">Install for Chrome</div>
            </button>
            <button type="button" className="rounded-[8px] border border-white/6 bg-[#101114] px-5 py-5 text-left transition hover:bg-[#14161a]">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7f828a]">Firefox Add-ons</div>
              <div className="mt-1 text-xl font-semibold text-white">Install for Firefox</div>
            </button>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-6">
          <div className="flex items-center gap-6 text-sm text-[#8c8f97]">
            <Link href="/onboarding?stage=repository" className="transition hover:text-white">
              Back
            </Link>
            <Link href="/onboarding?stage=finalize" className="transition hover:text-white">
              Skip for now
            </Link>
          </div>
          <Link
            href="/onboarding?stage=finalize"
            className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[#1f4d3d] px-6 text-sm font-semibold text-[#6ca88d] transition hover:bg-[#245b47] hover:text-[#86d4af]"
          >
            Continue →
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-[10px] border border-[#1e5a43] bg-[#0f231b] px-5 py-4 text-sm text-[#9ed7bb]">
        <span className="font-semibold text-[#53dca4]">Pro-tip:</span> After installation, pin the DioTest icon to your
        browser toolbar for quick access during testing sessions.
      </div>
    </div>
  );
}

export function FinalReviewStep({
  organizationName,
  projectName,
  projectId,
  repository,
  integrations,
}: {
  organizationName: string;
  projectName: string;
  projectId: string;
  repository: string;
  integrations: string[];
}) {
  const [, formAction] = useActionState(finalizeOnboardingAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Organization', organizationName],
            ['Project', projectName],
            ['Integrations', integrations.length ? integrations.join(', ') : 'Pending'],
            ['Repository', repository],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-white/6 bg-[#17181d] p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7b7e86]">{label}</div>
              <div className="mt-3 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/6 pb-4">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Deployment Specification</div>
              <div className="rounded bg-[#123224] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#53dca4]">Production-Ready</div>
            </div>
            <div className="space-y-4 text-sm text-[#b7b9c0]">
              <div className="flex justify-between gap-6"><span>Cluster Region</span><span className="font-mono text-white">us-east-1 (N. Virginia)</span></div>
              <div className="flex justify-between gap-6"><span>Instance Type</span><span className="font-mono text-white">dt-agent-v2-optimized</span></div>
              <div className="flex justify-between gap-6"><span>Base URL</span><span className="font-mono text-white">{repository}</span></div>
              <div className="flex justify-between gap-6"><span>Auth Protocol</span><span className="font-mono text-white">OAuth2 / SCIM 2.0</span></div>
            </div>

            <div className="mt-8 rounded-[8px] border border-white/6 bg-[#131419] p-5">
              <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-white">Initial Status Checks</div>
              <div className="space-y-3 text-sm text-[#b8bbc2]">
                {['Network Connectivity Check', 'Agent Environment Handshake', 'Repository Permission Scopes'].map((item) => (
                  <div key={item} className="flex items-center justify-between">
                    <span>{item}</span>
                    <span className="text-[#53dca4]">Verified</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[8px] border border-[#2f6d55] bg-[#22302b] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#0d6b49]/30 text-xl text-[#53dca4]">↗</div>
              <div className="mt-5 text-[2rem] font-bold tracking-[-0.05em] text-white">Ready to Launch</div>
              <p className="mt-3 text-sm leading-7 text-[#c3c7cc]">
                Your environment is fully validated. Upon initialization, DioTest will provision the resources and deploy the first agent swarm.
              </p>
              <SubmitButton
                idleLabel="Initialize Platform →"
                pendingLabel="Initializing platform..."
                className="mt-7 h-12 w-full rounded-[8px] bg-[#53dca4] px-6 text-sm font-semibold text-[#063523] hover:bg-[#66e6b1]"
              />
            </div>

            <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
              <div className="text-sm font-semibold text-[#ebb04e]">Post-Launch Note</div>
              <p className="mt-3 text-sm leading-7 text-[#9598a0]">
                Once initialized, you will be redirected to the Activity Monitor where you can watch the agent deployment in real time.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 px-2 pt-6">
        <div className="flex items-center gap-6 text-sm text-[#8c8f97]">
          <Link href="/onboarding?stage=extension" className="inline-flex items-center gap-2 text-[#a0a3ab] transition hover:text-white">
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>
          <span className="text-xs uppercase tracking-[0.12em] text-[#676973]">Step 6 of 6: Review</span>
        </div>
      </div>
    </form>
  );
}
