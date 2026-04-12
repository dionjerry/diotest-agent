import { Prisma, type IntegrationConnection, type SystemSetting } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AiProviderConfig, OAuthProviderConfig } from '@diotest/domain/platform/types';

import { prisma } from '../db.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';
import { decryptPayload, encryptPayload, toAiSettingsView, toIntegrationSecretPreview, toOAuthSettingsView } from '../lib/secrets.js';

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

async function getSecret(scope: 'SYSTEM' | 'ORGANIZATION' | 'PROJECT', key: string, organizationId?: string, projectId?: string) {
  return prisma.encryptedSecret.findFirst({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });
}

async function upsertSecret(scope: 'SYSTEM' | 'ORGANIZATION' | 'PROJECT', key: string, payload: Record<string, unknown>, organizationId?: string, projectId?: string) {
  const encrypted = encryptPayload(payload);

  await prisma.encryptedSecret.deleteMany({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });

  return prisma.encryptedSecret.create({
    data: {
      scope,
      key,
      organizationId,
      projectId,
      cipherText: encrypted.cipherText,
      iv: encrypted.iv,
      tag: encrypted.tag,
      algorithm: encrypted.algorithm,
    },
  });
}

async function upsertSetting(scope: 'SYSTEM' | 'ORGANIZATION' | 'PROJECT', key: string, value: Record<string, unknown>, organizationId?: string, projectId?: string) {
  await prisma.systemSetting.deleteMany({
    where: {
      scope,
      key,
      organizationId: organizationId ?? null,
      projectId: projectId ?? null,
    },
  });

  return prisma.systemSetting.create({
    data: {
      scope,
      key,
      organizationId,
      projectId,
      value: value as Prisma.InputJsonValue,
    },
  });
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/settings', async (request) => {
    const startedAt = Date.now();
    const query = contextSchema.parse(request.query);

    const [systemSettings, projectSettings, integrations, oauthSecret, aiSecret] = await Promise.all([
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
      getSecret('SYSTEM', 'oauth.google'),
      getSecret(query.projectId ? 'PROJECT' : query.organizationId ? 'ORGANIZATION' : 'SYSTEM', query.projectId ? 'ai.project' : 'ai.org', query.organizationId, query.projectId),
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
      systemSettingCount: systemSettings.length,
      projectSettingCount: projectSettings.length,
      integrationCount: integrationSecrets.length,
      hasOAuthSecret: Boolean(oauthSecret),
      hasAiSecret: Boolean(aiSecret),
      durationMs,
      slow: durationMs > 500,
    });

    return {
      infrastructure: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SETTINGS_ENCRYPTION_KEY', 'INTERNAL_API_KEY'],
      oauth: toOAuthSettingsView(oauth),
      ai: toAiSettingsView(ai),
      systemSettings: Object.fromEntries(systemSettings.map((item: SystemSetting) => [item.key, item.value])),
      projectSettings: Object.fromEntries(projectSettings.map((item: SystemSetting) => [item.key, item.value])),
      integrations: integrationSecrets,
    };
  });

  app.post('/settings/oauth', async (request, reply) => {
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

  app.post('/settings/ai', async (request, reply) => {
    try {
      const payload = aiSchema.parse(request.body);

      const config: AiProviderConfig = {
        preferredProvider: payload.preferredProvider,
        model: payload.model,
        openaiApiKey: payload.openaiApiKey,
        openrouterApiKey: payload.openrouterApiKey,
      };

      const scope = payload.projectId ? 'PROJECT' : payload.organizationId ? 'ORGANIZATION' : 'SYSTEM';
      const secretKey = payload.projectId ? 'ai.project' : 'ai.org';

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

  app.post('/settings/integrations/secret', async (request, reply) => {
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
}
