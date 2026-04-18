import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { decodeCookieValue, encodeCookieValue, REPOSITORY_FLOW_COOKIES, type ProviderStateCookie } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const storedState = decodeCookieValue<ProviderStateCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.githubState)?.value);
  cookieStore.delete(REPOSITORY_FLOW_COOKIES.githubState);

  const state = request.nextUrl.searchParams.get('state');
  const installationId = request.nextUrl.searchParams.get('installation_id');
  const setupAction = request.nextUrl.searchParams.get('setup_action') ?? undefined;
  const returnTo = storedState?.returnTo || '/onboarding?stage=repository';

  if (!storedState || !state || storedState.nonce !== state || !installationId) {
    logServerError('repository.github.callback.failed', 'auth_error', { status: 'failed' });
    return NextResponse.redirect(new URL(`${returnTo}&error=github-callback`, request.url));
  }

  cookieStore.set(REPOSITORY_FLOW_COOKIES.githubInstallation, encodeCookieValue({
    installationId,
    setupAction,
    projectId: storedState.projectId,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });

  logServerEvent('repository.github.auth.completed', {
    status: 'success',
    projectId: storedState.projectId,
    installationId,
    setupAction,
  });

  return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}provider=github`, request.url));
}
