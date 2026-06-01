import type { ExtractionContext } from '@diotest/domain/analysis/types';

import { prisma } from '../../db.js';
import { decryptPayload, toAiSettingsView, toIntegrationSecretPreview, toOAuthSettingsView } from '../secrets.js';
import { getSecret } from '../settings-store.js';
import type { AiProviderConfig, OAuthProviderConfig } from '@diotest/domain/platform/types';

export type ProjectContextSnapshot = {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  repository: {
    connected: boolean;
    provider?: string;
    fullName?: string;
    defaultBranch?: string | null;
    webhookStatus?: string | null;
    providerUser?: string | null;
    lastSyncedAt?: string | null;
  };
  runtime: {
    ai:
      | {
          configured: boolean;
          preferredProvider: 'openai' | 'openrouter';
          model: string;
          selectedProviderHasKey: boolean;
          requiredKey: 'openai' | 'openrouter';
          activeKeyPreview: string | null;
          status: string;
          note: string;
        }
      | { configured: false };
    oauth: ReturnType<typeof toOAuthSettingsView> | { configured: false };
  };
  integrations: Array<{
    type: string;
    name: string;
    configJson: unknown;
    secretPreview: {
      hasStoredSecret: boolean;
      secretPreview: string[];
      health: {
        isConfigured: boolean;
        missing: string[];
      };
    };
  }>;
  settings: {
    project: Record<string, unknown>;
    organization: Record<string, unknown>;
  };
  operations: {
    actions: Array<{
      type: string;
      title: string;
      status: string;
      target: string;
      createdAt: string;
      completedAt: string | null;
    }>;
    tasks: Array<{
      type: string;
      title: string;
      status: string;
      error: string | null;
      createdAt: string;
      completedAt: string | null;
    }>;
  };
  url: string;
  repoName: string;
};

const supportedIntegrationTypes = ['JIRA', 'TRELLO', 'GOOGLE_SHEETS'] as const;

function isSupportedIntegrationType(type: string): type is (typeof supportedIntegrationTypes)[number] {
  return supportedIntegrationTypes.includes(type as (typeof supportedIntegrationTypes)[number]);
}

function asPatch(title: string, payload: unknown) {
  return `# ${title}\n${JSON.stringify(payload, null, 2)}`;
}

