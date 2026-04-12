import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignupForm } from '@/components/auth/signup-form';
import { auth } from '@/lib/auth';
import { getBootstrap } from '@/lib/api';
import { getGoogleOAuthState } from '@/lib/platform-config';

export default async function SignupPage() {
  const googleState = await getGoogleOAuthState();
  const session = await auth();
  if (session?.user?.id) {
    const bootstrap = await getBootstrap(session.user.id);
    redirect(bootstrap.organization && bootstrap.project ? '/app' : '/onboarding');
  }

  return (
    <AuthShell
      mode="signup"
      title="Deploy agents with surgical precision."
      description="The monolithic environment for automated testing. Built for engineers who demand technical excellence and high-stakes reliability."
    >
      <SignupForm googleEnabled={googleState.enabled} googleSource={googleState.source} />
    </AuthShell>
  );
}
