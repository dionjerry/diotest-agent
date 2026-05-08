import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { fetchGitHubBranches, fetchGitLabBranches } from '@/lib/repository-provider-api';
import { decodeCookieValue, REPOSITORY_FLOW_COOKIES, type GitHubInstallationCookie, type GitLabOAuthCookie } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get('provider')?.toUpperCase();
  const projectId = request.nextUrl.searchParams.get('projectId')?.trim();
  const owner = request.nextUrl.searchParams.get('owner')?.trim();
  const repositoryName = request.nextUrl.searchParams.get('repositoryName')?.trim();
  const externalId = request.nextUrl.searchParams.get('externalId')?.trim();
  const defaultBranch = request.nextUrl.searchParams.get('defaultBranch')?.trim() || undefined;

  if (!provider || !projectId) {
    return NextResponse.json({ ok: false, message: 'Provider and projectId are required.' }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    if (provider === 'GITHUB') {
      const githubSession = decodeCookieValue<GitHubInstallationCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.githubInstallation)?.value);
      if (!githubSession || githubSession.projectId !== projectId || !owner || !repositoryName) {
        return NextResponse.json({ ok: false, message: 'Connect GitHub and choose a repository first.' }, { status: 400 });
      }

      const branches = await fetchGitHubBranches(githubSession.installationId, owner, repositoryName, defaultBranch);
      logServerEvent('repository.github.branches.loaded', {
        status: 'success',
        userId: session.user.id,
        projectId,
        repositoryName,
        branchCount: branches.length,
      });
      return NextResponse.json({ ok: true, branches });
    }

    if (provider === 'GITLAB') {
      const gitlabSession = decodeCookieValue<GitLabOAuthCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.gitlabOAuth)?.value);
      if (!gitlabSession || gitlabSession.projectId !== projectId || !externalId) {
        return NextResponse.json({ ok: false, message: 'Connect GitLab and choose a project first.' }, { status: 400 });
      }

      const branches = await fetchGitLabBranches(gitlabSession.accessToken, externalId, defaultBranch);
      logServerEvent('repository.gitlab.branches.loaded', {
        status: 'success',
        userId: session.user.id,
        projectId,
        externalId,
        branchCount: branches.length,
      });
      return NextResponse.json({ ok: true, branches });
    }

    return NextResponse.json({ ok: false, message: 'Unsupported provider.' }, { status: 400 });
  } catch (error) {
    logServerError('repository.branches.failed', 'provider_error', {
      status: 'failed',
      userId: session.user.id,
      projectId,
      provider,
    }, error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to load branches.' },
      { status: 500 },
    );
  }
}
