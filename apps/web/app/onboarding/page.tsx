import Link from 'next/link';

import {
  ExtensionSetupStep,
  FinalReviewStep,
  OrganizationStepForm,
  ProjectStepForm,
  RepositoryStepForm,
  type RepositoryRouteError,
  SetupStepForm,
} from '@/components/onboarding/onboarding-forms';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { requireOnboardingState } from '@/lib/guards';
import {
  isOnboardingStage,
  mergeOnboardingProgress,
  onboardingStageOrder,
  type OnboardingProgress,
  type OnboardingStage,
} from '@/lib/onboarding-state';
import { getOrCreateExtensionApiKey } from '@/lib/extension-key';
import { prisma } from '@/lib/prisma';
import { logServerEvent } from '@/lib/server-logger';
import { absoluteUrl, slugify } from '@/lib/utils';

type PageProps = {
  searchParams?: Promise<{
    stage?: string;
    error?: string;
    message?: string;
    skip?: string;
  }>;
};

type StageKey = OnboardingStage;

const stageOrder: StageKey[] = onboardingStageOrder;

const stageMeta: Record<
  StageKey,
  {
    title: string;
    description: string;
  }
> = {
  organization: {
    title: 'Set up your organization',
    description: 'Start by defining the workspace that will own your projects, settings, and test history.',
  },
  project: {
    title: 'Create your first project',
    description: 'Add the first codebase that DioTest will analyze, record, and orchestrate tests for.',
  },
  integrations: {
    title: 'Connect Third-Party Tools',
    description: 'Link your workspace tools to enable automated reporting and ticket tracking.',
  },
  repository: {
    title: 'Connect Source Repository',
    description: 'Connect GitHub or GitLab, select the repository or project, and let DioTest provision the webhook automatically.',
  },
  extension: {
    title: 'Install the DioTest Recorder',
    description:
      'The browser extension captures real UI interactions and turns them into stable, reusable testing workflows.',
  },
  finalize: {
    title: 'Review Your Configuration',
    description:
      'Review the saved project setup, rerun any step that still needs attention, then enter the workspace.',
  },
};

const sidebarLabels: Array<[StageKey, string]> = [
  ['organization', 'Organization'],
  ['project', 'Project'],
  ['integrations', 'Integrations'],
  ['repository', 'Repository'],
  ['extension', 'Extension'],
  ['finalize', 'Review & Launch'],
];


function resolveRepositoryRouteError(errorCode: string | undefined, detail: string | undefined): RepositoryRouteError | null {
  if (!errorCode) return null;

  const safeDetail = detail?.trim() || undefined;

  switch (errorCode) {
    case 'missing-project':
      return {
        code: errorCode,
        title: 'Repository setup could not start',
        message: 'The repository connection flow is missing a project context.',
        hint: 'Reload onboarding and reopen Step 4 from a saved project.',
      };
    case 'github-connect':
      return {
        code: errorCode,
        provider: 'GITHUB',
        title: 'GitHub connection could not start',
        message:
          safeDetail ??
          'GitHub App setup is incomplete. DioTest could not build the GitHub install link for this project.',
        hint: 'Check the GitHub App environment variables, then retry Connect GitHub.',
      };
    case 'github-callback':
      return {
        code: errorCode,
        provider: 'GITHUB',
        title: 'GitHub authorization did not complete',
        message:
          safeDetail ??
          'GitHub returned without a valid installation or state for this project.',
        hint: 'Retry the GitHub App flow and complete the installation in the same browser session.',
      };
    case 'gitlab-connect':
      return {
        code: errorCode,
        provider: 'GITLAB',
        title: 'GitLab connection could not start',
        message:
          safeDetail ??
          'GitLab OAuth setup is incomplete. DioTest could not build the GitLab authorization link.',
        hint: 'Check the GitLab OAuth environment variables, then retry Connect GitLab.',
      };
    case 'gitlab-callback':
      return {
        code: errorCode,
        provider: 'GITLAB',
        title: 'GitLab authorization did not complete',
        message:
          safeDetail ??
          'GitLab returned without a valid code or state for this project.',
        hint: 'Retry the GitLab OAuth flow and finish it in the same browser session.',
      };
    default:
      return {
        code: errorCode,
        title: 'Repository connection failed',
        message: safeDetail ?? 'DioTest could not finish the provider connection flow.',
        hint: 'Retry the provider connection. If it fails again, review the server configuration.',
      };
  }
}

