'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ActionState } from '@/app/actions';
import {
  completeSetupAction,
  createOrganizationAction,
  createProjectAction,
  finalizeOnboardingAction,
  saveRepositoryConnectionAction,
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

type RepositoryCandidate = {
  provider: 'GITHUB' | 'GITLAB';
  externalId: string;
  owner: string;
  namespace?: string;
  repositoryName: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
  installationId?: string;
  providerUser?: string;
};

type BranchCandidate = {
  name: string;
  isDefault: boolean;
};

function toRepositoryCandidate(connection: BootstrapResponse['repositoryConnection']): RepositoryCandidate | null {
  if (!connection) return null;

  return {
    provider: connection.provider,
    externalId: connection.externalId,
    owner: connection.owner,
    namespace: connection.namespace ?? undefined,
    repositoryName: connection.repositoryName,
    fullName: connection.fullName,
    repositoryUrl: connection.repositoryUrl,
    defaultBranch: connection.defaultBranch,
    installationId: connection.installationId ?? undefined,
    providerUser: connection.providerUser ?? undefined,
  };
}

export function RepositoryStepForm({
  projectId,
  existingConnection,
}: {
  projectId: string;
  existingConnection?: BootstrapResponse['repositoryConnection'];
}) {
  const [state, formAction] = useActionState(saveRepositoryConnectionAction, initialState);
  const existingCandidate = useMemo(() => toRepositoryCandidate(existingConnection ?? null), [existingConnection]);
  const [provider, setProvider] = useState<'GITHUB' | 'GITLAB'>(existingCandidate?.provider ?? 'GITHUB');
  const [repositories, setRepositories] = useState<RepositoryCandidate[]>(existingCandidate ? [existingCandidate] : []);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [repositoryError, setRepositoryError] = useState<string>();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string>(existingCandidate?.externalId ?? '');
  const [branches, setBranches] = useState<BranchCandidate[]>(
    existingCandidate ? [{ name: existingCandidate.defaultBranch, isDefault: true }] : [],
  );
  const [selectedBranch, setSelectedBranch] = useState(existingCandidate?.defaultBranch ?? 'main');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branchError, setBranchError] = useState<string>();

  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.externalId === selectedRepositoryId) ?? existingCandidate ?? null,
    [existingCandidate, repositories, selectedRepositoryId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRepositories() {
      setLoadingRepositories(true);
      setRepositoryError(undefined);
      try {
        const response = await fetch(`/api/repositories/list?provider=${provider}&projectId=${projectId}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          ok: boolean;
          message?: string;
          repositories?: RepositoryCandidate[];
        };

        if (!response.ok || !payload.ok || !payload.repositories) {
          throw new Error(payload.message ?? `Unable to load ${provider === 'GITHUB' ? 'GitHub' : 'GitLab'} repositories.`);
        }

        if (cancelled) return;
        const available = payload.repositories;
        setRepositories(
          existingCandidate && existingCandidate.provider === provider
            ? [existingCandidate, ...available.filter((repo) => repo.externalId !== existingCandidate.externalId)]
            : available,
        );
        setSelectedRepositoryId((current) => {
          if (current && available.some((repo) => repo.externalId === current)) return current;
          if (existingCandidate?.provider === provider) return existingCandidate.externalId;
          return available[0]?.externalId ?? '';
        });
      } catch (error) {
        if (cancelled) return;
        setRepositories(existingCandidate?.provider === provider && existingCandidate ? [existingCandidate] : []);
        setSelectedRepositoryId(existingCandidate?.provider === provider ? existingCandidate.externalId : '');
        setRepositoryError(error instanceof Error ? error.message : 'Unable to load repositories.');
      } finally {
        if (!cancelled) setLoadingRepositories(false);
      }
    }

    void loadRepositories();

    return () => {
      cancelled = true;
    };
  }, [existingCandidate, projectId, provider]);

  useEffect(() => {
    if (!selectedRepository) {
      setBranches([]);
      setSelectedBranch('main');
      return;
    }

    const repository = selectedRepository;
    let cancelled = false;
    async function loadBranches() {
      setLoadingBranches(true);
      setBranchError(undefined);

      const params = new URLSearchParams({
        provider,
        projectId,
        externalId: repository.externalId,
        owner: repository.owner,
        repositoryName: repository.repositoryName,
        defaultBranch: repository.defaultBranch,
      });

      try {
        const response = await fetch(`/api/repositories/branches?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          ok: boolean;
          message?: string;
          branches?: BranchCandidate[];
        };

        if (!response.ok || !payload.ok || !payload.branches) {
          throw new Error(payload.message ?? 'Unable to load branches.');
        }

        if (cancelled) return;
        const availableBranches = payload.branches;
        setBranches(availableBranches);
        setSelectedBranch((current) =>
          availableBranches.some((branch) => branch.name === current)
            ? current
            : availableBranches.find((branch) => branch.isDefault)?.name ?? availableBranches[0]?.name ?? repository.defaultBranch,
        );
      } catch (error) {
        if (cancelled) return;
        setBranches([{ name: repository.defaultBranch, isDefault: true }]);
        setSelectedBranch(repository.defaultBranch);
        setBranchError(error instanceof Error ? error.message : 'Unable to load branches.');
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, [projectId, provider, selectedRepository]);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="externalId" value={selectedRepository?.externalId ?? ''} />
      <input type="hidden" name="owner" value={selectedRepository?.owner ?? ''} />
      <input type="hidden" name="namespace" value={selectedRepository?.namespace ?? ''} />
      <input type="hidden" name="repositoryName" value={selectedRepository?.repositoryName ?? ''} />
      <input type="hidden" name="fullName" value={selectedRepository?.fullName ?? ''} />
      <input type="hidden" name="repositoryUrl" value={selectedRepository?.repositoryUrl ?? ''} />
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          {([
            ['GITHUB', 'GitHub', 'GitHub App install, repository selection, and automatic webhook setup.'],
            ['GITLAB', 'GitLab', 'GitLab OAuth plus a project/group token for webhook provisioning.'],
          ] as const).map(([value, label, copy]) => (
            <button
              key={value}
              type="button"
              onClick={() => setProvider(value)}
              className={`rounded-[8px] border px-5 py-4 text-left transition ${
                provider === value ? 'border-[#2f6d55] bg-[#131a17]' : 'border-white/6 bg-[#17181d] hover:bg-[#1b1c21]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-white">{label}</div>
                <div className={`rounded-[6px] px-3 py-1 text-xs font-semibold ${provider === value ? 'bg-[#123224] text-[#53dca4]' : 'bg-white/6 text-[#9ca0a8]'}`}>
                  {provider === value ? 'Selected' : 'Use'}
                </div>
              </div>
              <div className="mt-2 text-sm leading-6 text-[#7f828a]">{copy}</div>
            </button>
          ))}
        </div>

        <div className="rounded-[8px] border border-white/6 bg-[#17181d] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">
                {provider === 'GITHUB' ? 'Connect GitHub App' : 'Connect GitLab'}
              </div>
              <div className="mt-1 text-sm leading-6 text-[#7f828a]">
                {provider === 'GITHUB'
                  ? 'Install or authorize the DioTest GitHub App, then choose the repository DioTest should monitor.'
                  : 'Authorize GitLab, then choose the project and provide a project/group token for webhook creation.'}
              </div>
            </div>
            <a
              href={`/api/repositories/${provider === 'GITHUB' ? 'github' : 'gitlab'}/connect?projectId=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent('/onboarding?stage=repository')}`}
              className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#1f4d3d] px-5 text-sm font-semibold text-[#86d4af] transition hover:bg-[#245b47]"
            >
              {existingConnection?.provider === provider ? 'Reconnect' : `Connect ${provider === 'GITHUB' ? 'GitHub' : 'GitLab'}`}
            </a>
          </div>

          <div className="mt-5 rounded-[8px] border border-white/6 bg-[#131419] px-4 py-3 text-sm text-[#a6a9b0]">
            {loadingRepositories
              ? `Loading ${provider === 'GITHUB' ? 'repositories' : 'projects'}...`
              : repositoryError
                ? repositoryError
                : repositories.length
                  ? `${repositories.length} ${provider === 'GITHUB' ? 'repositories' : 'projects'} available for selection.`
                  : `No ${provider === 'GITHUB' ? 'repositories' : 'projects'} available yet. Connect the provider first.`}
          </div>

          <div className="mt-5 grid gap-3">
            {repositories.map((repo) => {
              const selected = repo.externalId === selectedRepositoryId;
              return (
                <label
                  key={`${repo.provider}:${repo.externalId}`}
                  className={`flex cursor-pointer items-center justify-between rounded-[8px] border px-5 py-5 transition ${
                    selected ? 'border-[#2f6d55] bg-[#1e2123]' : 'border-transparent bg-transparent hover:bg-[#1a1b20]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      name="repositoryPicker"
                      value={repo.externalId}
                      checked={selected}
                      onChange={() => setSelectedRepositoryId(repo.externalId)}
                      className="sr-only"
                    />
                    <div className="text-white/60">{provider === 'GITHUB' ? '⌘' : '◆'}</div>
                    <div>
                      <div className="text-[1.05rem] font-semibold text-white">{repo.fullName}</div>
                      <div className="text-sm text-[#72757d]">
                        {repo.repositoryUrl.replace('https://', '').replace('http://', '')} • default branch {repo.defaultBranch}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-[4px] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${selected ? 'bg-[#173c2e] text-[#79e6b7]' : 'bg-transparent text-[#c8cbd1]'}`}>
                    {selected ? 'Selected' : 'Choose'}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">Default branch</div>
            <select
              name="defaultBranch"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
              className="h-12 w-full rounded-[8px] border border-white/6 bg-[#131419] px-4 text-sm text-white outline-none"
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-[#72757d]">
              {loadingBranches ? 'Loading live branches...' : branchError ? branchError : 'Fetched from the selected provider.'}
            </div>
          </div>
          {provider === 'GITLAB' ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8f929b]">GitLab project/group token</div>
              <Input
                name="gitlabProjectToken"
                type="password"
                placeholder="Required for webhook provisioning"
                className="h-12 rounded-[8px] border-white/6 bg-[#131419]"
              />
              <div className="mt-2 text-xs leading-5 text-[#72757d]">
                Leave blank to keep the stored token. DioTest stores this encrypted and uses it only for project webhook management.
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-white/6 bg-[#17181d] px-5 py-4">
              <div className="text-sm font-semibold text-white">GitHub App installation</div>
              <div className="mt-2 text-sm leading-6 text-[#7f828a]">
                Repository access and webhook creation happen through the installed GitHub App. No personal access token is required.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[4px] border border-white/6 bg-[#17181d] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Automatic Webhook Configuration</div>
              <div className="mt-1 text-sm leading-7 text-[#7f828a]">
                DioTest will reconcile the provider webhook as part of Save & Connect and store its health for onboarding and settings.
              </div>
            </div>
            <div className="h-6 w-11 rounded-full bg-[#53dca4]/20 p-1">
              <div className="ml-auto h-4 w-4 rounded-full bg-[#53dca4]" />
            </div>
          </div>
          {existingConnection ? (
            <div className="mt-4 rounded-[6px] border border-white/6 bg-[#131419] px-4 py-3 text-sm text-[#aeb1b8]">
              Current connection: <span className="font-semibold text-white">{existingConnection.fullName}</span> • webhook{' '}
              <span className={existingConnection.webhookStatus === 'configured' ? 'text-[#53dca4]' : 'text-[#ffb24a]'}>
                {existingConnection.webhookStatus}
              </span>
              {existingConnection.webhookLastError ? ` • ${existingConnection.webhookLastError}` : ''}
            </div>
          ) : null}
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
