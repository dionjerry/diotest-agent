'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getExtensionConnectionPresentation,
  getRepositoryConnectionPresentation,
  type ConnectionPresentation,
} from '@/lib/connection-status';
import type { BranchCandidate, RepositoryCandidate } from '@/lib/repository-provider-api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import * as S from '@/components/onboarding/styles';
import { ExtensionInstallModal } from '@/components/onboarding/extension-install-modal';

const initialState: ActionState = {};

const INTEGRATIONS = [
  { key: 'JIRA' as IntegrationProvider, name: 'Jira', copy: 'Issue Management', icon: 'J', iconBg: 'bg-[#0052CC]' },
  { key: 'TRELLO' as IntegrationProvider, name: 'Trello', copy: 'Agile Board Sync', icon: 'T', iconBg: 'bg-[#0052CC]' },
  { key: 'GOOGLE_SHEETS' as IntegrationProvider, name: 'Google Sheets', copy: 'Ticket Export Table', icon: 'G', iconBg: 'bg-[#0F9D58]' },
] as const;

const COMING_SOON = [
  { key: 'slack', name: 'Slack', copy: 'Notifications & Alerts' },
  { key: 'linear', name: 'Linear', copy: 'Streamlined Issues' },
] as const;

const PROVIDER_OPTIONS = [
  ['GITHUB', 'GitHub', 'GitHub App install, repository selection, and automatic webhook setup.'],
  ['GITLAB', 'GitLab', 'GitLab OAuth plus a project/group token for webhook provisioning.'],
] as const;

const EXTENSION_INSTALL_OPTIONS = [
  { store: 'Chrome Web Store', label: 'Install for Chrome', ariaLabel: 'Install DioTest Recorder extension for Chrome' },
  { store: 'Firefox Add-ons', label: 'Install for Firefox', ariaLabel: 'Install DioTest Recorder extension for Firefox' },
] as const;

