import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { auth } from '@/lib/auth';
import { getBootstrap } from '@/lib/api';
import { getGoogleOAuthState } from '@/lib/platform-config';

export default async function LoginPage() {
  const googleState = await getGoogleOAuthState();
  const session = await auth();
  if (session?.user?.id) {
    const bootstrap = await getBootstrap(session.user.id);
    redirect(bootstrap.organization && bootstrap.project ? '/app' : '/onboarding');
  }

  return (
    <AuthShell
      mode="login"
      title="The testing-agent platform that turns code changes into reusable test knowledge."
      description="Automate complex regression suites with autonomous agents that learn from your codebase. Built for high-velocity engineering teams."
    >
      <LoginForm googleEnabled={googleState.enabled} googleSource={googleState.source} />
    </AuthShell>
  );
}
