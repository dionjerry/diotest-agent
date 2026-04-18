import { createSign, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

export type RepositoryProvider = 'GITHUB' | 'GITLAB';

export type RepositoryCandidate = {
  provider: RepositoryProvider;
  externalId: string;
  owner: string;
  namespace?: string;
  repositoryName: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
  installationId?: string;
  providerUser?: string;
};

export type BranchCandidate = {
  name: string;
  isDefault: boolean;
};

export type WebhookResult = {
  id?: string;
  status: 'configured' | 'failed';
  url?: string;
  error?: string;
};

export type GitLabOAuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userName?: string;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, '\n');
}

async function parseProviderError(response: Response, fallback: string) {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const message =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error_description === 'string' && json.error_description) ||
      (typeof json.error === 'string' && json.error) ||
      fallback;
    return `${fallback}: ${message}`;
  } catch {
    return body ? `${fallback}: ${body.slice(0, 240)}` : fallback;
  }
}

function buildGitHubAppJwt() {
  if (!env.github.appId || !env.github.appPrivateKey) {
    throw new Error('GitHub App credentials are not configured. Set GITHUB_APP_ID, GITHUB_APP_NAME, and GITHUB_APP_PRIVATE_KEY.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: env.github.appId,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(normalizePrivateKey(env.github.appPrivateKey));
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}

async function fetchGitHubInstallationToken(installationId: string) {
  const jwt = buildGitHubAppJwt();
  const response = await fetch(`${env.github.apiBaseUrl}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${jwt}`,
      'user-agent': 'diotest-agent',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitHub installation token request failed'));
  }

  const payload = (await response.json()) as { token: string };
  return payload.token;
}

export async function fetchGitHubInstallationRepositories(installationId: string) {
  const token = await fetchGitHubInstallationToken(installationId);
  const response = await fetch(`${env.github.apiBaseUrl}/installation/repositories?per_page=100`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'diotest-agent',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitHub repository list request failed'));
  }

  const payload = (await response.json()) as {
    repositories: Array<{
      id: number;
      name: string;
      full_name: string;
      html_url: string;
      default_branch: string;
      owner: { login: string };
    }>;
  };

  return payload.repositories.map<RepositoryCandidate>((repository) => ({
    provider: 'GITHUB',
    externalId: String(repository.id),
    owner: repository.owner.login,
    namespace: repository.owner.login,
    repositoryName: repository.name,
    fullName: repository.full_name,
    repositoryUrl: repository.html_url,
    defaultBranch: repository.default_branch || 'main',
    installationId,
  }));
}

export async function fetchGitHubBranches(installationId: string, owner: string, repositoryName: string, defaultBranch?: string) {
  const token = await fetchGitHubInstallationToken(installationId);
  const response = await fetch(`${env.github.apiBaseUrl}/repos/${owner}/${repositoryName}/branches?per_page=100`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'diotest-agent',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitHub branch list request failed'));
  }

  const payload = (await response.json()) as Array<{ name: string }>;
  return payload.map<BranchCandidate>((branch) => ({
    name: branch.name,
    isDefault: branch.name === defaultBranch,
  }));
}

export async function reconcileGitHubWebhook(installationId: string, owner: string, repositoryName: string, callbackUrl: string) {
  const token = await fetchGitHubInstallationToken(installationId);
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'diotest-agent',
    'x-github-api-version': '2022-11-28',
  };

  const hooksResponse = await fetch(`${env.github.apiBaseUrl}/repos/${owner}/${repositoryName}/hooks?per_page=100`, {
    headers,
    cache: 'no-store',
  });

  if (!hooksResponse.ok) {
    return {
      status: 'failed',
      error: await parseProviderError(hooksResponse, 'GitHub webhook lookup failed'),
    } satisfies WebhookResult;
  }

  const hooks = (await hooksResponse.json()) as Array<{
    id: number;
    config?: { url?: string };
    active?: boolean;
  }>;
  const existing = hooks.find((hook) => hook.config?.url === callbackUrl);
  if (existing) {
    return {
      id: String(existing.id),
      status: 'configured',
      url: callbackUrl,
    } satisfies WebhookResult;
  }

  const createResponse = await fetch(`${env.github.apiBaseUrl}/repos/${owner}/${repositoryName}/hooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['push', 'pull_request', 'pull_request_review', 'issue_comment'],
      config: {
        url: callbackUrl,
        content_type: 'json',
        secret: env.github.webhookSecret || undefined,
        insecure_ssl: '0',
      },
    }),
  });

  if (!createResponse.ok) {
    return {
      status: 'failed',
      error: await parseProviderError(createResponse, 'GitHub webhook creation failed'),
    } satisfies WebhookResult;
  }

  const created = (await createResponse.json()) as { id: number; config?: { url?: string } };
  return {
    id: String(created.id),
    status: 'configured',
    url: created.config?.url ?? callbackUrl,
  } satisfies WebhookResult;
}

export function buildGitHubInstallUrl(state: string) {
  if (!env.github.appName) {
    throw new Error('GITHUB_APP_NAME is not configured.');
  }

  const url = new URL(`/apps/${env.github.appName}/installations/new`, env.github.appBaseUrl);
  url.searchParams.set('state', state);
  return url.toString();
}

export function buildGitLabAuthorizeUrl(state: string, redirectUri: string) {
  if (!env.gitlab.clientId) {
    throw new Error('GITLAB_CLIENT_ID is not configured.');
  }

  const url = new URL('/oauth/authorize', env.gitlab.baseUrl);
  url.searchParams.set('client_id', env.gitlab.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read_user read_api');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGitLabCode(code: string, redirectUri: string) {
  if (!env.gitlab.clientId || !env.gitlab.clientSecret) {
    throw new Error('GitLab OAuth is not configured. Set GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET.');
  }

  const body = new URLSearchParams({
    client_id: env.gitlab.clientId,
    client_secret: env.gitlab.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${env.gitlab.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitLab OAuth token exchange failed'));
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
  } satisfies GitLabOAuthSession;
}

export async function fetchGitLabUser(accessToken: string) {
  const response = await fetch(`${env.gitlab.baseUrl}/api/v4/user`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitLab user lookup failed'));
  }

  return (await response.json()) as { username: string; name?: string };
}

export async function fetchGitLabProjects(accessToken: string, providerUser?: string) {
  const url = new URL('/api/v4/projects', env.gitlab.baseUrl);
  url.searchParams.set('membership', 'true');
  url.searchParams.set('min_access_level', '30');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('simple', 'true');
  url.searchParams.set('order_by', 'last_activity_at');
  url.searchParams.set('sort', 'desc');

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitLab project list request failed'));
  }

  const payload = (await response.json()) as Array<{
    id: number;
    path: string;
    path_with_namespace: string;
    web_url: string;
    default_branch?: string;
    namespace?: { full_path?: string };
  }>;

  return payload.map<RepositoryCandidate>((project) => ({
    provider: 'GITLAB',
    externalId: String(project.id),
    owner: project.namespace?.full_path?.split('/')[0] ?? providerUser ?? 'gitlab',
    namespace: project.namespace?.full_path,
    repositoryName: project.path,
    fullName: project.path_with_namespace,
    repositoryUrl: project.web_url,
    defaultBranch: project.default_branch || 'main',
    providerUser,
  }));
}

export async function fetchGitLabBranches(accessToken: string, projectId: string, defaultBranch?: string) {
  const response = await fetch(`${env.gitlab.baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches?per_page=100`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseProviderError(response, 'GitLab branch list request failed'));
  }

  const payload = (await response.json()) as Array<{ name: string }>;
  return payload.map<BranchCandidate>((branch) => ({
    name: branch.name,
    isDefault: branch.name === defaultBranch,
  }));
}

export async function reconcileGitLabWebhook(projectToken: string, projectId: string, callbackUrl: string) {
  const headers = {
    'PRIVATE-TOKEN': projectToken,
    'content-type': 'application/json',
  };
  const hooksResponse = await fetch(`${env.gitlab.baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/hooks`, {
    headers,
    cache: 'no-store',
  });

  if (!hooksResponse.ok) {
    return {
      status: 'failed',
      error: await parseProviderError(hooksResponse, 'GitLab webhook lookup failed'),
    } satisfies WebhookResult;
  }

  const hooks = (await hooksResponse.json()) as Array<{ id: number; url: string }>;
  const existing = hooks.find((hook) => hook.url === callbackUrl);
  if (existing) {
    return {
      id: String(existing.id),
      status: 'configured',
      url: callbackUrl,
    } satisfies WebhookResult;
  }

  const createResponse = await fetch(`${env.gitlab.baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/hooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: callbackUrl,
      push_events: true,
      merge_requests_events: true,
      note_events: true,
      enable_ssl_verification: true,
      token: randomBytes(12).toString('hex'),
    }),
  });

  if (!createResponse.ok) {
    return {
      status: 'failed',
      error: await parseProviderError(createResponse, 'GitLab webhook creation failed'),
    } satisfies WebhookResult;
  }

  const created = (await createResponse.json()) as { id: number; url: string };
  return {
    id: String(created.id),
    status: 'configured',
    url: created.url,
  } satisfies WebhookResult;
}
