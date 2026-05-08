export type OnboardingStage =
  | 'organization'
  | 'project'
  | 'integrations'
  | 'repository'
  | 'extension'
  | 'finalize';

export type OnboardingProgress = {
  lastVisitedStage?: OnboardingStage;
  integrationsSkipped?: boolean;
  repositorySkipped?: boolean;
  extensionSkipped?: boolean;
};

export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
export const ONBOARDING_PROGRESS_KEY = 'onboarding_progress';
export const onboardingStageOrder: OnboardingStage[] = [
  'organization',
  'project',
  'integrations',
  'repository',
  'extension',
  'finalize',
];

const stageSet = new Set<OnboardingStage>(onboardingStageOrder);

export function isOnboardingStage(value: string | undefined): value is OnboardingStage {
  return Boolean(value) && stageSet.has(value as OnboardingStage);
}

export function parseOnboardingProgress(value: unknown): OnboardingProgress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const progress: OnboardingProgress = {};

  if (typeof raw.lastVisitedStage === 'string' && isOnboardingStage(raw.lastVisitedStage)) {
    progress.lastVisitedStage = raw.lastVisitedStage;
  }

  if (typeof raw.integrationsSkipped === 'boolean') {
    progress.integrationsSkipped = raw.integrationsSkipped;
  }

  if (typeof raw.repositorySkipped === 'boolean') {
    progress.repositorySkipped = raw.repositorySkipped;
  }

  if (typeof raw.extensionSkipped === 'boolean') {
    progress.extensionSkipped = raw.extensionSkipped;
  }

  return Object.keys(progress).length ? progress : null;
}

export function mergeOnboardingProgress(
  current: OnboardingProgress | null | undefined,
  patch: Partial<OnboardingProgress>,
): OnboardingProgress {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export function mergeStageProgress(currentStage: OnboardingStage | undefined, nextStage: OnboardingStage | undefined) {
  if (!currentStage) return nextStage;
  if (!nextStage) return currentStage;

  return onboardingStageOrder.indexOf(nextStage) > onboardingStageOrder.indexOf(currentStage) ? nextStage : currentStage;
}
