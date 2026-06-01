import { Prisma, type IntegrationConnection, type SystemSetting } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AiProviderConfig, OAuthProviderConfig } from '@diotest/domain/platform/types';

import { prisma } from '../db.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';
import { decryptPayload, toAiSettingsView, toIntegrationSecretPreview, toOAuthSettingsView } from '../lib/secrets.js';
import { getSecret, upsertSecret, upsertSetting } from '../lib/settings-store.js';

const supportedIntegrationTypes = ['JIRA', 'TRELLO', 'GOOGLE_SHEETS'] as const;
type SupportedIntegrationType = (typeof supportedIntegrationTypes)[number];

function isSupportedIntegrationType(type: string): type is SupportedIntegrationType {
  return supportedIntegrationTypes.includes(type as SupportedIntegrationType);
}

const contextSchema = z.object({
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
});

const oauthSchema = z.object({
  organizationId: z.string().optional(),
  enabled: z.boolean(),
  provider: z.literal('google'),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  authUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  userInfoUrl: z.string().optional(),
});

const aiSchema = z.object({
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  preferredProvider: z.enum(['openai', 'openrouter']),
  model: z.string().min(1),
  openaiApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
});

const integrationSecretSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['JIRA', 'TRELLO', 'GOOGLE_SHEETS']),
  secretJson: z.record(z.string(), z.unknown()),
});

const repositorySecretSchema = z.object({
  projectId: z.string().min(1),
  provider: z.enum(['GITLAB']),
  secretJson: z.record(z.string(), z.unknown()).optional(),
});

type EnvironmentSettingEntry = {
  key: string;
  displayType: 'secret' | 'text' | 'status' | 'number' | 'json';
  valuePreview: string;
  isSecret: boolean;
  isEditable: boolean;
  updatedAt: string | null;
  scope: 'system' | 'organization' | 'project' | 'integration' | 'repository';
  source: string;
};

function maskPreview(label: string) {
  return label ? `•••••••• ${label}` : '••••••••••••••••';
}

