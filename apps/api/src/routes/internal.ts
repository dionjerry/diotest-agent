import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../db.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';

const organizationSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

const projectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

const repositoryConnectionSchema = z.object({
  projectId: z.string().min(1),
  provider: z.enum(['GITHUB', 'GITLAB']),
  externalId: z.string().min(1),
  owner: z.string().min(1),
  namespace: z.string().optional(),
  repositoryName: z.string().min(1),
  fullName: z.string().min(1),
  repositoryUrl: z.string().min(1),
  defaultBranch: z.string().min(1),
  installationId: z.string().optional(),
  providerUser: z.string().optional(),
  webhookId: z.string().optional(),
  webhookStatus: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookLastError: z.string().optional(),
  lastSyncedAt: z.string().datetime().optional(),
});

const integrationSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['JIRA', 'TRELLO', 'GOOGLE_SHEETS']),
  name: z.string().min(1),
  configJson: z.record(z.string(), z.unknown()),
});

const settingSchema = z.object({
  scope: z.enum(['SYSTEM', 'ORGANIZATION', 'PROJECT']),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

export async function registerInternalRoutes(app: FastifyInstance) {
  app.get('/bootstrap', async (request) => {
    const startedAt = Date.now();
    const query = z.object({ userId: z.string().min(1) }).parse(request.query);

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: query.userId },
      include: {
        organization: {
          include: {
            projects: {
              orderBy: { createdAt: 'asc' },
              include: {
                repositoryConnection: true,
                integrations: true,
                encryptedSecrets: {
                  select: {
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      logEvent(request.log, 'bootstrap.loaded', {
        requestId: request.id,
        userId: query.userId,
        status: 'success',
        durationMs: Date.now() - startedAt,
      });
      return {
        organization: null,
        project: null,
        repositoryConnection: null,
        integrations: [],
      };
    }
    const project = membership.organization.projects[0] ?? null;
    const durationMs = Date.now() - startedAt;
    logEvent(request.log, 'bootstrap.loaded', {
      requestId: request.id,
      userId: query.userId,
      organizationId: membership.organization.id,
      projectId: project?.id,
      status: 'success',
      durationMs,
      slow: durationMs > 500,
    });
    logDebug(request.log, 'bootstrap.loaded.debug', {
      requestId: request.id,
      userId: query.userId,
      organizationId: membership.organization.id,
      projectId: project?.id,
      projectCount: membership.organization.projects.length,
      integrationCount: project?.integrations.length ?? 0,
      hasRepositoryConnection: Boolean(project?.repositoryConnection),
      durationMs,
      slow: durationMs > 500,
    });

    return {
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      project: project
        ? {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
          }
        : null,
      repositoryConnection: project?.repositoryConnection
        ? {
            id: project.repositoryConnection.id,
            provider: project.repositoryConnection.provider,
            externalId: project.repositoryConnection.externalId,
            owner: project.repositoryConnection.owner,
            namespace: project.repositoryConnection.namespace,
            repositoryName: project.repositoryConnection.repositoryName,
            fullName: project.repositoryConnection.fullName,
            repositoryUrl: project.repositoryConnection.repositoryUrl,
            defaultBranch: project.repositoryConnection.defaultBranch,
            installationId: project.repositoryConnection.installationId,
            providerUser: project.repositoryConnection.providerUser,
            webhookId: project.repositoryConnection.webhookId,
            webhookStatus: project.repositoryConnection.webhookStatus,
            webhookUrl: project.repositoryConnection.webhookUrl,
            webhookLastError: project.repositoryConnection.webhookLastError,
            lastSyncedAt: project.repositoryConnection.lastSyncedAt?.toISOString() ?? null,
          }
        : null,
      integrations: project?.integrations.map((integration) => ({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        configJson: integration.configJson,
        hasStoredSecret: project.encryptedSecrets.some(
          (secret) => secret.key === `integration.${integration.type.toLowerCase()}`,
        ),
      })) ?? [],
    };
  });

  app.post('/organizations', async (request, reply) => {
    try {
      const payload = organizationSchema.parse(request.body);

      const organization = await prisma.organization.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          members: {
            create: {
              userId: payload.userId,
              role: 'owner',
            },
          },
        },
      });

      logEvent(request.log, 'organization.created', {
        requestId: request.id,
        userId: payload.userId,
        organizationId: organization.id,
        status: 'success',
      });
      logDebug(request.log, 'organization.created.debug', {
        requestId: request.id,
        userId: payload.userId,
        organizationId: organization.id,
        slug: payload.slug,
        nameLength: payload.name.length,
        status: 'success',
      });

      reply.code(201);
      return { organizationId: organization.id };
    } catch (error) {
      logError(request.log, 'organization.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/projects', async (request, reply) => {
    try {
      const payload = projectSchema.parse(request.body);

      const project = await prisma.project.create({
        data: {
          organizationId: payload.organizationId,
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        },
      });

      logEvent(request.log, 'project.created', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: project.id,
        status: 'success',
      });
      logDebug(request.log, 'project.created.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: project.id,
        slug: payload.slug,
        hasDescription: Boolean(payload.description),
        status: 'success',
      });

      reply.code(201);
      return { projectId: project.id };
    } catch (error) {
      logError(request.log, 'project.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/repository-connections', async (request, reply) => {
    try {
      const payload = repositoryConnectionSchema.parse(request.body);

      const repositoryConnection = await prisma.repositoryConnection.upsert({
        where: { projectId: payload.projectId },
        create: {
          projectId: payload.projectId,
          provider: payload.provider,
          externalId: payload.externalId,
          owner: payload.owner,
          namespace: payload.namespace,
          repositoryName: payload.repositoryName,
          fullName: payload.fullName,
          repositoryUrl: payload.repositoryUrl,
          defaultBranch: payload.defaultBranch,
          installationId: payload.installationId,
          providerUser: payload.providerUser,
          webhookId: payload.webhookId,
          webhookStatus: payload.webhookStatus ?? 'pending',
          webhookUrl: payload.webhookUrl,
          webhookLastError: payload.webhookLastError,
          lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : undefined,
        },
        update: {
          provider: payload.provider,
          externalId: payload.externalId,
          owner: payload.owner,
          namespace: payload.namespace,
          repositoryName: payload.repositoryName,
          fullName: payload.fullName,
          repositoryUrl: payload.repositoryUrl,
          defaultBranch: payload.defaultBranch,
          installationId: payload.installationId,
          providerUser: payload.providerUser,
          webhookId: payload.webhookId,
          webhookStatus: payload.webhookStatus ?? 'pending',
          webhookUrl: payload.webhookUrl,
          webhookLastError: payload.webhookLastError,
          lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : undefined,
        },
      });

      logEvent(request.log, 'repository.connected', {
        requestId: request.id,
        projectId: payload.projectId,
        status: 'success',
        repositoryConnectionId: repositoryConnection.id,
        provider: payload.provider,
      });
      logDebug(request.log, 'repository.connected.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        repositoryConnectionId: repositoryConnection.id,
        provider: payload.provider,
        externalId: payload.externalId,
        owner: payload.owner,
        namespace: payload.namespace,
        repositoryName: payload.repositoryName,
        fullName: payload.fullName,
        defaultBranch: payload.defaultBranch,
        hasInstallationId: Boolean(payload.installationId),
        webhookStatus: payload.webhookStatus ?? 'pending',
        status: 'success',
      });

      reply.code(201);
      return { repositoryConnectionId: repositoryConnection.id };
    } catch (error) {
      logError(request.log, 'repository.connect.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/integrations', async (request, reply) => {
    try {
      const payload = integrationSchema.parse(request.body);

      await prisma.integrationConnection.deleteMany({
        where: {
          projectId: payload.projectId,
          type: payload.type,
        },
      });

      const integration = await prisma.integrationConnection.create({
        data: {
          projectId: payload.projectId,
          type: payload.type,
          name: payload.name,
          configJson: payload.configJson as Prisma.InputJsonValue,
        },
      });

      logEvent(request.log, 'integration.config.saved', {
        requestId: request.id,
        projectId: payload.projectId,
        integrationType: payload.type,
        integrationId: integration.id,
        status: 'success',
      });
      logDebug(request.log, 'integration.config.saved.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        integrationType: payload.type,
        integrationId: integration.id,
        configKeys: Object.keys(payload.configJson).sort(),
        status: 'success',
      });

      reply.code(201);
      return { integrationId: integration.id };
    } catch (error) {
      logError(request.log, 'integration.config.save.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/system-settings', async (request, reply) => {
    const payload = settingSchema.parse(request.body);

    await prisma.systemSetting.deleteMany({
      where: {
        scope: payload.scope,
        organizationId: payload.organizationId ?? null,
        projectId: payload.projectId ?? null,
        key: payload.key,
      },
    });

    const setting = await prisma.systemSetting.create({
      data: {
        scope: payload.scope,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        key: payload.key,
        value: payload.value as Prisma.InputJsonValue,
      },
    });

    reply.code(201);
    return { settingId: setting.id };
  });
}