async function loadProjectContextSnapshot(projectId: string): Promise<ProjectContextSnapshot> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: true,
      repositoryConnection: true,
      integrations: true,
      actions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!project) {
    throw new Error('Project not found.');
  }

  const [orgSettings, projectSettings, oauthSecret, aiProjectSecret, aiOrgSecret] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        scope: 'ORGANIZATION',
        organizationId: project.organizationId,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.systemSetting.findMany({
      where: {
        scope: 'PROJECT',
        projectId,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    getSecret('SYSTEM', 'oauth.google'),
    getSecret('PROJECT', 'ai.project', project.organizationId, projectId),
    getSecret('ORGANIZATION', 'ai.org', project.organizationId),
  ]);

  const oauth = oauthSecret ? toOAuthSettingsView(decryptPayload<OAuthProviderConfig>(oauthSecret)) : null;
  const ai =
    aiProjectSecret
      ? toAiSettingsView(decryptPayload<AiProviderConfig>(aiProjectSecret))
      : aiOrgSecret
        ? toAiSettingsView(decryptPayload<AiProviderConfig>(aiOrgSecret))
        : null;
  const normalizedAi = ai
    ? {
        configured: ai.preferredProvider === 'openrouter' ? ai.hasOpenRouterKey : ai.hasOpenAiKey,
        preferredProvider: ai.preferredProvider,
        model: ai.model,
        selectedProviderHasKey: ai.preferredProvider === 'openrouter' ? ai.hasOpenRouterKey : ai.hasOpenAiKey,
        requiredKey: ai.preferredProvider,
        activeKeyPreview: ai.preferredProvider === 'openrouter' ? ai.openrouterApiKeyPreview : ai.openaiApiKeyPreview,
        status: ai.preferredProvider === 'openrouter'
          ? (ai.hasOpenRouterKey ? 'configured' : 'missing_openrouter_key')
          : (ai.hasOpenAiKey ? 'configured' : 'missing_openai_key'),
        note: ai.preferredProvider === 'openrouter'
          ? (ai.hasOpenRouterKey
            ? 'OpenRouter is the selected provider and has a stored key.'
            : 'OpenRouter is the selected provider and still needs a stored OpenRouter API key.')
          : (ai.hasOpenAiKey
            ? 'OpenAI is the selected provider and has a stored key.'
            : 'OpenAI is the selected provider and still needs a stored OpenAI API key.'),
      }
    : null;

  const integrationSummaries = await Promise.all(
    project.integrations.map(async (integration) => {
      const secret = await getSecret('PROJECT', `integration.${integration.type.toLowerCase()}`, undefined, projectId);
      const decrypted = secret ? decryptPayload<Record<string, unknown>>(secret) : null;
      const preview = isSupportedIntegrationType(integration.type)
        ? toIntegrationSecretPreview(integration.type, integration.configJson as Record<string, unknown>, decrypted)
        : {
            hasStoredSecret: Boolean(secret),
            secretPreview: [] as string[],
            health: {
              isConfigured: Boolean(secret),
              missing: [] as string[],
            },
          };
      return {
        type: integration.type,
        name: integration.name,
        configJson: integration.configJson,
        secretPreview: preview,
      };
    }),
  );

  const repoName = project.repositoryConnection?.fullName ?? `${project.organization.slug}/${project.slug}`;
  const url = project.repositoryConnection?.repositoryUrl ?? `https://app.diotest.local/projects/${project.slug}`;

  return {
    organization: {
      id: project.organization.id,
      name: project.organization.name,
      slug: project.organization.slug,
    },
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    repository: project.repositoryConnection
      ? {
          connected: true,
          provider: project.repositoryConnection.provider,
          fullName: project.repositoryConnection.fullName,
          defaultBranch: project.repositoryConnection.defaultBranch,
          webhookStatus: project.repositoryConnection.webhookStatus,
          providerUser: project.repositoryConnection.providerUser,
          lastSyncedAt: project.repositoryConnection.lastSyncedAt?.toISOString() ?? null,
        }
      : {
          connected: false,
        },
    runtime: {
      ai: normalizedAi ?? { configured: false },
      oauth: oauth ?? { configured: false },
    },
    integrations: integrationSummaries,
    settings: {
      project: Object.fromEntries(projectSettings.map((item) => [item.key, item.value])),
      organization: Object.fromEntries(orgSettings.map((item) => [item.key, item.value])),
    },
    operations: {
      actions: project.actions.map((action) => ({
        type: action.type,
        title: action.title,
        status: action.status,
        target: action.target,
        createdAt: action.createdAt.toISOString(),
        completedAt: action.completedAt?.toISOString() ?? null,
      })),
      tasks: project.tasks.map((task) => ({
        type: task.type,
        title: task.title,
        status: task.status,
        error: task.error,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString() ?? null,
      })),
    },
    url,
    repoName,
  };
}

export async function buildProjectAnalysisContext(projectId: string): Promise<ExtractionContext> {
  const snapshot = await loadProjectContextSnapshot(projectId);

  const files = [
    {
      path: 'project/profile.json',
      patch: asPatch('Project profile', {
        organization: snapshot.organization,
        project: snapshot.project,
      }),
      source: 'inferred' as const,
    },
    {
      path: 'repository/connection.json',
      patch: asPatch('Repository connection', snapshot.repository),
      source: 'inferred' as const,
    },
    {
      path: 'runtime/ai-settings.json',
      patch: asPatch('AI runtime settings', snapshot.runtime.ai),
      source: 'inferred' as const,
    },
    {
      path: 'runtime/oauth-settings.json',
      patch: asPatch('OAuth runtime settings', snapshot.runtime.oauth),
      source: 'inferred' as const,
    },
    {
      path: 'integrations/status.json',
      patch: asPatch('Integration status', snapshot.integrations),
      source: 'inferred' as const,
    },
    {
      path: 'settings/project-settings.json',
      patch: asPatch('Project settings', snapshot.settings.project),
      source: 'inferred' as const,
    },
    {
      path: 'settings/organization-settings.json',
      patch: asPatch('Organization settings', snapshot.settings.organization),
      source: 'inferred' as const,
    },
    {
      path: 'operations/recent-actions.json',
      patch: asPatch('Recent actions and tasks', snapshot.operations),
      source: 'inferred' as const,
    },
  ];

  return {
    pageType: 'pull_request',
    repo: snapshot.repoName,
    prNumber: undefined,
    commitSha: undefined,
    title: `Hosted project analysis for ${snapshot.project.name}`,
    description: snapshot.project.description ?? `Analyze the connected repository, runtime setup, integrations, and recent operations for ${snapshot.project.name}.`,
    files,
    url: snapshot.url,
    extractionSource: 'api',
  };
}

export async function buildProjectContextSnapshot(projectId: string): Promise<ProjectContextSnapshot> {
  return loadProjectContextSnapshot(projectId);
}
