import { redirect } from 'next/navigation';

import { AppApiError, getBootstrap } from '@/lib/api';
import { auth } from '@/lib/auth';

export type BootstrapGuardState = {
  user: Awaited<ReturnType<typeof requireUser>>;
  bootstrap: Awaited<ReturnType<typeof getBootstrap>> | null;
  unavailable: boolean;
  unavailableMessage?: string;
};

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  return session.user;
}

export async function requireOnboardedUser() {
  const user = await requireUser();
  try {
    const bootstrap = await getBootstrap(user.id);

    if (!bootstrap.organization || !bootstrap.project) {
      redirect('/onboarding');
    }

    return { user, bootstrap, unavailable: false } satisfies BootstrapGuardState;
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'unavailable') {
      return {
        user,
        bootstrap: null,
        unavailable: true,
        unavailableMessage: 'DioTest is temporarily unable to load project data. Check the API and database connection, then retry.',
      } satisfies BootstrapGuardState;
    }

    throw error;
  }
}

export async function requireOnboardingState() {
  const user = await requireUser();
  try {
    const bootstrap = await getBootstrap(user.id);
    return { user, bootstrap, unavailable: false } satisfies BootstrapGuardState;
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'unavailable') {
      return {
        user,
        bootstrap: null,
        unavailable: true,
        unavailableMessage: 'DioTest cannot reach the API or database right now. Restore connectivity and reload onboarding.',
      } satisfies BootstrapGuardState;
    }

    throw error;
  }
}
