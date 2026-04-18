import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { fetchGitHubInstallationRepositories, fetchGitLabProjects } from '@/lib/repository-provider-api';
import { decodeCookieValue, REPOSITORY_FLOW_COOKIES, type GitHubInstallationCookie, type GitLabOAuthCookie } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get('provider')?.toUpperCase();
  const projectId = request.nextUrl.searchParams.get('projectId')?.trim();
  if (!provider || !projectId) {
    return NextResponse.json({ ok: false, message: 'Provider and projectId are required.' }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();

    if (provider === 'GITHUB') {
      const githubSession = decodeCookieValue<GitHubInstallationCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.githubInstallation)?.value);
      if (!githubSession || githubSession.projectId !== projectId) {
        return NextResponse.json({ ok: false, message: 'Connect GitHub first.' }, { status: 400 });
      }

      const repositories = await fetchGitHubInstallationRepositories(githubSession.installationId);
      logServerEvent('repository.github.repos.loaded', {
        status: 'success',
        userId: session.user.id,
        projectId,
        repositoryCount: repositories.length,
      });
      return NextResponse.json({ ok: true, repositories });
    }

    if (provider === 'GITLAB') {
      const gitlabSession = decodeCookieValue<GitLabOAuthCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.gitlabOAuth)?.value);
      if (!gitlabSession || gitlabSession.projectId !== projectId) {
        return NextResponse.json({ ok: false, message: 'Connect GitLab first.' }, { status: 400 });
      }

      const repositories = await fetchGitLabProjects(gitlabSession.accessToken, gitlabSession.userName);
      logServerEvent('repository.gitlab.projects.loaded', {
        status: 'success',
        userId: session.user.id,
        projectId,
        repositoryCount: repositories.length,
      });
      return NextResponse.json({ ok: true, repositories });
    }

    return NextResponse.json({ ok: false, message: 'Unsupported provider.' }, { status: 400 });
  } catch (error) {
    logServerError('repository.list.failed', 'provider_error', {
      status: 'failed',
      userId: session.user.id,
      projectId,
      provider,
    }, error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to load repositories.' },
      { status: 500 },
    );
  }
}
