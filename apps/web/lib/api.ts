import { env } from '@/lib/env';
import type { OnboardingProgress } from '@/lib/onboarding-state';
import type { AnalyzeResult } from '@diotest/domain/analysis/types';
import type { AgentAction, Task } from '@diotest/domain/platform/types';
import type { UiRecorderGenerationResult, UiRecorderGenerationOptions, UiRecorderSession } from '@diotest/domain/recorder/types';

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
    currentUserRole?: string;
    memberCount?: number;
    projectCount?: number;
  } | null;
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
  repositoryConnection: {
    id: string;
    provider: 'GITHUB' | 'GITLAB';
    externalId: string;
    owner: string;
    namespace?: string | null;
    repositoryName: string;
    fullName: string;
    repositoryUrl: string;
    defaultBranch: string;
    installationId?: string | null;
    providerUser?: string | null;
    webhookId?: string | null;
    webhookStatus: string;
    webhookUrl?: string | null;
    webhookLastError?: string | null;
    lastSyncedAt?: string | null;
  } | null;
  integrations: Array<{
    id: string;
    type: string;
    name: string;
    configJson?: Record<string, unknown>;
    hasStoredSecret?: boolean;
  }>;
  onboardingComplete: boolean;
  onboardingProgress: OnboardingProgress | null;
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
  repositoryConnection: BootstrapResponse['repositoryConnection'];
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

export type SettingsExportResponse = SettingsResponse;

export type EnvironmentSettingEntry = {
  key: string;
  displayType: 'secret' | 'text' | 'status' | 'number' | 'json';
  valuePreview: string;
  isSecret: boolean;
  isEditable: boolean;
  updatedAt: string | null;
  scope: 'system' | 'organization' | 'project' | 'integration' | 'repository';
  source: string;
};

export type EnvironmentSettingsResponse = {
  entries: EnvironmentSettingEntry[];
};

export type ActionsResponse = {
  actions: AgentAction[];
  tasks: Task[];
};

export type RuntimeAnalysisResponse = AnalyzeResult;

export type RuntimeRecorderResponse =
  | { ok: true; result: UiRecorderGenerationResult }
  | { ok: false; error: string; code?: string };

export type RuntimeBrowserChecksResponse = {
  summary?: string;
  details?: Record<string, unknown>;
};

export type RuntimeAgentRecommendationsResponse = {
  summary: string;
  recommendations: Array<{
    title: string;
    body: string;
    buttonLabel: string;
    actionType: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
    target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
    priority: 'high' | 'medium' | 'low';
    tone: 'success' | 'warn' | 'neutral' | 'danger';
    readOnly: boolean;
    approvalRequired: boolean;
    rationale: string;
    input: Record<string, unknown>;
  }>;
};

export type RuntimeAgentRunResponse = {
  summary: string;
  plan: string[];
  investigationAreas: string[];
  evidence: Array<{
    tool: string;
    takeaway: string;
  }>;
  proposedActions: Array<{
    title: string;
    description: string;
    actionType: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
    target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
    readOnly: boolean;
    approvalRequired: boolean;
    input: Record<string, unknown>;
  }>;
};

export type RuntimeHealthResponse = {
  ok: true;
  scope: 'project' | 'organization' | 'system';
  provider: 'openai' | 'openrouter';
  model: string;
  validation: {
    status: 'ok';
    providerEcho: 'openai' | 'openrouter';
    modelEcho: string;
    scopeEcho: 'project' | 'organization' | 'system';
    note: string;
  };
};

export type AgentThreadSummary = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
};

export type AgentThreadMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentThreadDetail = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messages: AgentThreadMessage[];
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

export function updateUserProfile(payload: {
  userId: string;
  name: string;
}) {
  return request<{ ok: true }>(`/users/${payload.userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: payload.name }),
  });
}

export function updateOrganizationProfile(payload: {
  organizationId: string;
  name: string;
  slug: string;
}) {
  return request<{ ok: true }>(`/organizations/${payload.organizationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: payload.name, slug: payload.slug }),
  });
}

