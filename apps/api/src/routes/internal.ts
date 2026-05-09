import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../db.js';
import { isPrismaUniqueConstraintError } from '../lib/errors.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';

const onboardingProgressSchema = z.object({
  lastVisitedStage: z.enum(['organization', 'project', 'integrations', 'repository', 'extension', 'finalize']).optional(),
  integrationsSkipped: z.boolean().optional(),
  repositorySkipped: z.boolean().optional(),
  extensionSkipped: z.boolean().optional(),
});

const organizationSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

const updateUserSchema = z.object({
  name: z.string().min(1),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

const projectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
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

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string().min(1),
});

const organizationMutationSchema = z.object({
  userId: z.string().min(1),
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
            _count: {
              select: {
                members: true,
                projects: true,
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
        onboardingComplete: false,
        onboardingProgress: null,
      };
    }
    const project = membership.organization.projects[0] ?? null;
    const projectSettings = project
      ? await prisma.systemSetting.findMany({
          where: {
            scope: 'PROJECT',
            projectId: project.id,
            key: { in: ['onboarding_complete', 'onboarding_progress'] },
          },
        })
      : [];
    const onboardingComplete = projectSettings.some((setting) => setting.key === 'onboarding_complete');
    const onboardingProgressSetting = projectSettings.find((setting) => setting.key === 'onboarding_progress');
    const onboardingProgress = onboardingProgressSetting
      ? onboardingProgressSchema.safeParse(onboardingProgressSetting.value).data ?? null
      : null;
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
        currentUserRole: membership.role,
        memberCount: membership.organization._count.members,
        projectCount: membership.organization._count.projects,
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
      onboardingComplete,
      onboardingProgress,
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
      if (isPrismaUniqueConstraintError(error, 'slug')) {
        const message = 'Organization slug is already taken. Choose another one.';
        logError(
          request.log,
          'organization.create.failed',
          'validation_error',
          { requestId: request.id, status: 'failed', statusCode: 409 },
          error,
        );
        reply.code(409);
        throw new Error(message);
      }

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
      if (isPrismaUniqueConstraintError(error, 'slug')) {
        const message = 'Project slug is already taken. Choose another one.';
        logError(
          request.log,
          'project.create.failed',
          'validation_error',
          { requestId: request.id, status: 'failed', statusCode: 409 },
          error,
        );
        reply.code(409);
        throw new Error(message);
      }

      logError(request.log, 'project.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.patch('/users/:id', {
    schema: {
      tags: ['settings', 'users'],
      summary: 'Update user profile',
      description: 'Updates the signed-in user profile details used in settings.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = updateUserSchema.parse(request.body);

      const user = await prisma.user.update({
        where: { id: params.id },
        data: { name: payload.name },
      });

      logEvent(request.log, 'user.updated', {
        requestId: request.id,
        userId: user.id,
        status: 'success',
      });
      logDebug(request.log, 'user.updated.debug', {
        requestId: request.id,
        userId: user.id,
        changedKeys: ['name'],
        status: 'success',
      });

      return { ok: true };
    } catch (error) {
      logError(request.log, 'user.update.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.patch('/organizations/:id', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Update organization profile',
      description: 'Updates the organization name and slug from the settings surface.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = updateOrganizationSchema.parse(request.body);

      const organization = await prisma.organization.update({
        where: { id: params.id },
        data: {
          name: payload.name,
          slug: payload.slug,
        },
      });

      logEvent(request.log, 'organization.updated', {
        requestId: request.id,
        organizationId: organization.id,
        status: 'success',
      });
      logDebug(request.log, 'organization.updated.debug', {
        requestId: request.id,
        organizationId: organization.id,
        changedKeys: ['name', 'slug'],
        status: 'success',
      });

      return { ok: true };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'slug')) {
        const message = 'Organization slug is already taken. Choose another one.';
        logError(
          request.log,
          'organization.update.failed',
          'validation_error',
          { requestId: request.id, status: 'failed', statusCode: 409 },
          error,
        );
        reply.code(409);
        throw new Error(message);
      }

      logError(request.log, 'organization.update.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.patch('/projects/:id', {
    schema: {
      tags: ['settings', 'projects'],
      summary: 'Update project profile',
      description: 'Updates the project name, slug, and description from project settings.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = updateProjectSchema.parse(request.body);

      const project = await prisma.project.update({
        where: { id: params.id },
        data: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description ?? null,
        },
      });

      logEvent(request.log, 'project.updated', {
        requestId: request.id,
        projectId: project.id,
        status: 'success',
      });
      logDebug(request.log, 'project.updated.debug', {
        requestId: request.id,
        projectId: project.id,
        changedKeys: ['name', 'slug', 'description'],
        status: 'success',
      });

      return { ok: true };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'slug')) {
        const message = 'Project slug is already taken. Choose another one.';
        logError(
          request.log,
          'project.update.failed',
          'validation_error',
          { requestId: request.id, status: 'failed', statusCode: 409 },
          error,
        );
        reply.code(409);
        throw new Error(message);
      }

      logError(request.log, 'project.update.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.delete('/projects/:id', {
    schema: {
      tags: ['settings', 'projects'],
      summary: 'Delete project',
      description: 'Deletes a project and its associated settings-related data.',
    },
  }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    await prisma.project.delete({
      where: { id: params.id },
    });

    logEvent(request.log, 'project.deleted', {
      requestId: request.id,
      projectId: params.id,
      status: 'success',
    });
    logDebug(request.log, 'project.deleted.debug', {
      requestId: request.id,
      projectId: params.id,
      status: 'success',
    });

    return { ok: true };
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

  app.post('/integrations', {
    schema: {
      tags: ['settings', 'integrations'],
      summary: 'Save integration configuration',
      description: 'Creates or replaces the structured integration config for a project integration.',
    },
  }, async (request, reply) => {
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

  app.get('/organizations/:id/members', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'List organization members',
      description: 'Returns organization members for the organization settings page.',
    },
  }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        user: m.user,
      })),
    };
  });

  app.get('/organizations/:id/invites', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'List organization invites',
      description: 'Returns active pending invites for the organization settings page.',
    },
  }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const invites = await prisma.organizationInvite.findMany({
      where: {
        organizationId: params.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });

  app.delete('/organizations/:id/invites/:inviteId', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Revoke organization invite',
      description: 'Revokes a pending organization invite.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1), inviteId: z.string().min(1) }).parse(request.params);
      const payload = organizationMutationSchema.parse(request.body);

      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId: params.id, userId: payload.userId, role: { in: ['owner', 'admin'] } },
      });

      if (!membership) {
        throw new Error('Only organization owners and admins can revoke invites');
      }

      const invite = await prisma.organizationInvite.findFirst({
        where: { id: params.inviteId, organizationId: params.id },
      });

      if (!invite) {
        throw new Error('Invite not found for this organization');
      }

      await prisma.organizationInvite.delete({
        where: { id: invite.id },
      });

      logEvent(request.log, 'member.invite.revoked', {
        requestId: request.id,
        organizationId: params.id,
        inviteId: params.inviteId,
        status: 'success',
      });

      reply.code(200);
      return { success: true };
    } catch (error) {
      logError(request.log, 'member.invite.revoke.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/organizations/:id/invites', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Invite organization member',
      description: 'Creates a new organization invite for member/admin/owner based on role permissions.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = inviteMemberSchema.merge(organizationMutationSchema).parse(request.body);

      // Check if user is owner
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId: params.id, userId: payload.userId, role: { in: ['owner', 'admin'] } },
      });

      if (!membership) {
        throw new Error('Only organization owners and admins can invite members');
      }

      if (payload.role === 'owner' && membership.role !== 'owner') {
        throw new Error('Only organization owners can invite another owner');
      }

      const rawToken = crypto.randomBytes(24).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await prisma.organizationInvite.create({
        data: {
          organizationId: params.id,
          email: payload.email,
          role: payload.role,
          token: hashedToken,
          invitedById: payload.userId,
          expiresAt,
        },
      });

      logEvent(request.log, 'member.invite.created', {
        requestId: request.id,
        organizationId: params.id,
        inviteId: invite.id,
        email: payload.email,
        role: payload.role,
        status: 'success',
      });

      reply.code(201);
      return { inviteId: invite.id, rawToken };
    } catch (error) {
      logError(request.log, 'member.invite.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.delete('/organizations/:id/members/:memberId', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Remove organization member',
      description: 'Removes a member from the organization, with last-owner protection.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1), memberId: z.string().min(1) }).parse(request.params);
      const payload = organizationMutationSchema.parse(request.body);

      // Check if user is owner
      const ownership = await prisma.organizationMember.findFirst({
        where: { organizationId: params.id, userId: payload.userId, role: 'owner' },
      });

      if (!ownership) {
        throw new Error('Only organization owners can remove members');
      }

      // Check if this is the last owner
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: params.id, role: 'owner' },
      });

      const memberToDelete = await prisma.organizationMember.findFirst({
        where: { id: params.memberId, organizationId: params.id },
      });

      if (!memberToDelete) {
        throw new Error('Member not found for this organization');
      }

      if (memberToDelete.role === 'owner' && ownerCount === 1) {
        throw new Error('Cannot remove the last owner of the organization');
      }

      await prisma.organizationMember.delete({
        where: { id: params.memberId },
      });

      logEvent(request.log, 'member.removed', {
        requestId: request.id,
        organizationId: params.id,
        memberId: params.memberId,
        status: 'success',
      });

      reply.code(200);
      return { success: true };
    } catch (error) {
      logError(request.log, 'member.remove.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.patch('/organizations/:id/members/:memberId', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Update organization member role',
      description: 'Updates an organization member role from the settings page.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1), memberId: z.string().min(1) }).parse(request.params);
      const payload = updateMemberRoleSchema.merge(organizationMutationSchema).parse(request.body);

      // Check if user is owner
      const ownership = await prisma.organizationMember.findFirst({
        where: { organizationId: params.id, userId: payload.userId, role: 'owner' },
      });

      if (!ownership) {
        throw new Error('Only organization owners can change member roles');
      }

      const memberToUpdate = await prisma.organizationMember.findFirst({
        where: { id: params.memberId, organizationId: params.id },
      });

      if (!memberToUpdate) {
        throw new Error('Member not found for this organization');
      }

      const updated = await prisma.organizationMember.update({
        where: { id: memberToUpdate.id },
        data: { role: payload.role },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logEvent(request.log, 'member.role.updated', {
        requestId: request.id,
        organizationId: params.id,
        memberId: params.memberId,
        newRole: payload.role,
        status: 'success',
      });

      return {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        createdAt: updated.createdAt.toISOString(),
        user: updated.user,
      };
    } catch (error) {
      logError(request.log, 'member.role.update.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/organizations/:id/transfer', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Transfer organization ownership',
      description: 'Transfers ownership to another organization member.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = transferOwnershipSchema.merge(organizationMutationSchema).parse(request.body);

      // Get current user's membership
      const currentMember = await prisma.organizationMember.findFirstOrThrow({
        where: { organizationId: params.id, userId: payload.userId },
      });

      if (currentMember.role !== 'owner') {
        throw new Error('Only organization owners can transfer ownership');
      }

      // Update new owner
      await prisma.organizationMember.update({
        where: {
          id: (
            await prisma.organizationMember.findUniqueOrThrow({
              where: { organizationId_userId: { organizationId: params.id, userId: payload.newOwnerUserId } },
            })
          ).id,
        },
        data: { role: 'owner' },
      });

      // Update current user to member
      await prisma.organizationMember.update({
        where: { id: currentMember.id },
        data: { role: 'member' },
      });

      logEvent(request.log, 'organization.ownership.transferred', {
        requestId: request.id,
        organizationId: params.id,
        fromUserId: payload.userId,
        toUserId: payload.newOwnerUserId,
        status: 'success',
      });

      reply.code(200);
      return { success: true };
    } catch (error) {
      logError(request.log, 'organization.ownership.transfer.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.delete('/organizations/:id', {
    schema: {
      tags: ['settings', 'organizations'],
      summary: 'Delete organization',
      description: 'Deletes the organization when ownership and membership constraints are satisfied.',
    },
  }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = organizationMutationSchema.parse(request.body);

      // Check if user is owner
      const member = await prisma.organizationMember.findFirstOrThrow({
        where: { organizationId: params.id, userId: payload.userId },
      });

      if (member.role !== 'owner') {
        throw new Error('Only organization owners can delete the organization');
      }

      // Check if there are other members
      const memberCount = await prisma.organizationMember.count({
        where: { organizationId: params.id },
      });

      if (memberCount > 1) {
        throw new Error('Organization must have no other members before deletion');
      }

      await prisma.organization.delete({
        where: { id: params.id },
      });

      logEvent(request.log, 'organization.deleted', {
        requestId: request.id,
        organizationId: params.id,
        status: 'success',
      });

      reply.code(200);
      return { success: true };
    } catch (error) {
      logError(request.log, 'organization.delete.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });
}
