import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { buildGitHubInstallUrl } from '@/lib/repository-provider-api';
import { REPOSITORY_FLOW_COOKIES, createProviderState, encodeCookieValue } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const projectId = request.nextUrl.searchParams.get('projectId')?.trim();
  const returnTo = request.nextUrl.searchParams.get('returnTo')?.trim() || '/onboarding?stage=repository';
  if (!projectId) {
    logServerError('repository.github.connect.failed', 'validation_error', { status: 'failed', userId: session.user.id });
    return NextResponse.redirect(new URL(`${returnTo}&error=missing-project`, request.url));
  }

  try {
    const state = createProviderState(projectId, returnTo);
    const cookieStore = await cookies();
    cookieStore.set(REPOSITORY_FLOW_COOKIES.githubState, encodeCookieValue(state), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });

    logServerEvent('repository.github.auth.started', {
      status: 'success',
      userId: session.user.id,
      projectId,
    });

    return NextResponse.redirect(buildGitHubInstallUrl(state.nonce));
  } catch (error) {
    logServerError('repository.github.connect.failed', 'provider_error', {
      status: 'failed',
      userId: session.user.id,
      projectId,
    }, error);
    return NextResponse.redirect(new URL(`${returnTo}&error=github-connect`, request.url));
  }
}
