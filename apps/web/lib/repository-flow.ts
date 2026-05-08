import { randomBytes } from 'node:crypto';

export const REPOSITORY_FLOW_COOKIES = {
  githubState: 'diotest.repo.github.state',
  githubInstallation: 'diotest.repo.github.installation',
  gitlabState: 'diotest.repo.gitlab.state',
  gitlabOAuth: 'diotest.repo.gitlab.oauth',
} as const;

export type ProviderStateCookie = {
  nonce: string;
  projectId: string;
  returnTo: string;
};

export type GitHubInstallationCookie = {
  installationId: string;
  setupAction?: string;
  projectId: string;
};

export type GitLabOAuthCookie = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userName?: string;
  projectId: string;
};

export function createProviderState(projectId: string, returnTo: string) {
  return {
    nonce: randomBytes(18).toString('hex'),
    projectId,
    returnTo,
  } satisfies ProviderStateCookie;
}

export function encodeCookieValue(value: object) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCookieValue<T>(value?: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
