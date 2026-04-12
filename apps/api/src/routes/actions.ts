import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AgentAction, AgentActionStatus, Task, TaskOutput } from '@diotest/domain/platform/types';

import { prisma } from '../db.js';
import {
  createJiraIssue,
  createTrelloCard,
  exportTicketsTable,
  getJiraIssueStatus,
  getTrelloCardStatus,
} from '../lib/integrations.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';

const createActionSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets']),
  target: z.enum(['pr', 'recorder_session', 'test_case', 'run', 'project']),
  targetId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  readOnly: z.boolean(),
  approvalRequired: z.boolean(),
  input: z.record(z.string(), z.unknown()).default({}),
});

const approveSchema = z.object({
  actionId: z.string().min(1),
});

function toAction(record: {
  id: string; projectId: string; type: string; target: string; targetId: string | null; title: string; description: string; readOnly: boolean; approvalRequired: boolean; status: string; input: Prisma.JsonValue; result: Prisma.JsonValue | null; createdAt: Date; updatedAt: Date; completedAt: Date | null;
}): AgentAction {
  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type as AgentAction['type'],
    target: record.target as AgentAction['target'],
    targetId: record.targetId,
    title: record.title,
    description: record.description,
    readOnly: record.readOnly,
    approvalRequired: record.approvalRequired,
    status: record.status as AgentActionStatus,
    input: (record.input as Record<string, unknown>) ?? {},
    result: (record.result as Record<string, unknown> | null) ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

function toTask(record: { id: string; projectId: string; actionId: string | null; type: string; status: string; title: string; input: Prisma.JsonValue; output: Prisma.JsonValue | null; error: string | null; createdAt: Date; updatedAt: Date; startedAt: Date | null; completedAt: Date | null; }): Task {
  return {
    id: record.id,
    projectId: record.projectId,
    actionId: record.actionId,
    type: record.type as Task['type'],
    status: record.status as Task['status'],
    title: record.title,
    input: (record.input as Record<string, unknown>) ?? {},
    output: (record.output as TaskOutput | null) ?? null,
    error: record.error,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

async function createTaskForAction(actionId: string, projectId: string, title: string, type: Task['type'], input: Record<string, unknown>, status: Task['status'], output?: TaskOutput | null) {
  return prisma.task.create({
    data: {
      actionId,
      projectId,
      type,
      status,
      title,
      input: input as Prisma.InputJsonValue,
      output: output ? (output as Prisma.InputJsonValue) : undefined,
      startedAt: status !== 'queued' ? new Date() : null,
      completedAt: status === 'passed' ? new Date() : null,
    },
  });
}

async function executeIntegrationAction(action: {
  id: string;
  projectId: string;
  type: string;
  title: string;
  input: Prisma.JsonValue;
}) {
  const input = (action.input as Record<string, unknown>) ?? {};
  const mode = String(input.mode ?? 'create');

  if (action.type === 'sync_jira') {
    return mode === 'status_check'
      ? getJiraIssueStatus(action.projectId, input)
      : createJiraIssue(action.projectId, {
          ...input,
          title: input.title ?? action.title,
        });
  }

  if (action.type === 'sync_trello') {
    return mode === 'status_check'
      ? getTrelloCardStatus(action.projectId, input)
      : createTrelloCard(action.projectId, {
          ...input,
          title: input.title ?? action.title,
        });
  }

  if (action.type === 'export_sheets') {
    let rows = input.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      const [actions, tasks] = await Promise.all([
        prisma.agentAction.findMany({ where: { projectId: action.projectId }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.task.findMany({ where: { projectId: action.projectId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      ]);

      rows = [
        ...actions.map((record) => ({
          title: record.title,
          type: record.type,
          target: record.target,
          status: record.status,
          summary: typeof (record.result as Record<string, unknown> | null)?.summary === 'string'
            ? String((record.result as Record<string, unknown>).summary)
            : '',
          completedAt: record.completedAt?.toISOString() ?? '',
        })),
        ...tasks.map((record) => ({
          title: record.title,
          type: record.type,
          target: record.actionId ?? 'task',
          status: record.status,
          summary: typeof (record.output as Record<string, unknown> | null)?.summary === 'string'
            ? String((record.output as Record<string, unknown>).summary)
            : '',
          completedAt: record.completedAt?.toISOString() ?? '',
        })),
      ];
    }

    return exportTicketsTable(action.projectId, { ...input, rows });
  }

  throw new Error(`Unsupported integration action type: ${action.type}`);
}

export async function registerActionRoutes(app: FastifyInstance) {
  app.get('/actions', async (request) => {
    const startedAt = Date.now();
    const query = z.object({ projectId: z.string().min(1) }).parse(request.query);

    const [actions, tasks] = await Promise.all([
      prisma.agentAction.findMany({ where: { projectId: query.projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.task.findMany({ where: { projectId: query.projectId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const durationMs = Date.now() - startedAt;
    logEvent(request.log, 'actions.loaded', {
      requestId: request.id,
      projectId: query.projectId,
      status: 'success',
      durationMs,
      slow: durationMs > 500,
    });
    logDebug(request.log, 'actions.loaded.debug', {
      requestId: request.id,
      projectId: query.projectId,
      actionCount: actions.length,
      taskCount: tasks.length,
      durationMs,
      slow: durationMs > 500,
    });

    return {
      actions: actions.map(toAction),
      tasks: tasks.map(toTask),
    };
  });

  app.post('/actions', async (request, reply) => {
    try {
      const payload = createActionSchema.parse(request.body);
      const initialStatus: AgentActionStatus = payload.readOnly && !payload.approvalRequired ? 'completed' : payload.approvalRequired ? 'awaiting_approval' : 'approved';
      const result = payload.readOnly
        ? {
            summary: payload.type === 'analyze_pr' ? 'PR analysis completed with a high-risk recommendation for checkout coverage.' : 'Read-only generation completed.',
          }
        : null;

      const action = await prisma.agentAction.create({
        data: {
          projectId: payload.projectId,
          type: payload.type,
          target: payload.target,
          targetId: payload.targetId,
          title: payload.title,
          description: payload.description,
          readOnly: payload.readOnly,
          approvalRequired: payload.approvalRequired,
          status: initialStatus,
          input: payload.input as Prisma.InputJsonValue,
          result: result ? (result as Prisma.InputJsonValue) : undefined,
          completedAt: initialStatus === 'completed' ? new Date() : null,
        },
      });

      logEvent(request.log, 'agent_action.created', {
        requestId: request.id,
        projectId: payload.projectId,
        actionId: action.id,
        status: initialStatus,
      });
      logDebug(request.log, 'agent_action.created.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        actionId: action.id,
        actionType: payload.type,
        target: payload.target,
        readOnly: payload.readOnly,
        approvalRequired: payload.approvalRequired,
        inputKeys: Object.keys(payload.input).sort(),
        status: initialStatus,
      });

      if (payload.readOnly && !payload.approvalRequired) {
        const task = await createTaskForAction(action.id, payload.projectId, payload.title, payload.type === 'analyze_pr' ? 'analysis' : 'generation', payload.input, 'passed', {
          summary: String(result?.summary ?? 'Completed'),
        });
        logEvent(request.log, 'task.completed', {
          requestId: request.id,
          projectId: payload.projectId,
          actionId: action.id,
          taskId: task.id,
          status: 'passed',
        });
        logDebug(request.log, 'task.completed.debug', {
          requestId: request.id,
          projectId: payload.projectId,
          actionId: action.id,
          taskId: task.id,
          taskType: task.type,
          status: 'passed',
        });
      }

      reply.code(201);
      return { action: toAction(action) };
    } catch (error) {
      logError(request.log, 'agent_action.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/actions/approve', async (request, reply) => {
    try {
      const payload = approveSchema.parse(request.body);
      const action = await prisma.agentAction.findUnique({ where: { id: payload.actionId } });
      if (!action) {
        reply.code(404);
        return { message: 'Action not found' };
      }

      if (action.status !== 'awaiting_approval') {
        reply.code(409);
        return {
          message: `Action can only be approved from awaiting_approval. Current status: ${action.status}.`,
        };
      }

      const approved = await prisma.agentAction.update({
        where: { id: payload.actionId },
        data: { status: 'approved' },
      });

      logEvent(request.log, 'agent_action.approved', {
        requestId: request.id,
        projectId: action.projectId,
        actionId: action.id,
        status: 'approved',
      });
      logDebug(request.log, 'agent_action.approved.debug', {
        requestId: request.id,
        projectId: action.projectId,
        actionId: action.id,
        actionType: action.type,
        status: 'approved',
      });

      const taskType: Task['type'] = action.type.startsWith('sync_') ? 'sync' : action.type === 'export_sheets' ? 'export' : action.type === 'run_browser_checks' ? 'run' : 'generation';
      const task = await createTaskForAction(action.id, action.projectId, action.title, taskType, (action.input as Record<string, unknown>) ?? {}, 'queued');
      logEvent(request.log, 'task.started', {
        requestId: request.id,
        projectId: action.projectId,
        actionId: action.id,
        taskId: task.id,
        status: 'queued',
      });
      logDebug(request.log, 'task.started.debug', {
        requestId: request.id,
        projectId: action.projectId,
        actionId: action.id,
        taskId: task.id,
        taskType,
        status: 'queued',
      });

      if (action.type === 'sync_jira' || action.type === 'sync_trello' || action.type === 'export_sheets') {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });

        try {
          const output = await executeIntegrationAction(action);

          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'passed',
              output: {
                summary: action.type === 'export_sheets' ? 'Export completed successfully.' : 'Provider sync completed successfully.',
                details: output,
              } as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });

          logEvent(request.log, 'task.completed', {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            taskId: task.id,
            status: 'passed',
          });
          logDebug(request.log, 'task.completed.debug', {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            taskId: task.id,
            taskType,
            outputKeys: output && typeof output === 'object' ? Object.keys(output as Record<string, unknown>).sort() : [],
            status: 'passed',
          });

          const completed = await prisma.agentAction.update({
            where: { id: payload.actionId },
            data: {
              status: 'completed',
              result: {
                summary: action.type === 'export_sheets' ? 'Export completed successfully.' : 'Provider sync completed successfully.',
                ...output,
              } as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });

          logEvent(request.log, 'agent_action.completed', {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            status: 'completed',
          });
          logDebug(request.log, 'agent_action.completed.debug', {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            actionType: action.type,
            mode: String(((action.input as Record<string, unknown>) ?? {}).mode ?? 'create'),
            status: 'completed',
          });

          reply.code(201);
          return { action: toAction(completed) };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Integration action failed.';

          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: message,
              completedAt: new Date(),
            },
          });

          logError(request.log, 'task.failed', classifyError(error), {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            taskId: task.id,
            status: 'failed',
          }, error);

          const failed = await prisma.agentAction.update({
            where: { id: payload.actionId },
            data: {
              status: 'failed',
              result: {
                summary: message,
              } as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });

          logError(request.log, 'agent_action.failed', classifyError(error), {
            requestId: request.id,
            projectId: action.projectId,
            actionId: action.id,
            status: 'failed',
          }, error);

          reply.code(201);
          return { action: toAction(failed) };
        }
      }

      reply.code(201);
      return { action: toAction(approved) };
    } catch (error) {
      logError(request.log, 'agent_action.approve.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });
}
