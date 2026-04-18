import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { exchangeGitLabCode, fetchGitLabUser } from '@/lib/repository-provider-api';
import { decodeCookieValue, encodeCookieValue, REPOSITORY_FLOW_COOKIES, type ProviderStateCookie } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const storedState = decodeCookieValue<ProviderStateCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.gitlabState)?.value);
  cookieStore.delete(REPOSITORY_FLOW_COOKIES.gitlabState);

  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const returnTo = storedState?.returnTo || '/onboarding?stage=repository';

  if (!storedState || !state || storedState.nonce !== state || !code) {
    logServerError('repository.gitlab.callback.failed', 'auth_error', { status: 'failed' });
    return NextResponse.redirect(new URL(`${returnTo}&error=gitlab-callback`, request.url));
  }

  try {
    const redirectUri = `${env.nextAuthUrl}/api/repositories/gitlab/callback`;
    const oauth = await exchangeGitLabCode(code, redirectUri);
    const user = await fetchGitLabUser(oauth.accessToken);

    cookieStore.set(REPOSITORY_FLOW_COOKIES.gitlabOAuth, encodeCookieValue({
      ...oauth,
      userName: user.username,
      projectId: storedState.projectId,
    }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });

    logServerEvent('repository.gitlab.auth.completed', {
      status: 'success',
      projectId: storedState.projectId,
      providerUser: user.username,
    });

    return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}provider=gitlab`, request.url));
  } catch (error) {
    logServerError('repository.gitlab.callback.failed', 'provider_error', { status: 'failed', projectId: storedState.projectId }, error);
    return NextResponse.redirect(new URL(`${returnTo}&error=gitlab-callback`, request.url));
  }
}