function stringifyPreview(value: unknown) {
  if (value === null || value === undefined) return 'Not set';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

async function loadEnvironmentSettings(query: z.infer<typeof contextSchema>) {
  const [systemSettings, projectSettings, integrations, repositoryConnection, oauthSecret, aiSecret] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        scope: query.organizationId ? 'ORGANIZATION' : 'SYSTEM',
        organizationId: query.organizationId ?? null,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    query.projectId
      ? prisma.systemSetting.findMany({
          where: { scope: 'PROJECT', projectId: query.projectId },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
    query.projectId
      ? prisma.integrationConnection.findMany({
          where: { projectId: query.projectId },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
    query.projectId
      ? prisma.repositoryConnection.findUnique({ where: { projectId: query.projectId } })
      : Promise.resolve(null),
    getSecret('SYSTEM', 'oauth.google'),
    getSecret(
      query.projectId ? 'PROJECT' : query.organizationId ? 'ORGANIZATION' : 'SYSTEM',
      query.projectId ? 'ai.project' : 'ai.org',
      query.organizationId,
      query.projectId,
    ),
  ]);

  const oauth = oauthSecret ? decryptPayload<OAuthProviderConfig>(oauthSecret) : null;
  const ai = aiSecret ? decryptPayload<AiProviderConfig>(aiSecret) : null;

  const entries: EnvironmentSettingEntry[] = [];

  if (ai) {
    entries.push({
      key: 'AI_PROVIDER',
      displayType: 'text',
      valuePreview: ai.preferredProvider,
      isSecret: false,
      isEditable: true,
      updatedAt: aiSecret?.updatedAt.toISOString() ?? null,
      scope: query.projectId ? 'project' : query.organizationId ? 'organization' : 'system',
      source: query.projectId ? 'Project runtime config' : query.organizationId ? 'Organization runtime config' : 'System runtime config',
    });
    entries.push({
      key: 'AI_MODEL',
      displayType: 'text',
      valuePreview: ai.model,
      isSecret: false,
      isEditable: true,
      updatedAt: aiSecret?.updatedAt.toISOString() ?? null,
      scope: query.projectId ? 'project' : query.organizationId ? 'organization' : 'system',
      source: 'AI runtime config',
    });
    if (ai.openaiApiKey) {
      entries.push({
        key: 'OPENAI_API_KEY',
        displayType: 'secret',
        valuePreview: maskPreview('stored'),
        isSecret: true,
        isEditable: true,
        updatedAt: aiSecret?.updatedAt.toISOString() ?? null,
        scope: query.projectId ? 'project' : query.organizationId ? 'organization' : 'system',
        source: 'Encrypted AI secret',
      });
    }
    if (ai.openrouterApiKey) {
      entries.push({
        key: 'OPENROUTER_API_KEY',
        displayType: 'secret',
        valuePreview: maskPreview('stored'),
        isSecret: true,
        isEditable: true,
        updatedAt: aiSecret?.updatedAt.toISOString() ?? null,
        scope: query.projectId ? 'project' : query.organizationId ? 'organization' : 'system',
        source: 'Encrypted AI secret',
      });
    }
  }

  if (oauth) {
    entries.push({
      key: 'GOOGLE_OAUTH_ENABLED',
      displayType: 'status',
      valuePreview: oauth.enabled ? 'Enabled' : 'Disabled',
      isSecret: false,
      isEditable: true,
      updatedAt: oauthSecret?.updatedAt.toISOString() ?? null,
      scope: 'system',
      source: 'OAuth runtime config',
    });
    entries.push({
      key: 'GOOGLE_OAUTH_CLIENT_ID',
      displayType: 'text',
      valuePreview: oauth.clientId || 'Not set',
      isSecret: false,
      isEditable: true,
      updatedAt: oauthSecret?.updatedAt.toISOString() ?? null,
      scope: 'system',
      source: 'OAuth runtime config',
    });
    if (oauth.clientSecret) {
      entries.push({
        key: 'GOOGLE_OAUTH_CLIENT_SECRET',
        displayType: 'secret',
        valuePreview: maskPreview('stored'),
        isSecret: true,
        isEditable: true,
        updatedAt: oauthSecret?.updatedAt.toISOString() ?? null,
        scope: 'system',
        source: 'Encrypted OAuth secret',
      });
    }
  }

  if (repositoryConnection) {
    entries.push(
      {
        key: 'REPOSITORY_PROVIDER',
        displayType: 'text',
        valuePreview: repositoryConnection.provider,
        isSecret: false,
        isEditable: false,
        updatedAt: repositoryConnection.updatedAt.toISOString(),
        scope: 'repository',
        source: 'Repository connection',
      },
      {
        key: 'REPOSITORY_FULL_NAME',
        displayType: 'text',
        valuePreview: repositoryConnection.fullName,
        isSecret: false,
        isEditable: false,
        updatedAt: repositoryConnection.updatedAt.toISOString(),
        scope: 'repository',
        source: 'Repository connection',
      },
      {
        key: 'DEFAULT_BRANCH',
        displayType: 'text',
        valuePreview: repositoryConnection.defaultBranch,
        isSecret: false,
        isEditable: false,
        updatedAt: repositoryConnection.updatedAt.toISOString(),
        scope: 'repository',
        source: 'Repository connection',
      },
      {
        key: 'WEBHOOK_STATUS',
        displayType: 'status',
        valuePreview: repositoryConnection.webhookStatus,
        isSecret: false,
        isEditable: false,
        updatedAt: repositoryConnection.updatedAt.toISOString(),
        scope: 'repository',
        source: 'Repository connection',
      },
    );
  }

  for (const setting of projectSettings) {
    if (setting.key === 'extension.connectedAt' || setting.key === 'onboarding_progress' || setting.key === 'onboarding_complete') {
      entries.push({
        key: setting.key.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        displayType: typeof setting.value === 'number' ? 'number' : typeof setting.value === 'string' ? 'text' : 'json',
        valuePreview: stringifyPreview(setting.value),
        isSecret: false,
        isEditable: false,
        updatedAt: setting.updatedAt.toISOString(),
        scope: 'project',
        source: 'Project setting',
      });
    }
  }

  for (const setting of systemSettings) {
    if (setting.key === 'ai.meta' || setting.key === 'oauth.google.meta') {
      entries.push({
        key: setting.key.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        displayType: 'json',
        valuePreview: stringifyPreview(setting.value),
        isSecret: false,
        isEditable: true,
        updatedAt: setting.updatedAt.toISOString(),
        scope: query.organizationId ? 'organization' : 'system',
        source: 'Persisted metadata',
      });
    }
  }

  for (const integration of integrations) {
    entries.push({
      key: `${integration.type}_STATUS`,
      displayType: 'status',
      valuePreview: integration.name,
      isSecret: false,
      isEditable: true,
      updatedAt: integration.updatedAt.toISOString(),
      scope: 'integration',
      source: 'Integration connection',
    });

    const config = integration.configJson as Record<string, unknown>;
    Object.entries(config)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 2)
      .forEach(([configKey, value]) => {
        entries.push({
          key: `${integration.type}_${configKey}`.toUpperCase(),
          displayType: typeof value === 'number' ? 'number' : 'text',
          valuePreview: stringifyPreview(value),
          isSecret: false,
          isEditable: true,
          updatedAt: integration.updatedAt.toISOString(),
          scope: 'integration',
          source: `${integration.type} config`,
        });
      });

    const secret = await getSecret('PROJECT', `integration.${integration.type.toLowerCase()}`, undefined, query.projectId);
    if (secret) {
      entries.push({
        key: `${integration.type}_CREDENTIALS`,
        displayType: 'secret',
        valuePreview: maskPreview('stored'),
        isSecret: true,
        isEditable: true,
        updatedAt: secret.updatedAt.toISOString(),
        scope: 'integration',
        source: `${integration.type} encrypted secret`,
      });
    }
  }

  return {
    entries: entries.sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    }),
  };
}

