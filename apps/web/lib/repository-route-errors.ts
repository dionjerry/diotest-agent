const SAFE_REPOSITORY_ERROR_PATTERNS = [
  /is not configured\.$/,
  /^GitHub App credentials are not configured\./,
  /^GitLab OAuth is not configured\./,
  /^Connect GitHub first\./,
  /^Connect GitLab first\./,
  /^Provider and projectId are required\.$/,
  /^Unsupported provider\.$/,
];

export function toSafeRepositoryErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message.trim();
  if (!message) return undefined;

  return SAFE_REPOSITORY_ERROR_PATTERNS.some((pattern) => pattern.test(message)) ? message : undefined;
}

export function buildRepositoryErrorRedirectPath(
  returnTo: string,
  errorCode: string,
  message?: string,
) {
  const [pathname, query = ''] = returnTo.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('error', errorCode);

  if (message) {
    params.set('message', message);
  } else {
    params.delete('message');
  }

  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