export function updateProjectProfile(payload: {
  projectId: string;
  name: string;
  slug: string;
  description?: string;
}) {
  return request<{ ok: true }>(`/projects/${payload.projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      description: payload.description ?? null,
    }),
  });
}

export function deleteProject(projectId: string) {
  return request<{ ok: true }>(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export function saveRepositoryConnection(payload: {
  projectId: string;
  provider: 'GITHUB' | 'GITLAB';
  externalId: string;
  owner: string;
  namespace?: string;
  repositoryName: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
  installationId?: string;
  providerUser?: string;
  webhookId?: string;
  webhookStatus?: string;
  webhookUrl?: string;
  webhookLastError?: string;
  lastSyncedAt?: string;
}) {
  return request<{ repositoryConnectionId: string }>('/repository-connections', {
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

export function getSettings(
  payload: { organizationId?: string; projectId?: string },
  options?: { fresh?: boolean },
) {
  const params = new URLSearchParams();
  if (payload.organizationId) params.set('organizationId', payload.organizationId);
  if (payload.projectId) params.set('projectId', payload.projectId);

  return request<SettingsResponse>(
    `/settings?${params.toString()}`,
    undefined,
    options?.fresh
      ? { cacheMode: 'no-store' }
      : {
          revalidate: 30,
          tags: [settingsTag(payload.organizationId, payload.projectId)],
        },
  );
}

export function getSettingsExport(payload: { organizationId?: string; projectId?: string }) {
  const params = new URLSearchParams();
  if (payload.organizationId) params.set('organizationId', payload.organizationId);
  if (payload.projectId) params.set('projectId', payload.projectId);

  return request<SettingsExportResponse>(`/settings/export?${params.toString()}`);
}

export function getEnvironmentSettings(payload: { organizationId?: string; projectId?: string }) {
  const params = new URLSearchParams();
  if (payload.organizationId) params.set('organizationId', payload.organizationId);
  if (payload.projectId) params.set('projectId', payload.projectId);

  return request<EnvironmentSettingsResponse>(`/settings/environment?${params.toString()}`, undefined, {
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

export function saveRepositorySecret(payload: {
  projectId: string;
  provider: 'GITLAB';
  secretJson?: Record<string, unknown>;
}) {
  return request<{ ok: true }>('/settings/repositories/secret', {
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

export function runHostedAnalysis(payload: {
  organizationId: string;
  projectId: string;
  includeDeepScan?: boolean;
}) {
  return request<RuntimeAnalysisResponse>('/runtime/analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runHostedRecorderGeneration(payload: {
  organizationId: string;
  projectId: string;
  sessionId?: string;
  session?: UiRecorderSession;
  options?: UiRecorderGenerationOptions;
}) {
  return request<RuntimeRecorderResponse>('/runtime/recorder/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runHostedBrowserChecks(payload: {
  organizationId: string;
  projectId: string;
  input?: Record<string, unknown>;
}) {
  return request<RuntimeBrowserChecksResponse>('/runtime/browser-checks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getHostedAgentRecommendations(payload: {
  organizationId: string;
  projectId: string;
  focus?: string;
}) {
  return request<RuntimeAgentRecommendationsResponse>('/runtime/agents/recommendations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runHostedAgentExecution(payload: {
  organizationId: string;
  projectId: string;
  goal: string;
  focus?: string;
  allowedActionTypes?: Array<'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets'>;
}) {
  return request<RuntimeAgentRunResponse>('/runtime/agents/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testHostedRuntime(payload: {
  organizationId?: string;
  projectId?: string;
  preferredProvider?: 'openai' | 'openrouter';
  model?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}) {
  return request<RuntimeHealthResponse>('/runtime/health', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAgentThreads(projectId: string) {
  return request<{ threads: AgentThreadSummary[] }>(`/agent-threads?projectId=${projectId}`);
}

export function getAgentThread(threadId: string) {
  return request<{ thread: AgentThreadDetail }>(`/agent-threads/${threadId}`);
}

export function createAgentThread(payload: {
  organizationId: string;
  projectId: string;
  content: string;
}) {
  return request<{ thread: AgentThreadDetail }>('/agent-threads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendAgentThreadMessage(payload: {
  threadId: string;
  organizationId: string;
  projectId: string;
  content: string;
}) {
  return request<{ thread: AgentThreadDetail }>(`/agent-threads/${payload.threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      content: payload.content,
    }),
  });
}

export type OrgMember = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

export type OrgInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

export function getOrganizationMembers(organizationId: string) {
  return request<{ members: OrgMember[] }>(`/organizations/${organizationId}/members`);
}

export function getOrganizationInvites(organizationId: string) {
  return request<{ invites: OrgInvite[] }>(`/organizations/${organizationId}/invites`);
}

export function inviteOrganizationMember(
  organizationId: string,
  userId: string,
  payload: {
    email: string;
    role: 'owner' | 'admin' | 'member';
  },
) {
  return request<{ inviteId: string; rawToken: string }>(`/organizations/${organizationId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, userId }),
  });
}

export function revokeOrganizationInvite(organizationId: string, userId: string, inviteId: string) {
  return request<{ success: boolean }>(`/organizations/${organizationId}/invites/${inviteId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

export function removeOrganizationMember(organizationId: string, userId: string, memberId: string) {
  return request<{ success: boolean }>(`/organizations/${organizationId}/members/${memberId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

export function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  memberId: string,
  payload: { role: 'owner' | 'admin' | 'member' },
) {
  return request<OrgMember>(`/organizations/${organizationId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, userId }),
  });
}

export function transferOrganizationOwnership(organizationId: string, userId: string, payload: { newOwnerUserId: string }) {
  return request<{ success: boolean }>(`/organizations/${organizationId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, userId }),
  });
}

export function deleteOrganization(organizationId: string, userId: string) {
  return request<{ success: boolean }>(`/organizations/${organizationId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}