function isStageSkipped(stage: StageKey, progress: OnboardingProgress | null) {
  if (!progress) return false;
  if (stage === 'integrations') return Boolean(progress.integrationsSkipped);
  if (stage === 'repository') return Boolean(progress.repositorySkipped);
  if (stage === 'extension') return Boolean(progress.extensionSkipped);
  return false;
}

function isStageCleared(stage: StageKey, progress: OnboardingProgress | null, hasRepositoryConnection: boolean) {
  if (stage === 'repository') {
    return hasRepositoryConnection || isStageSkipped(stage, progress);
  }

  if (stage === 'extension') {
    return Boolean(progress?.lastVisitedStage === 'finalize' || progress?.extensionSkipped);
  }

  if (stage === 'integrations') {
    return Boolean(
      isStageSkipped(stage, progress)
      || progress?.lastVisitedStage === 'repository'
      || progress?.lastVisitedStage === 'extension'
      || progress?.lastVisitedStage === 'finalize',
    );
  }

  return false;
}

async function getExtensionConnectionInfo(projectId: string | undefined) {
  if (!projectId) {
    return { connected: false, connectedAt: null as string | null };
  }

  const setting = await prisma.systemSetting.findFirst({
    where: {
      scope: 'PROJECT',
      projectId,
      key: 'extension.connectedAt',
    },
    select: {
      value: true,
    },
  });

  return {
    connected: Boolean(setting?.value),
    connectedAt: typeof setting?.value === 'string' ? setting.value : null,
  };
}

function getFirstIncompleteStage(
  hasOrg: boolean,
  hasProject: boolean,
  hasRepositoryConnection: boolean,
  progress: OnboardingProgress | null,
  extensionConnected: boolean,
): StageKey {
  if (!hasOrg) return 'organization';
  if (!hasProject) return 'project';

  if (!isStageCleared('integrations', progress, hasRepositoryConnection)) return 'integrations';
  if (!isStageCleared('repository', progress, hasRepositoryConnection)) return 'repository';
  if (!extensionConnected && !isStageCleared('extension', progress, hasRepositoryConnection)) return 'extension';
  return 'finalize';
}

function resolveStage(
  stage: string | undefined,
  hasOrg: boolean,
  hasProject: boolean,
  hasRepositoryConnection: boolean,
  onboardingComplete: boolean,
  progress: OnboardingProgress | null,
  extensionConnected: boolean,
): StageKey {
  const requested = isOnboardingStage(stage) ? stage : undefined;

  if (onboardingComplete) {
    return requested ?? 'finalize';
  }

  const firstIncomplete = getFirstIncompleteStage(
    hasOrg,
    hasProject,
    hasRepositoryConnection,
    progress,
    extensionConnected,
  );

  if (!requested) return firstIncomplete;
  if (requested === 'organization' || requested === 'project') return firstIncomplete;

  const requestedIndex = stageOrder.indexOf(requested);
  const firstIncompleteIndex = stageOrder.indexOf(firstIncomplete);

  return requestedIndex > firstIncompleteIndex ? firstIncomplete : requested;
}

function OnboardingHeader() {
  return (
    <header className="flex h-[60px] items-center justify-between border-b border-white/6 bg-[#0b0c0f] px-6">
      <Link href="/" className="text-[1.05rem] font-bold tracking-[-0.04em] text-white">
        DioTest Studio
      </Link>
      <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7f8289]">
        <span>Onboarding</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/5 text-white/80">
          ◔
        </span>
      </div>
    </header>
  );
}