function FooterBar({
  backHref,
  stepLabel,
  skipHref,
  submitIdleLabel,
  submitPendingLabel,
  actionError,
  helperText,
}: {
  backHref?: string;
  stepLabel: string;
  skipHref?: string;
  submitIdleLabel?: string;
  submitPendingLabel?: string;
  actionError?: string;
  helperText?: string;
}) {
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionError || !errorRef.current) return;
    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    errorRef.current.focus();
  }, [actionError]);

  return (
    <div className="mt-10 border-t border-white/6 px-2 pt-6">
      {actionError ? (
        <div ref={errorRef} tabIndex={-1} className="mb-4 outline-none">
          <FormMessage>{actionError}</FormMessage>
        </div>
      ) : null}
      {helperText ? (
        <div className="mb-4 rounded-[8px] border border-white/6 bg-[#141519] px-4 py-3 text-sm leading-6 text-[#a7abb3]">
          {helperText}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-[#8c8f97]">
          {backHref ? (
            <Link href={backHref} className={S.backLink}>
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </Link>
          ) : null}
          <span className={S.stepLabel}>{stepLabel}</span>
        </div>
        {(submitIdleLabel || skipHref) ? (
          <div className="flex items-center gap-4">
            {skipHref ? (
              <Link href={skipHref} className={S.skipLink}>
                Skip for now
              </Link>
            ) : null}
            {submitIdleLabel && submitPendingLabel ? (
              <SubmitButton
                idleLabel={submitIdleLabel}
                pendingLabel={submitPendingLabel}
                className={S.submitBtn}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(S.panelSurface, 'px-4 py-3 text-sm text-[#b6b8bf]')}>
      {children}
    </div>
  );
}

function LearnMoreLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#53dca4] hover:text-[#7be8bb]">
      Learn what this means
    </Link>
  );
}

function StatusBadge({ status }: { status: ConnectionPresentation }) {
  const toneClasses = {
    neutral: 'border-white/10 bg-white/5 text-[#c6cad2]',
    brand: 'border-[#245b47] bg-[#123224] text-[#79e6b7]',
    warn: 'border-[#6a4c19] bg-[#21180b] text-[#ffd28a]',
    danger: 'border-[#6a2c2c] bg-[#231414] text-[#ffb4b4]',
    success: 'border-[#245b47] bg-[#123224] text-[#79e6b7]',
  } as const;

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]', toneClasses[status.tone])}>
      {status.label}
    </span>
  );
}

export function OrganizationStepForm({ suggestedSlug }: { suggestedSlug: string }) {
  const [state, formAction] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction}>
      <div className="space-y-6">
        <div>
          <div className={S.fieldLabel}>Organization name</div>
          <Input
            name="name"
            placeholder="DioTest Labs"
            required
            aria-label="Organization name"
            className={S.inputField}
          />
        </div>
        <div>
          <div className={S.fieldLabel}>Organization slug</div>
          <Input
            name="slug"
            defaultValue={suggestedSlug}
            placeholder="diotest-labs"
            aria-label="Organization slug"
            className={S.inputField}
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
        actionError={state.error}
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
          <div className={S.fieldLabel}>Project name</div>
          <Input name="name" placeholder="Alpha Core" required aria-label="Project name" className={S.inputField} />
        </div>
        <div>
          <div className={S.fieldLabel}>Project slug</div>
          <Input name="slug" placeholder="alpha-core" aria-label="Project slug" className={S.inputField} />
        </div>
        <div>
          <div className={S.fieldLabel}>Description</div>
          <Textarea
            name="description"
            placeholder="Extension-first PR analysis and recorder workflows."
            aria-label="Description"
            className={S.textareaField}
          />
        </div>
        <FormMessage>{state.error}</FormMessage>
      </div>
      <FooterBar
        backHref="/onboarding"
        stepLabel="Step 2 of 6: Project"
        submitIdleLabel="Continue to Step 3"
        submitPendingLabel="Saving project..."
        actionError={state.error}
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
  const integrationsByType = useMemo(
    () => Object.fromEntries(integrations.map((i) => [i.type, i])),
    [integrations],
  ) as Record<string, BootstrapResponse['integrations'][number] | undefined>;
  const router = useRouter();

  const [connected, setConnected] = useState(() => ({
    JIRA: integrations.some((i) => i.type.toUpperCase() === 'JIRA' && i.hasStoredSecret),
    TRELLO: integrations.some((i) => i.type.toUpperCase() === 'TRELLO' && i.hasStoredSecret),
    GOOGLE_SHEETS: integrations.some((i) => i.type.toUpperCase() === 'GOOGLE_SHEETS' && i.hasStoredSecret),
  }));

  const [openModal, setOpenModal] = useState<IntegrationProvider | null>(null);

  const handleModalSaved = useCallback(
    (provider: IntegrationProvider) => {
      setConnected((prev) => ({ ...prev, [provider]: true }));
      setOpenModal(null);
      router.refresh();
    },
    [router],
  );

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
        <div className="space-y-3">
          {INTEGRATIONS.map((integration) => {
            const isConnected = connected[integration.key];
            return (
              <div
                key={integration.key}
                className={cn(
                  'flex items-center justify-between rounded-[8px] border px-5 py-4 transition',
                  isConnected ? S.selectedCard : 'border-white/6 bg-[#1a1b20]',
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${integration.iconBg} text-sm font-bold text-white`}>
                    {integration.icon}
                  </div>
                  <div>
                    <div className="text-[1rem] font-semibold text-white">{integration.name}</div>
                    <div className={cn('text-sm', S.bodyMuted)}>{integration.copy}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className={S.accentBadge}>
                      <span aria-hidden="true">✓</span> Connected
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpenModal(integration.key)}
                    aria-label={`${isConnected ? 'Reconfigure' : 'Configure'} ${integration.name}`}
                    className={cn(
                      'rounded-[6px] px-4 py-2 text-sm font-semibold transition',
                      isConnected
                        ? 'border border-white/8 text-[#9a9da5] hover:border-white/20 hover:text-white'
                        : 'bg-[#1e3d31] text-[#53dca4] hover:bg-[#243f35]',
                    )}
                  >
                    {isConnected ? 'Reconfigure' : 'Configure →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {COMING_SOON.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-[8px] border border-white/6 bg-[#16171b] px-5 py-4 opacity-60">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/8 bg-[#24262b] text-sm text-white/60">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[1rem] font-semibold text-white">{item.name}</div>
                  <div className={cn('text-sm', S.bodyMuted)}>{item.copy}</div>
                </div>
              </div>
              <span className="rounded-[6px] bg-white/6 px-3 py-1.5 text-xs font-semibold text-[#8c9098]">Coming Soon</span>
            </div>
          ))}
        </div>

        <div className="rounded-[8px] border border-white/6 bg-[#141519] px-5 py-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 text-[#ebb04e]">ⓘ</span>
            <div className={cn('text-sm leading-7', S.bodyMuted)}>
              Click <strong className="text-white">Configure →</strong> on any integration to enter credentials, test the live connection, optionally create a sample record, and save the connection before continuing.
            </div>
          </div>
        </div>

        <FormMessage>{state.error}</FormMessage>
      </div>

      <FooterBar
        backHref="/onboarding"
        stepLabel="Step 3 of 6: System Integrations"
        skipHref="/onboarding?stage=repository&skip=integrations"
        submitIdleLabel="Continue to Step 4"
        submitPendingLabel="Saving integrations..."
        actionError={state.error}
      />

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

export type RepositoryRouteError = {
  code: string;
  title: string;
  message: string;
  hint?: string;
  provider?: 'GITHUB' | 'GITLAB';
};

export function RepositoryStepForm({
  projectId,
  existingConnection,
  routeError,
}: {
  projectId: string;
  existingConnection?: BootstrapResponse['repositoryConnection'];
  routeError?: RepositoryRouteError | null;
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

  // Excludes existingCandidate to prevent identity churn after the repo-list fetch
  // from triggering a spurious second branch fetch.
  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.externalId === selectedRepositoryId) ?? null,
    [repositories, selectedRepositoryId],
  );

  const providerLabel = provider === 'GITHUB' ? 'GitHub' : 'GitLab';
  const providerSlug = provider === 'GITHUB' ? 'github' : 'gitlab';
  const repoNoun = provider === 'GITHUB' ? 'repositories' : 'projects';
  const repositoryConnectionStatus = getRepositoryConnectionPresentation(existingConnection ?? null);
  const providerSessionMissing = Boolean(
    existingConnection?.provider === provider
      && (
        repositoryError === 'Connect GitHub first.'
        || repositoryError === 'Connect GitLab first.'
        || branchError === 'Connect GitHub and choose a repository first.'
        || branchError === 'Connect GitLab and choose a project first.'
      ),
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
        setSelectedBranch((prev) => (prev === repository.defaultBranch ? prev : repository.defaultBranch));
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

  function repoStatusText() {
    if (loadingRepositories) return `Loading ${repoNoun}...`;
    if (providerSessionMissing && existingConnection?.provider === provider) {
      return `Showing the saved ${provider === 'GITHUB' ? 'repository' : 'project'} from this project record. Reauthorize ${providerLabel} to browse other ${repoNoun} or refresh live branch data.`;
    }
    if (repositoryError) return repositoryError;
    if (repositories.length) return `${repositories.length} ${repoNoun} available for selection.`;
    return `No ${repoNoun} available yet. Connect the provider first.`;
  }

  const providerAuthorized = repositories.length > 0 || Boolean(existingConnection?.provider === provider);
  const selectedRepositoryStatus: ConnectionPresentation = selectedRepository
    ? repositoryConnectionStatus
    : providerAuthorized
      ? {
          label: 'Repository selected',
          tone: 'brand',
          summary: `Authorize ${providerLabel} and choose the ${provider === 'GITHUB' ? 'repository' : 'project'} DioTest should monitor for this setup.`,
          recovery: `Once a ${provider === 'GITHUB' ? 'repository' : 'project'} is selected, DioTest will save the baseline branch and provision the webhook during Save & Connect.`,
        }
      : {
          label: 'Provider not connected',
          tone: 'neutral',
          summary: `Connect ${providerLabel} first so DioTest can list available ${repoNoun} for this project.`,
          recovery: `Use ${provider === 'GITHUB' ? 'Connect GitHub' : 'Connect GitLab'} to authorize DioTest before selecting a ${provider === 'GITHUB' ? 'repository' : 'project'}.`,
        };

  return (
    <form action={formAction}>
      {/* Required by server — populated programmatically from selection UI.
          Native HTML required validation is not applicable to hidden inputs. */}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="externalId" value={selectedRepository?.externalId ?? ''} />
      <input type="hidden" name="owner" value={selectedRepository?.owner ?? ''} />
      <input type="hidden" name="namespace" value={selectedRepository?.namespace ?? ''} />
      <input type="hidden" name="repositoryName" value={selectedRepository?.repositoryName ?? ''} />
      <input type="hidden" name="fullName" value={selectedRepository?.fullName ?? ''} />
      <input type="hidden" name="repositoryUrl" value={selectedRepository?.repositoryUrl ?? ''} />
      {routeError ? (
        <div className="mb-6 rounded-[8px] border border-[#5f2a2a] bg-[#1e1313] px-5 py-4">
          <div className="text-sm font-semibold text-[#f87171]">{routeError.title}</div>
          <div className="mt-1 text-sm text-[#c4a0a0]">{routeError.message}</div>
          {routeError.hint ? (
            <div className="mt-2 text-xs text-[#9a7070]">Hint: {routeError.hint}</div>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          {PROVIDER_OPTIONS.map(([value, label, copy]) => (
            <button
              key={value}
              type="button"
              onClick={() => setProvider(value)}
              aria-label={`Select ${label} as repository provider`}
              className={cn(
                'rounded-[8px] border px-5 py-4 text-left transition',
                provider === value ? S.selectedCard : 'border-white/6 bg-[#17181d] hover:bg-[#1b1c21]',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-white">{label}</div>
                <div className={cn(
                  'rounded-[6px] px-3 py-1 text-xs font-semibold',
                  provider === value ? 'bg-[#123224] text-[#53dca4]' : 'bg-white/6 text-[#9ca0a8]',
                )}>
                  {provider === value ? 'Selected' : 'Use'}
                </div>
              </div>
              <div className={cn('mt-2 text-sm leading-6', S.bodyMuted)}>{copy}</div>
            </button>
          ))}
        </div>

        <div className={cn(S.panelSurface, 'p-5')}>
          {routeError ? (
            <div className="mb-5 rounded-[8px] border border-[#6a4c19] bg-[#21180b] px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[#ffbf5a]">⚠</span>
                <div>
                  <div className="text-sm font-semibold text-[#ffd28a]">{routeError.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[#d6c09a]">{routeError.message}</div>
                  {routeError.hint ? (
                    <div className="mt-2 text-xs uppercase tracking-[0.12em] text-[#f0b65a]">{routeError.hint}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">
                Connect {provider === 'GITHUB' ? 'GitHub App' : providerLabel}
              </div>
              <div className={cn('mt-1 text-sm leading-6', S.bodyMuted)}>
                {provider === 'GITHUB'
                  ? 'Install or authorize the DioTest GitHub App, then choose the repository DioTest should monitor.'
                  : 'Authorize GitLab, then choose the project and provide a project/group token for webhook creation.'}
              </div>
            </div>
            <a
              href={`/api/repositories/${providerSlug}/connect?projectId=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent('/onboarding?stage=repository')}`}
              className={S.connectBtn}
            >
              {existingConnection?.provider === provider
                ? (provider === 'GITHUB' ? 'Reauthorize GitHub App' : `Reconnect ${providerLabel}`)
                : `Connect ${providerLabel}`}
            </a>
          </div>

          <div className="mt-5 rounded-[8px] border border-white/6 bg-[#131419] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Repository connection status</div>
                <div className="mt-1 text-sm leading-6 text-[#a6a9b0]">{selectedRepositoryStatus.summary}</div>
              </div>
              <StatusBadge status={selectedRepositoryStatus} />
            </div>
            <div className="mt-3 text-sm text-[#90949c]">{repoStatusText()}</div>
            {selectedRepositoryStatus.recovery ? (
              <div className="mt-3 rounded-[6px] border border-white/6 bg-[#17181d] px-4 py-3 text-sm leading-6 text-[#c2c6cd]">
                {selectedRepositoryStatus.recovery}
              </div>
            ) : null}
            {providerSessionMissing && existingConnection?.provider === provider ? (
              <div className="mt-3 rounded-[6px] border border-[#6a4c19] bg-[#21180b] px-4 py-3 text-sm leading-6 text-[#e3c691]">
                Your saved {provider === 'GITHUB' ? 'repository' : 'project'} is still attached to this DioTest project, but the temporary {providerLabel} authorization session has expired. Reauthorize {providerLabel} above if you need to browse a different {provider === 'GITHUB' ? 'repository' : 'project'} or refresh live branches.
              </div>
            ) : null}
            {existingConnection?.webhookStatus !== 'configured' && existingConnection ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[6px] border border-[#6a4c19] bg-[#21180b] px-4 py-3 text-sm leading-6 text-[#e3c691]">
                  Likely causes: the repository was connected before the webhook URL format changed, the public app URL
                  changed, or the provider credentials no longer match the current environment.
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/api/repositories/${providerSlug}/connect?projectId=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent('/onboarding?stage=repository')}`}
                    className="rounded-[6px] border border-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#c9cdd4] transition hover:border-white/20 hover:text-white"
                  >
                    Reconnect provider
                  </a>
                  <button type="submit" className="rounded-[6px] border border-[#245b47] bg-[#123224] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#79e6b7] transition hover:bg-[#174530]">
                    Retry Save &amp; Connect
                  </button>
                  <Link href="/docs/concepts/repository-onboarding" className="rounded-[6px] border border-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#c9cdd4] transition hover:border-white/20 hover:text-white">
                    Review {provider === 'GITHUB' ? 'GitHub App setup' : 'GitLab token'}
                  </Link>
                </div>
                {existingConnection.webhookLastError ? (
                  <details className="rounded-[6px] border border-white/6 bg-[#17181d] px-4 py-3 text-sm text-[#b7bbc2]">
                    <summary className="cursor-pointer font-semibold text-white">Advanced webhook detail</summary>
                    <div className="mt-2 leading-6 text-[#9aa0a8]">{existingConnection.webhookLastError}</div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {repositories.map((repo) => {
              const selected = repo.externalId === selectedRepositoryId;
              return (
                <label
                  key={`${repo.provider}:${repo.externalId}`}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-[8px] border px-5 py-5 transition',
                    selected ? 'border-[#2f6d55] bg-[#1e2123]' : 'border-transparent bg-transparent hover:bg-[#1a1b20]',
                  )}
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
                      <div className={cn('text-sm', S.fieldHelperText)}>
                        {repo.repositoryUrl.replace(/^https?:\/\//, '')} • default branch {repo.defaultBranch}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    'rounded-[4px] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em]',
                    selected ? 'bg-[#173c2e] text-[#79e6b7]' : 'bg-transparent text-[#c8cbd1]',
                  )}>
                    {selected ? 'Selected' : 'Choose'}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className={S.fieldLabel}>Default branch</div>
              <LearnMoreLink href="/docs/concepts/repository-onboarding" />
            </div>
            <select
              name="defaultBranch"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
              aria-label="Default branch"
              className="h-12 w-full rounded-[8px] border border-white/6 bg-[#131419] px-4 text-sm text-white outline-none"
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <div className={cn('mt-2 text-xs', S.fieldHelperText)}>
              {loadingBranches
                ? 'Loading live branches...'
                : providerSessionMissing && existingConnection?.provider === provider
                  ? `Using the saved ${provider === 'GITHUB' ? 'repository' : 'project'} branch until you reauthorize ${providerLabel}.`
                  : branchError
                    ? branchError
                  : 'This becomes DioTest’s stored baseline branch for the project. It does not rename any provider branch.'}
            </div>
          </div>
          {provider === 'GITLAB' ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className={S.fieldLabel}>GitLab project/group token</div>
                <LearnMoreLink href="/docs/concepts/repository-onboarding" />
              </div>
              <Input
                name="gitlabProjectToken"
                type="password"
                placeholder="Required for webhook provisioning"
                aria-label="GitLab project/group token"
                className={S.inputField}
              />
              <div className={cn('mt-2 text-xs leading-5', S.fieldHelperText)}>
                Leave blank to keep the stored token. DioTest stores it encrypted and uses it only to provision and maintain the GitLab webhook for this project.
              </div>
            </div>
          ) : (
            <div className={cn(S.panelSurface, 'px-5 py-4')}>
              <div className="text-sm font-semibold text-white">GitHub App installation</div>
              <div className={cn('mt-2 text-sm leading-6', S.bodyMuted)}>
                Repository access and webhook creation happen through the installed GitHub App. No personal access token is required for this flow.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[4px] border border-white/6 bg-[#17181d] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-lg font-semibold text-white">Automatic Webhook Configuration</div>
                <LearnMoreLink href="/docs/concepts/repository-onboarding" />
              </div>
              <div className={cn('mt-1 text-sm leading-7', S.bodyMuted)}>
                DioTest provisions or repairs the repository webhook automatically during Save &amp; Connect, then stores webhook health for onboarding and settings.
              </div>
            </div>
            <div className="h-6 w-11 rounded-full bg-[#53dca4]/20 p-1">
              <div className="ml-auto h-4 w-4 rounded-full bg-[#53dca4]" />
            </div>
          </div>
          {existingConnection ? (
            <div className="mt-4 rounded-[6px] border border-white/6 bg-[#131419] px-4 py-3 text-sm text-[#aeb1b8]">
              Current connection: <span className="font-semibold text-white">{existingConnection.fullName}</span>
              <div className="mt-2">
                <StatusBadge status={repositoryConnectionStatus} />
              </div>
              {existingConnection.webhookLastError ? (
                <details className="mt-3 text-sm text-[#9aa0a8]">
                  <summary className="cursor-pointer font-semibold text-white">Advanced webhook detail</summary>
                  <div className="mt-2 leading-6">{existingConnection.webhookLastError}</div>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <FormMessage>{state.error}</FormMessage>
      </div>
      <FooterBar
        backHref="/onboarding?stage=integrations"
        skipHref="/onboarding?stage=extension&skip=repository"
        stepLabel="Step 4 of 6: Repository Connection"
        submitIdleLabel="Continue to Step 5"
        submitPendingLabel="Saving repository..."
        actionError={state.error}
        helperText={!selectedRepository ? `Select a ${provider === 'GITHUB' ? 'repository' : 'project'} and branch before continuing.` : undefined}
      />
    </form>
  );
}

export function ExtensionSetupStep({
  projectId,
  organizationSlug,
  initialApiKey,
}: {
  projectId: string;
  organizationSlug: string;
  initialApiKey: string;
}) {
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState<'url' | 'key' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBrowser, setSelectedBrowser] = useState<'chrome' | 'firefox' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const apiBaseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${organizationSlug}/${projectId}`
    : '';
  const extensionStatus = getExtensionConnectionPresentation({ detected: extensionInstalled, connected });

  const handleInstallClick = async (browser: 'chrome' | 'firefox') => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/extension/download?format=${browser}`);
      if (!response.ok) {
        let message = 'Failed to download extension. Please try again.';

        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) {
            message = data.error;
          }
        } catch {
          // Ignore JSON parsing failures and fall back to the generic message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diotest-extension-${browser}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSelectedBrowser(browser);
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to download extension:', error);
      const message = error instanceof Error ? error.message : 'Failed to download extension. Please try again.';
      alert(message);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    function onInstalled() {
      setExtensionInstalled(true);
    }
    window.addEventListener('diotest:extension:installed', onInstalled);
    window.dispatchEvent(new CustomEvent('diotest:page:ready'));
    return () => window.removeEventListener('diotest:extension:installed', onInstalled);
  }, []);

  useEffect(() => {
    if (!projectId || connected) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/extension/status?projectId=${projectId}`);
        const data = (await res.json()) as { ok: boolean; connected?: boolean };
        if (data.connected) {
          setConnected(true);
          clearInterval(id);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);
    return () => clearInterval(id);
  }, [projectId, connected]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(apiBaseUrl);
    setCopied('url');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(initialApiKey);
    setCopied('key');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <ExtensionInstallModal
        isOpen={modalOpen}
        browser={selectedBrowser}
        onClose={() => setModalOpen(false)}
      />
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
          <div className="mt-7 flex justify-center">
            <StatusBadge status={extensionStatus} />
          </div>
          <p className="mx-auto mt-4 max-w-[38rem] text-sm leading-7 text-[#a2a6af]">
            {extensionStatus.summary}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {EXTENSION_INSTALL_OPTIONS.map(({ store, label, ariaLabel }) => {
              const browser = store === 'Chrome Web Store' ? 'chrome' : 'firefox';
              return (
                <button
                  key={store}
                  type="button"
                  onClick={() => handleInstallClick(browser)}
                  disabled={downloading}
                  aria-label={ariaLabel}
                  className="rounded-[8px] border border-white/6 bg-[#101114] px-5 py-5 text-left transition hover:bg-[#14161a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7f828a]">{store}</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {downloading ? 'Downloading...' : label}
                  </div>
                </button>
              );
            })}
          </div>

          <div className={cn(S.panelSurface, 'mt-6 px-5 py-4')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                DioTest Connection
              </div>
              <LearnMoreLink href="/docs/concepts/settings-and-integrations" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={cn('text-xs', S.bodyMuted)}>API Base URL</div>
                  <div className="mt-0.5 font-mono text-sm text-white">{apiBaseUrl}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="rounded-[6px] bg-white/6 px-3 py-1.5 text-xs text-[#9a9da5] transition hover:text-white"
                  aria-label="Copy API Base URL"
                >
                  {copied === 'url' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={cn('text-xs', S.bodyMuted)}>API Key</div>
                  <div className="mt-0.5 font-mono text-sm text-white">
                    {initialApiKey ? `${initialApiKey.slice(0, 12)}••••••••` : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="rounded-[6px] bg-white/6 px-3 py-1.5 text-xs text-[#9a9da5] transition hover:text-white"
                  aria-label="Copy API Key"
                >
                  {copied === 'key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <p className={cn('mt-3 text-xs leading-5', S.bodyMuted)}>
              Paste these into the extension&rsquo;s Settings panel → DioTest Connection. This URL is project-scoped on purpose. If your public domain or ngrok URL changes, update the extension setting before testing again.
            </p>
            <p className={cn('mt-2 text-xs leading-5', S.bodyMuted)}>
              If this project API key is regenerated later, replace the saved key in the extension before clicking Test Connection again.
            </p>
          </div>

          {!connected ? (
            <div className="mt-6 rounded-[8px] border border-[#6a4c19] bg-[#21180b] px-5 py-5 text-left">
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-[#ffd28a]">
                {extensionInstalled ? 'Complete the project verification' : 'Complete the extension setup'}
              </div>
              <div className="mt-2 text-sm leading-6 text-[#dbc7a2]">
                {extensionInstalled
                  ? 'The extension is installed, but it still needs to verify itself against this specific project.'
                  : 'The extension must be installed and opened on this page before DioTest can detect it.'}
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#e3d2b2]">
                <li>Confirm the DioTest recorder extension is installed and this page is open in that browser.</li>
                <li>Confirm API Base URL matches <span className="font-mono text-white">{apiBaseUrl || 'the current project URL'}</span>.</li>
                <li>Confirm API Key matches the latest Step 5 key for this project.</li>
                <li>Open the extension settings, save both values, then click <span className="font-semibold text-white">Test Connection</span>.</li>
                <li>If the public app URL changed, update the API Base URL in the extension.</li>
                <li>If the key changed or was regenerated, replace the saved key in the extension.</li>
              </ul>
            </div>
          ) : null}

          <div className="mt-6 rounded-[8px] border border-white/6 bg-[#121317] px-5 py-4 text-left">
            <div className="text-sm font-semibold text-white">
              {connected ? 'Verified against this project' : extensionInstalled ? 'Detected but not yet connected' : 'Waiting for installation detection'}
            </div>
            <div className={cn('mt-2 text-sm leading-6', S.bodyMuted)}>
              {connected
                ? 'The extension has already authenticated to this exact project, so Step 5 can continue.'
                : extensionInstalled
                  ? 'Detection is only phase one. The extension still needs the copied URL and key so DioTest can verify the project connection.'
                  : 'Once the extension is installed and this page is refreshed or reopened, DioTest will detect it automatically before the connection test.'}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-6">
          <div className="flex items-center gap-6 text-sm text-[#8c8f97]">
            <Link href="/onboarding?stage=repository" className={S.backLink}>
              ← Back
            </Link>
            <Link href="/onboarding?stage=finalize&skip=extension" className={S.skipLink}>
              Skip for now
            </Link>
          </div>
          {connected ? (
            <Link href="/onboarding?stage=finalize" className={S.connectBtn}>
              Continue →
            </Link>
          ) : (
            <span className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-[8px] border border-[#335847] bg-[#1f4d3d]/40 px-6 text-sm font-semibold text-[#6ca88d]/50">
              Continue →
            </span>
          )}
        </div>
      </div>

      {!connected ? (
        <div className="mt-4 text-right text-xs uppercase tracking-[0.12em] text-[#8fa894]">
          Continue unlocks after the extension verifies against this project.
        </div>
      ) : null}

      <div className="mt-6 rounded-[10px] border border-[#1e5a43] bg-[#0f231b] px-5 py-4 text-sm text-[#9ed7bb]">
        <span className="font-semibold text-[#53dca4]">Pro-tip:</span> After installation, pin the DioTest icon to your
        browser toolbar for quick access during testing sessions.
      </div>
    </div>
  );
}

export function FinalReviewStep({
  organizationName,
  organizationSlug,
  projectName,
  projectSlug,
  projectDescription,
  projectId,
  repositoryConnection,
  expectedWebhookUrl,
  integrations,
  extensionConnected,
  extensionConnectedAt,
}: {
  organizationName: string;
  organizationSlug: string;
  projectName: string;
  projectSlug: string;
  projectDescription: string | null;
  projectId: string;
  repositoryConnection: BootstrapResponse['repositoryConnection'];
  expectedWebhookUrl: string | null;
  integrations: BootstrapResponse['integrations'];
  extensionConnected: boolean;
  extensionConnectedAt: string | null;
}) {
  type ReviewActionItem = {
    label: string;
    status: ConnectionPresentation;
    summary: string;
    recovery?: string;
    redoHref?: string;
    redoLabel?: string;
  };

  const [, formAction] = useActionState(finalizeOnboardingAction, {});
  const repositoryStatus = getRepositoryConnectionPresentation(repositoryConnection);
  const webhookUrl = repositoryConnection?.webhookUrl ?? null;
  const webhookMatchesProjectRoute = Boolean(
    webhookUrl && expectedWebhookUrl && webhookUrl === expectedWebhookUrl,
  );
  const effectiveRepositoryStatus: ConnectionPresentation =
    repositoryConnection && repositoryConnection.webhookStatus === 'configured' && !webhookMatchesProjectRoute
      ? {
          label: 'Webhook needs attention',
          tone: 'warn',
          summary: `${repositoryConnection.fullName} is connected, but the saved webhook still points at the older catch-all route instead of this project-specific endpoint.`,
          recovery: 'Reconnect the repository in Step 4 to reprovision the webhook onto the current project-scoped URL.',
          advancedLabel: webhookUrl ?? undefined,
        }
      : repositoryStatus;
  const extensionStatus = getExtensionConnectionPresentation({
    detected: extensionConnected,
    connected: extensionConnected,
  });
  const integrationNames = integrations.length
    ? integrations.map((integration) => integration.name)
    : [];
  const hasIncompleteIntegration = integrations.some((integration) => {
    const hasConfig = Boolean(integration.configJson && Object.keys(integration.configJson).length > 0);
    return !hasConfig || !integration.hasStoredSecret;
  });
  const integrationStatus: ConnectionPresentation = hasIncompleteIntegration
    ? {
        label: 'Credentials missing',
        tone: 'warn',
        summary: 'One or more saved integrations still need complete credentials or configuration before DioTest can use them reliably.',
        recovery: 'Open Step 3 to finish the affected integration settings and save them again.',
      }
    : {
        label: integrationNames.length ? 'Integrations ready' : 'Integrations optional',
        tone: integrationNames.length ? 'success' : 'neutral',
        summary: integrationNames.length
          ? `${integrationNames.join(', ')} are saved for this project.`
          : 'No optional integrations are configured for this project yet.',
      };
  const formattedExtensionConnectedAt = extensionConnectedAt
    ? new Date(extensionConnectedAt).toLocaleString()
    : null;
  const reviewItems: ReviewActionItem[] = [
    {
      label: 'Repository webhook',
      status: effectiveRepositoryStatus,
      summary: effectiveRepositoryStatus.summary,
      recovery: effectiveRepositoryStatus.recovery,
      redoHref:
        !repositoryConnection
        || effectiveRepositoryStatus.tone === 'warn'
        || effectiveRepositoryStatus.tone === 'danger'
          ? '/onboarding?stage=repository'
          : undefined,
      redoLabel: 'Redo Repository Setup',
    },
    {
      label: 'Recorder extension',
      status: extensionStatus,
      summary: extensionStatus.summary,
      recovery: extensionStatus.recovery,
      redoHref: !extensionConnected ? '/onboarding?stage=extension' : undefined,
      redoLabel: 'Redo Extension Setup',
    },
    {
      label: 'Saved integrations',
      status: integrationStatus,
      summary: integrationNames.length ? integrationNames.join(', ') : 'No optional integrations configured',
      recovery: hasIncompleteIntegration ? integrationStatus.recovery : undefined,
      redoHref: hasIncompleteIntegration ? '/onboarding?stage=integrations' : undefined,
      redoLabel: 'Redo Integrations Setup',
    },
  ];
  const launchReady =
    Boolean(repositoryConnection)
    && effectiveRepositoryStatus.tone !== 'warn'
    && effectiveRepositoryStatus.tone !== 'danger'
    && extensionConnected
    && !hasIncompleteIntegration;
  const summaryCards = [
    ['Organization', organizationName],
    ['Project', projectName],
    ['Integrations', integrationNames.length ? integrationNames.join(', ') : 'Pending'],
    ['Repository', repositoryConnection?.fullName ?? 'Repository pending'],
  ] as const;
  const configurationDetails: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Organization slug', value: organizationSlug || 'Pending', mono: true },
    { label: 'Project slug', value: projectSlug || 'Pending', mono: true },
    { label: 'Project ID', value: projectId, mono: true },
    { label: 'Description', value: projectDescription || 'Not provided' },
    { label: 'Repository provider', value: repositoryConnection?.provider ?? 'Pending', mono: true },
    { label: 'Default branch', value: repositoryConnection?.defaultBranch ?? 'Pending', mono: true },
    { label: 'Webhook status', value: repositoryConnection?.webhookStatus ?? 'Pending', mono: true },
    { label: 'Extension verified', value: formattedExtensionConnectedAt ?? 'Not yet verified', mono: true },
  ] as const;
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(([label, value]) => (
            <div key={label} className={cn(S.panelSurface, 'min-w-0 p-4')}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7b7e86]">{label}</div>
              <div className="mt-3 break-words text-lg font-semibold leading-8 text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className={cn(S.panelSurface, 'min-w-0 p-6')}>
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/6 pb-4">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Configuration Review</div>
              <StatusBadge status={launchReady ? { label: 'Ready to complete', tone: 'success', summary: '' } : effectiveRepositoryStatus} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {configurationDetails.map((item) => (
                <div key={item.label} className="rounded-[8px] border border-white/6 bg-[#131419] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7b7e86]">{item.label}</div>
                  <div className={cn('mt-3 break-words text-sm leading-7 text-white', item.mono && 'font-mono text-[0.92rem]')}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {repositoryConnection?.repositoryUrl ? (
              <div className="mt-6 rounded-[8px] border border-white/6 bg-[#131419] p-5 text-sm text-[#b8bbc2]">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white">Repository Route</div>
                <a
                  href={repositoryConnection.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[#79e6b7] hover:text-[#9af0c6]"
                >
                  {repositoryConnection.repositoryUrl}
                </a>
              </div>
            ) : null}

            <div className="mt-8 rounded-[8px] border border-white/6 bg-[#131419] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Connection Checks</div>
                <StatusBadge status={launchReady ? { label: 'Ready to complete', tone: 'success', summary: '' } : effectiveRepositoryStatus} />
              </div>
              <div className="grid gap-3">
                {reviewItems.map((item) => (
                  <div key={item.label} className="rounded-[8px] border border-white/6 bg-[#101116] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7b7e86]">{item.label}</div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-3 break-words text-sm leading-7 text-white">{item.summary}</div>
                    {item.recovery ? (
                      <div className="mt-3 text-sm leading-7 text-[#b8bbc2]">{item.recovery}</div>
                    ) : null}
                    {item.redoHref && item.redoLabel ? (
                      <div className="mt-4">
                        <Link
                          href={item.redoHref}
                          className="inline-flex h-10 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
                        >
                          {item.redoLabel}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {(webhookUrl || expectedWebhookUrl) ? (
                <details className="mt-4 rounded-[8px] border border-white/6 bg-[#111217] px-4 py-3 text-sm text-[#91949b]">
                  <summary className="cursor-pointer list-none text-white">Advanced detail</summary>
                  <div className="mt-3 space-y-2 break-all">
                    {webhookUrl ? (
                      <div>
                        <span className="text-[#7b7e86]">Stored webhook URL:</span>{' '}
                        <span className="font-mono text-white">{webhookUrl}</span>
                      </div>
                    ) : null}
                    {expectedWebhookUrl ? (
                      <div>
                        <span className="text-[#7b7e86]">Expected project webhook URL:</span>{' '}
                        <span className="font-mono text-white">{expectedWebhookUrl}</span>
                      </div>
                    ) : null}
                    {effectiveRepositoryStatus.advancedLabel ? (
                      <div>
                        <span className="text-[#7b7e86]">Detail:</span>{' '}
                        <span className="font-mono text-white">{effectiveRepositoryStatus.advancedLabel}</span>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div
              className={cn(
                'rounded-[8px] p-6',
                launchReady
                  ? 'border border-[#2f6d55] bg-[#22302b]'
                  : 'border border-[#5c4a22] bg-[#1c1810]',
              )}
            >
              <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#0d6b49]/30 text-xl text-[#53dca4]">↗</div>
              <div className="mt-5 text-[2rem] font-bold tracking-[-0.05em] text-white">Complete Setup</div>
              <p className="mt-3 text-sm leading-7 text-[#c3c7cc]">
                {launchReady
                  ? 'This action marks onboarding complete and takes you into the DioTest workspace for this project.'
                  : 'You can still complete onboarding, but the review panel shows setup items that should be rerun first.'}
              </p>
              <SubmitButton
                idleLabel={launchReady ? 'Enter Workspace →' : 'Enter Workspace Anyway →'}
                pendingLabel="Opening workspace..."
                className={cn(
                  'mt-7 h-12 w-full rounded-[8px] px-6 text-sm font-semibold',
                  launchReady
                    ? 'bg-[#53dca4] text-[#063523] hover:bg-[#66e6b1]'
                    : 'border border-[#6a4c19] bg-[#21180b] text-[#ffd28a] hover:bg-[#2a1f0e]',
                )}
              />
            </div>

            <div className={cn(S.panelSurface, 'p-5')}>
              <div className="text-sm font-semibold text-[#ebb04e]">Before You Continue</div>
              <p className="mt-3 text-sm leading-7 text-[#9598a0]">
                Step 6 now re-verifies saved setup state for this project. Use the redo actions above to reopen the exact step that owns a failing connection.
              </p>
            </div>
          </div>
        </div>
      </div>

      <FooterBar
        backHref="/onboarding?stage=extension"
        stepLabel="Step 6 of 6: Review"
        actionError={undefined}
        helperText="Enter Workspace completes onboarding for this project. Repair actions above reopen the owning step; they do not run provider fixes inline from Step 6."
      />
    </form>
  );
}
