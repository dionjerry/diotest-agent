import { env } from '@/lib/env';
import type { AgentAction, Task } from '@diotest/domain/platform/types';

export class AppApiError extends Error {
  statusCode?: number;
  code: 'unavailable' | 'request_failed';

  constructor(message: string, options: { code: 'unavailable' | 'request_failed'; statusCode?: number }) {
    super(message);
    this.name = 'AppApiError';
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

function bootstrapTag(userId: string) {
  return `bootstrap:${userId}`;
}

function settingsTag(organizationId?: string, projectId?: string) {
  return `settings:${organizationId ?? 'system'}:${projectId ?? 'none'}`;
}

type RequestOptions = {
  cacheMode?: RequestCache;
  revalidate?: number;
  tags?: string[];
};

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions) {
  let response: Response;
  try {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const useCachedRead = method === 'GET' && (options?.revalidate !== undefined || options?.tags?.length);
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': env.internalApiKey,
        ...(init?.headers ?? {}),
      },
      cache: options?.cacheMode ?? (useCachedRead ? 'force-cache' : 'no-store'),
      next: useCachedRead
        ? {
            revalidate: options?.revalidate,
            tags: options?.tags,
          }
        : undefined,
    });
  } catch {
    throw new AppApiError('The DioTest API is unavailable right now.', { code: 'unavailable' });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Unknown API error' }));
    const message = payload.message ?? 'API request failed';
    if (response.status >= 500) {
      throw new AppApiError(message, { code: 'unavailable', statusCode: response.status });
    }

    throw new AppApiError(message, { code: 'request_failed', statusCode: response.status });
  }

  return (await response.json()) as T;
}

export type BootstrapResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
  githubConnection: {
    id: string;
    repositoryOwner: string;
    repositoryName: string;
    defaultBranch: string;
    webhookStatus: string;
  } | null;
  integrations: Array<{
    id: string;
    type: string;
    name: string;
    configJson?: Record<string, unknown>;
    hasStoredSecret?: boolean;
  }>;
};

export type SettingsResponse = {
  infrastructure: string[];
  oauth: {
    enabled: boolean;
    provider: 'google';
    clientId: string;
    clientSecretPreview: string | null;
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    hasStoredSecret: boolean;
  };
  ai: {
    preferredProvider: 'openai' | 'openrouter';
    model: string;
    openaiApiKeyPreview: string | null;
    openrouterApiKeyPreview: string | null;
    hasOpenAiKey: boolean;
    hasOpenRouterKey: boolean;
  };
  systemSettings: Record<string, unknown>;
  projectSettings: Record<string, unknown>;
  integrations: Array<{
    id: string;
    type: string;
    name: string;
    configJson: Record<string, unknown>;
    hasStoredSecret: boolean;
    secretPreview: string[];
    health: {
      isConfigured: boolean;
      missing: string[];
    };
  }>;
};

export type ActionsResponse = {
  actions: AgentAction[];
  tasks: Task[];
};

export function getBootstrap(userId: string) {
  return request<BootstrapResponse>(`/bootstrap?userId=${userId}`, undefined, {
    revalidate: 15,
    tags: [bootstrapTag(userId)],
  });
}

export function createOrganization(payload: { userId: string; name: string; slug: string }) {
  return request<{ organizationId: string }>('/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createProject(payload: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
}) {
  return request<{ projectId: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveGithubConnection(payload: {
  projectId: string;
  repositoryOwner: string;
  repositoryName: string;
  defaultBranch: string;
  installationId?: string;
}) {
  return request<{ githubConnectionId: string }>('/github-connections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveIntegration(payload: {
  projectId: string;
  type: 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';
  name: string;
  configJson: Record<string, unknown>;
}) {
  return request<{ integrationId: string }>('/integrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveSystemSetting(payload: {
  scope: 'SYSTEM' | 'ORGANIZATION' | 'PROJECT';
  organizationId?: string;
  projectId?: string;
  key: string;
  value: Record<string, unknown>;
}) {
  return request<{ settingId: string }>('/system-settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getSettings(payload: { organizationId?: string; projectId?: string }) {
  const params = new URLSearchParams();
  if (payload.organizationId) params.set('organizationId', payload.organizationId);
  if (payload.projectId) params.set('projectId', payload.projectId);

  return request<SettingsResponse>(`/settings?${params.toString()}`, undefined, {
    revalidate: 30,
    tags: [settingsTag(payload.organizationId, payload.projectId)],
  });
}

export function saveOAuthSettings(payload: {
  organizationId?: string;
  enabled: boolean;
  provider: 'google';
  clientId: string;
  clientSecret?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}) {
  return request<{ ok: true }>('/settings/oauth', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveAiSettings(payload: {
  organizationId?: string;
  projectId?: string;
  preferredProvider: 'openai' | 'openrouter';
  model: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}) {
  return request<{ ok: true }>('/settings/ai', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveIntegrationSecret(payload: {
  projectId: string;
  type: 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';
  secretJson: Record<string, unknown>;
}) {
  return request<{ ok: true }>('/settings/integrations/secret', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getActions(projectId: string) {
  return request<ActionsResponse>(`/actions?projectId=${projectId}`);
}

export function createAgentAction(payload: {
  projectId: string;
  type: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
  target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
  targetId?: string;
  title: string;
  description: string;
  readOnly: boolean;
  approvalRequired: boolean;
  input?: Record<string, unknown>;
}) {
  return request<{ action: AgentAction }>('/actions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function approveAgentAction(actionId: string) {
  return request<{ action: AgentAction }>('/actions/approve', {
    method: 'POST',
    body: JSON.stringify({ actionId }),
  });
}