function OnboardingSidebar({ activeStage }: { activeStage: StageKey }) {
  const activeIndex = stageOrder.indexOf(activeStage);

  return (
    <aside className="flex h-full flex-col border-r border-white/6 bg-[#0b0c0f] px-5 pb-8 pt-10 lg:sticky lg:top-0">
      <div className="mb-8">
        <h1 className="text-[1.7rem] font-bold tracking-[-0.05em] text-white">Setup Guide</h1>
        <p className="mt-2 text-sm text-[#8c8f97]">
          Step {activeIndex + 1} of {stageOrder.length}
        </p>
      </div>

      <nav className="space-y-1">
        {sidebarLabels.map(([stage, label], index) => {
          const active = activeStage === stage;
          const complete = activeIndex > index;
          const href = `/onboarding?stage=${stage}`;
          const isReopenable = activeStage === 'finalize' && index < activeIndex && stage !== 'organization' && stage !== 'project';
          const content = (
            <>
              {index < sidebarLabels.length - 1 ? (
                <span className="absolute left-[22px] top-10 h-4 w-px bg-white/10" />
              ) : null}
              <span
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  active
                    ? 'border-[#53dca4] bg-[#53dca4]/15 text-[#53dca4]'
                    : complete
                      ? 'border-[#53dca4]/40 bg-[#53dca4]/10 text-[#53dca4]'
                      : 'border-white/10 text-[#686b72]'
                }`}
              >
                {complete ? '✓' : index + 1}
              </span>
              <span>{label}</span>
            </>
          );

          if (isReopenable) {
            return (
              <Link
                key={stage}
                href={href}
                className={`relative flex items-center gap-3 rounded-[6px] px-3 py-3 text-sm font-medium transition hover:bg-white/5 hover:text-white ${
                  active ? 'bg-white/5 text-white' : complete ? 'text-[#8fdaaf]' : 'text-[#7d8087]'
                }`}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={stage}
              className={`relative flex items-center gap-3 rounded-[6px] px-3 py-3 text-sm font-medium transition ${
                active ? 'bg-white/5 text-white' : complete ? 'text-[#8fdaaf]' : 'text-[#7d8087]'
              }`}
            >
              {content}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t border-white/6 pt-6 text-sm text-[#777a82]">
        <Link href="/docs/concepts" className="flex items-center gap-3 transition hover:text-white">
          <span>◫</span>
          <span>Documentation</span>
        </Link>
        <Link href="/help/setup" className="flex items-center gap-3 transition hover:text-white">
          <span>◌</span>
          <span>Support</span>
        </Link>
        <div className="flex items-center gap-3">
          <span>◌</span>
          <span>SOC2 Compliant</span>
        </div>
      </div>
    </aside>
  );
}

function OnboardingFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-white/6 bg-[#0b0c0f] px-6 py-4 text-[11px] uppercase tracking-[0.16em] text-[#666971]">
      <div className="flex items-center gap-6">
        <span>◌ SOC2 compliant</span>
        <span>◫ End-to-end encrypted</span>
      </div>
      <div className="flex items-center gap-6">
        <Link href="/privacy" className="hover:text-white">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms of Service
        </Link>
        <Link href="/help/setup" className="hover:text-white">
          Need help?
        </Link>
      </div>
    </footer>
  );
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const startedAt = Date.now();
  const { user, bootstrap, unavailable, unavailableMessage } = await requireOnboardingState();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0b0c0f] text-white">
        <OnboardingHeader />
        <BackendUnavailable
          title="Onboarding is temporarily unavailable"
          message={unavailableMessage ?? 'DioTest could not load your onboarding state because the backend is unavailable.'}
        />
        <OnboardingFooter />
      </main>
    );
  }

  const resolvedParams = searchParams ? await searchParams : undefined;

  const hasOrg = Boolean(bootstrap.organization);
  const hasProject = Boolean(bootstrap.project);
  const hasRepositoryConnection = Boolean(bootstrap.repositoryConnection);
  const extensionConnection = await getExtensionConnectionInfo(bootstrap.project?.id);
  const extensionConnected = extensionConnection.connected;
  let onboardingProgress = bootstrap.onboardingProgress;
  if (!bootstrap.onboardingComplete && bootstrap.project && resolvedParams?.skip) {
    if (resolvedParams.skip === 'integrations') {
      onboardingProgress = mergeOnboardingProgress(onboardingProgress, { integrationsSkipped: true });
    } else if (resolvedParams.skip === 'repository') {
      onboardingProgress = mergeOnboardingProgress(onboardingProgress, { repositorySkipped: true });
    } else if (resolvedParams.skip === 'extension') {
      onboardingProgress = mergeOnboardingProgress(onboardingProgress, { extensionSkipped: true });
    }
  }
  const activeStage = resolveStage(
    resolvedParams?.stage,
    hasOrg,
    hasProject,
    hasRepositoryConnection,
    bootstrap.onboardingComplete,
    onboardingProgress,
    extensionConnected,
  );
  const repositoryRouteError = activeStage === 'repository'
    ? resolveRepositoryRouteError(resolvedParams?.error, resolvedParams?.message)
    : null;
  const meta = stageMeta[activeStage];
  const durationMs = Date.now() - startedAt;

  let extensionApiKey = '';
  if (activeStage === 'extension' && bootstrap.project) {
    extensionApiKey = await getOrCreateExtensionApiKey(bootstrap.project.id);
  }

  logServerEvent('onboarding.rendered', {
    status: 'success',
    userId: user.id,
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
    durationMs,
    slow: durationMs > 500,
  });

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0c0f] text-white lg:h-screen lg:overflow-hidden">
      <OnboardingHeader />
      <div className="grid min-h-[calc(100vh-117px)] flex-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden">
        <OnboardingSidebar activeStage={activeStage} />

        <section className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">
          <div className="px-8 py-12 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-10">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#53dca4]">
                Step {stageOrder.indexOf(activeStage) + 1} of {stageOrder.length}
              </div>
              <h2 className="mt-3 text-[2.2rem] font-bold tracking-[-0.05em] text-white">{meta.title}</h2>
              <p className="mt-3 max-w-[46rem] text-[1.05rem] leading-8 text-[#8b8e96]">{meta.description}</p>
            </div>

            <div className="rounded-[8px] border border-white/6 bg-[#1d1e23] p-8 shadow-[0_35px_100px_rgba(0,0,0,0.42)]">
              {activeStage === 'organization' ? (
                <OrganizationStepForm suggestedSlug={slugify(user.name ?? 'diotest-org')} />
              ) : null}
              {activeStage === 'project' && bootstrap.organization ? (
                <ProjectStepForm organizationId={bootstrap.organization.id} />
              ) : null}
              {activeStage === 'integrations' && bootstrap.organization && bootstrap.project ? (
                <SetupStepForm
                  organizationId={bootstrap.organization.id}
                  projectId={bootstrap.project.id}
                  integrations={bootstrap.integrations}
                />
              ) : null}
              {activeStage === 'repository' && bootstrap.project ? (
                <RepositoryStepForm
                  projectId={bootstrap.project.id}
                  existingConnection={bootstrap.repositoryConnection}
                  routeError={repositoryRouteError}
                />
              ) : null}
              {activeStage === 'extension' ? (
                <ExtensionSetupStep
                  projectId={bootstrap.project?.id ?? ''}
                  organizationSlug={bootstrap.organization?.slug ?? ''}
                  initialApiKey={extensionApiKey}
                />
              ) : null}
              {activeStage === 'finalize' && bootstrap.project ? (
                <FinalReviewStep
                  organizationName={bootstrap.organization?.name ?? 'DioTest Labs'}
                  organizationSlug={bootstrap.organization?.slug ?? ''}
                  projectName={bootstrap.project?.name ?? 'Alpha Core'}
                  projectSlug={bootstrap.project?.slug ?? ''}
                  projectDescription={bootstrap.project?.description ?? null}
                  projectId={bootstrap.project.id}
                  repositoryConnection={bootstrap.repositoryConnection}
                  expectedWebhookUrl={
                    bootstrap.repositoryConnection && bootstrap.organization
                      ? absoluteUrl(
                          `/${bootstrap.organization.slug}/${bootstrap.project.id}/webhooks/${bootstrap.repositoryConnection.provider.toLowerCase()}`,
                        )
                      : null
                  }
                  integrations={bootstrap.integrations}
                  extensionConnected={extensionConnected}
                  extensionConnectedAt={extensionConnection.connectedAt}
                />
              ) : null}
            </div>
          </div>
          </div>
        </section>
      </div>
      <OnboardingFooter />
    </main>
  );
}
