import Link from 'next/link';

import {
  ExtensionSetupStep,
  FinalReviewStep,
  GithubStepForm,
  OrganizationStepForm,
  ProjectStepForm,
  SetupStepForm,
} from '@/components/onboarding/onboarding-forms';
import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { requireOnboardingState } from '@/lib/guards';
import { logServerEvent } from '@/lib/server-logger';
import { slugify } from '@/lib/utils';

type PageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

type StageKey = 'organization' | 'project' | 'integrations' | 'repository' | 'extension' | 'finalize';

const stageOrder: StageKey[] = ['organization', 'project', 'integrations', 'repository', 'extension', 'finalize'];

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
    title: 'Connect GitHub Repository',
    description: 'Select the repository you want DioTest to monitor for test execution.',
  },
  extension: {
    title: 'Install the DioTest Recorder',
    description:
      'The browser extension captures real UI interactions and turns them into stable, reusable testing workflows.',
  },
  finalize: {
    title: 'Review Your Configuration',
    description:
      'Confirm your environment and integration settings before initializing the testing cluster.',
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

function resolveStage(stage: string | undefined, hasOrg: boolean, hasProject: boolean, hasGithub: boolean): StageKey {
  if (!hasOrg) return 'organization';
  if (!hasProject) return 'project';
  if (!stage) return hasGithub ? 'extension' : 'integrations';

  const requested = stage as StageKey;
  if (!stageOrder.includes(requested)) return hasGithub ? 'extension' : 'integrations';

  if (!hasGithub && (requested === 'extension' || requested === 'finalize')) {
    return 'repository';
  }

  return requested;
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
    <aside className="flex flex-col border-r border-white/6 bg-[#0b0c0f] px-5 pb-8 pt-10">
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

          return (
            <div
              key={stage}
              className={`relative flex items-center gap-3 rounded-[6px] px-3 py-3 text-sm font-medium transition ${
                active ? 'bg-white/5 text-white' : complete ? 'text-[#8fdaaf]' : 'text-[#7d8087]'
              }`}
            >
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
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t border-white/6 pt-6 text-sm text-[#777a82]">
        <div className="flex items-center gap-3">
          <span>◫</span>
          <span>Documentation</span>
        </div>
        <div className="flex items-center gap-3">
          <span>◌</span>
          <span>Support</span>
        </div>
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
        <Link href="#" className="hover:text-white">
          Privacy Policy
        </Link>
        <Link href="#" className="hover:text-white">
          Terms of Service
        </Link>
        <Link href="#" className="hover:text-white">
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
  const hasGithub = Boolean(bootstrap.githubConnection);
  const activeStage = resolveStage(resolvedParams?.stage, hasOrg, hasProject, hasGithub);
  const meta = stageMeta[activeStage];
  const durationMs = Date.now() - startedAt;
  logServerEvent('onboarding.rendered', {
    status: 'success',
    userId: user.id,
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
    durationMs,
    slow: durationMs > 500,
  });

  return (
    <main className="min-h-screen bg-[#0b0c0f] text-white">
      <OnboardingHeader />
      <div className="grid min-h-[calc(100vh-117px)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <OnboardingSidebar activeStage={activeStage} />

        <section className="px-8 py-12">
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
                <GithubStepForm
                  projectId={bootstrap.project.id}
                  repositoryOwner={
                    bootstrap.githubConnection?.repositoryOwner ?? bootstrap.organization?.slug ?? 'diotest-labs'
                  }
                  repositoryName={bootstrap.githubConnection?.repositoryName ?? 'core-engine'}
                />
              ) : null}
              {activeStage === 'extension' ? <ExtensionSetupStep /> : null}
              {activeStage === 'finalize' && bootstrap.project ? (
                <FinalReviewStep
                  organizationName={bootstrap.organization?.name ?? 'DioTest Labs'}
                  projectName={bootstrap.project?.name ?? 'Alpha Core'}
                  projectId={bootstrap.project.id}
                  repository={
                    bootstrap.githubConnection
                      ? `${bootstrap.githubConnection.repositoryOwner}/${bootstrap.githubConnection.repositoryName}`
                      : 'diotest/core'
                  }
                  integrations={bootstrap.integrations.map((integration) => integration.type)}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <OnboardingFooter />
    </main>
  );
}
