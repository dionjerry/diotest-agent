import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { auth } from '@/lib/auth';
import { getBootstrap } from '@/lib/api';
import { getGoogleOAuthState } from '@/lib/platform-config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const googleState = await getGoogleOAuthState();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const next = resolvedParams?.next;
  const session = await auth();
  if (session?.user?.id) {
    const bootstrap = await getBootstrap(session.user.id);
    redirect(next || (bootstrap.onboardingComplete ? '/app' : '/onboarding'));
  }

  return (
    <AuthShell
      mode="login"
      title="The testing-agent platform that turns code changes into reusable test knowledge."
      description="Automate complex regression suites with autonomous agents that learn from your codebase. Built for high-velocity engineering teams."
    >
      <LoginForm googleEnabled={googleState.enabled} googleSource={googleState.source} next={next} />
    </AuthShell>
  );
}