async function loadSettingsPayload(query: z.infer<typeof contextSchema>) {
  const [systemSettings, projectSettings, integrations, repositoryConnection, oauthSecret, aiSecret] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        scope: query.organizationId ? 'ORGANIZATION' : 'SYSTEM',
        organizationId: query.organizationId ?? null,
      },
    }),
    query.projectId
      ? prisma.systemSetting.findMany({ where: { scope: 'PROJECT', projectId: query.projectId } })
      : Promise.resolve([]),
    query.projectId
      ? prisma.integrationConnection.findMany({ where: { projectId: query.projectId } })
      : Promise.resolve([]),
    query.projectId
      ? prisma.repositoryConnection.findUnique({ where: { projectId: query.projectId } })
      : Promise.resolve(null),
    getSecret('SYSTEM', 'oauth.google'),
    getSecret(
      query.projectId ? 'PROJECT' : query.organizationId ? 'ORGANIZATION' : 'SYSTEM',
      query.projectId ? 'ai.project' : 'ai.org',
      query.organizationId,
      query.projectId,
    ),
  ]);

  const oauth = oauthSecret ? decryptPayload<OAuthProviderConfig>(oauthSecret) : null;
  const ai = aiSecret ? decryptPayload<AiProviderConfig>(aiSecret) : null;

  const integrationSecrets = query.projectId
    ? await Promise.all(
        integrations.map(async (integration: IntegrationConnection) => {
          const secret = await getSecret('PROJECT', `integration.${integration.type.toLowerCase()}`, undefined, query.projectId);
          const decrypted = secret ? decryptPayload<Record<string, unknown>>(secret) : null;
          const view = isSupportedIntegrationType(integration.type)
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
            id: integration.id,
            type: integration.type,
            name: integration.name,
            configJson: integration.configJson,
            hasStoredSecret: view.hasStoredSecret,
            secretPreview: view.secretPreview,
            health: view.health,
          };
        }),
      )
    : [];

  return {
    infrastructure: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SETTINGS_ENCRYPTION_KEY', 'INTERNAL_API_KEY'],
    oauth: toOAuthSettingsView(oauth),
    ai: toAiSettingsView(ai),
    systemSettings: Object.fromEntries(systemSettings.map((item: SystemSetting) => [item.key, item.value])),
    projectSettings: Object.fromEntries(projectSettings.map((item: SystemSetting) => [item.key, item.value])),
    repositoryConnection: repositoryConnection
      ? {
          id: repositoryConnection.id,
          provider: repositoryConnection.provider,
          externalId: repositoryConnection.externalId,
          owner: repositoryConnection.owner,
          namespace: repositoryConnection.namespace,
          repositoryName: repositoryConnection.repositoryName,
          fullName: repositoryConnection.fullName,
          repositoryUrl: repositoryConnection.repositoryUrl,
          defaultBranch: repositoryConnection.defaultBranch,
          installationId: repositoryConnection.installationId,
          providerUser: repositoryConnection.providerUser,
          webhookId: repositoryConnection.webhookId,
          webhookStatus: repositoryConnection.webhookStatus,
          webhookUrl: repositoryConnection.webhookUrl,
          webhookLastError: repositoryConnection.webhookLastError,
          lastSyncedAt: repositoryConnection.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
    integrations: integrationSecrets,
  };
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/settings', {
    schema: {
      tags: ['settings'],
      summary: 'Read settings payload',
      description: 'Returns the consolidated settings payload used by the web settings pages.',
    },
  }, async (request) => {
    const startedAt = Date.now();
    const query = contextSchema.parse(request.query);
    const payload = await loadSettingsPayload(query);

    const durationMs = Date.now() - startedAt;
    logEvent(request.log, 'settings.loaded', {
      requestId: request.id,
      organizationId: query.organizationId,
      projectId: query.projectId,
      status: 'success',
      durationMs,
      slow: durationMs > 500,
    });
    logDebug(request.log, 'settings.loaded.debug', {
      requestId: request.id,
      organizationId: query.organizationId,
      projectId: query.projectId,
      systemSettingCount: Object.keys(payload.systemSettings).length,
      projectSettingCount: Object.keys(payload.projectSettings).length,
      integrationCount: payload.integrations.length,
      hasRepositoryConnection: Boolean(payload.repositoryConnection),
      hasOAuthSecret: payload.oauth.hasStoredSecret,
      hasAiSecret: payload.ai.hasOpenAiKey || payload.ai.hasOpenRouterKey,
      durationMs,
      slow: durationMs > 500,
    });

    return payload;
  });

  app.get('/settings/export', {
    schema: {
      tags: ['settings'],
      summary: 'Export settings payload',
      description: 'Returns the sanitized settings export payload for the requested organization/project scope.',
    },
  }, async (request) => {
    const query = contextSchema.parse(request.query);
    return loadSettingsPayload(query);
  });

  app.get('/settings/environment', {
    schema: {
      tags: ['settings'],
      summary: 'Read environment settings surface',
      description: 'Returns the curated settings-backed environment and operational entries shown in project settings.',
    },
  }, async (request) => {
    const query = contextSchema.parse(request.query);
    return loadEnvironmentSettings(query);
  });

  app.post('/settings/oauth', {
    schema: {
      tags: ['settings'],
      summary: 'Save OAuth settings',
      description: 'Stores Google OAuth provider settings used by the runtime settings page.',
    },
  }, async (request, reply) => {
    try {
      const payload = oauthSchema.parse(request.body);
      const existingSecret = await getSecret('SYSTEM', 'oauth.google');
      const existingConfig = existingSecret ? decryptPayload<OAuthProviderConfig>(existingSecret) : null;

      const config: OAuthProviderConfig = {
        enabled: payload.enabled,
        provider: payload.provider,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret || existingConfig?.clientSecret,
        authUrl: payload.authUrl,
        tokenUrl: payload.tokenUrl,
        userInfoUrl: payload.userInfoUrl,
      };

      await upsertSecret('SYSTEM', 'oauth.google', config as unknown as Record<string, unknown>);
      await upsertSetting('SYSTEM', 'oauth.google.meta', { enabled: payload.enabled, provider: payload.provider });

      logEvent(request.log, 'oauth.settings.saved', {
        requestId: request.id,
        status: 'success',
      });
      logDebug(request.log, 'oauth.settings.saved.debug', {
        requestId: request.id,
        scope: 'SYSTEM',
        enabled: payload.enabled,
        provider: payload.provider,
        hasClientSecret: Boolean(config.clientSecret),
        changedKeys: ['enabled', 'provider', 'clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'userInfoUrl'],
        status: 'success',
      });

      reply.code(201);
      return { ok: true };
    } catch (error) {
      logError(request.log, 'oauth.settings.save.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/settings/ai', {
    schema: {
      tags: ['settings'],
      summary: 'Save AI runtime settings',
      description: 'Stores AI provider/model settings for organization or project runtime configuration.',
    },
  }, async (request, reply) => {
    try {
      const payload = aiSchema.parse(request.body);

      const scope = payload.projectId ? 'PROJECT' : payload.organizationId ? 'ORGANIZATION' : 'SYSTEM';
      const secretKey = payload.projectId ? 'ai.project' : 'ai.org';
      const existingSecret = await getSecret(scope, secretKey, payload.organizationId, payload.projectId);
      const existingConfig = existingSecret ? decryptPayload<AiProviderConfig>(existingSecret) : null;

      const config: AiProviderConfig = {
        preferredProvider: payload.preferredProvider,
        model: payload.model,
        openaiApiKey: payload.openaiApiKey || existingConfig?.openaiApiKey,
        openrouterApiKey: payload.openrouterApiKey || existingConfig?.openrouterApiKey,
      };

      await upsertSecret(scope, secretKey, config as unknown as Record<string, unknown>, payload.organizationId, payload.projectId);
      await upsertSetting(scope, 'ai.meta', { preferredProvider: payload.preferredProvider, model: payload.model }, payload.organizationId, payload.projectId);

      logEvent(request.log, 'ai.settings.saved', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: 'success',
      });
      logDebug(request.log, 'ai.settings.saved.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        preferredProvider: payload.preferredProvider,
        model: payload.model,
        changedKeys: ['preferredProvider', 'model', payload.preferredProvider === 'openai' ? 'openaiApiKey' : 'openrouterApiKey'],
        status: 'success',
      });

      reply.code(201);
      return { ok: true };
    } catch (error) {
      logError(request.log, 'ai.settings.save.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/settings/integrations/secret', {
    schema: {
      tags: ['settings', 'integrations'],
      summary: 'Save integration secret',
      description: 'Stores encrypted integration credentials for a project integration.',
    },
  }, async (request, reply) => {
    try {
      const payload = integrationSecretSchema.parse(request.body);
      const key = `integration.${payload.type.toLowerCase()}`;
      await upsertSecret('PROJECT', key, payload.secretJson, undefined, payload.projectId);

      logEvent(request.log, 'integration.secret.saved', {
        requestId: request.id,
        projectId: payload.projectId,
        integrationType: payload.type,
        status: 'success',
      });
      logDebug(request.log, 'integration.secret.saved.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        integrationType: payload.type,
        secretKeys: Object.keys(payload.secretJson).sort(),
        status: 'success',
      });

      reply.code(201);
      return { ok: true };
    } catch (error) {
      logError(request.log, 'integration.secret.save.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/settings/repositories/secret', {
    schema: {
      tags: ['settings', 'repositories'],
      summary: 'Save repository secret',
      description: 'Stores encrypted repository provider credentials used by repository-connected flows.',
    },
  }, async (request, reply) => {
    try {
      const payload = repositorySecretSchema.parse(request.body);
      const key = `repository.${payload.provider.toLowerCase()}`;
      const existingSecret = await getSecret('PROJECT', key, undefined, payload.projectId);
      const existingConfig = existingSecret ? decryptPayload<Record<string, unknown>>(existingSecret) : {};
      const mergedSecret = {
        ...existingConfig,
        ...(payload.secretJson ?? {}),
      };

      await upsertSecret('PROJECT', key, mergedSecret, undefined, payload.projectId);

      logEvent(request.log, 'repository.secret.saved', {
        requestId: request.id,
        projectId: payload.projectId,
        provider: payload.provider,
        status: 'success',
      });
      logDebug(request.log, 'repository.secret.saved.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        provider: payload.provider,
        secretKeys: Object.keys(mergedSecret).sort(),
        status: 'success',
      });

      reply.code(201);
      return { ok: true };
    } catch (error) {
      logError(request.log, 'repository.secret.save.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });
}
