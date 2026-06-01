import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AgentAction, AgentActionStatus, Task, TaskOutput } from '@diotest/domain/platform/types';
import type { AnalyzeResult } from '@diotest/domain/analysis/types';
import type { UiRecorderGenerationResult } from '@diotest/domain/recorder/types';

import { prisma } from '../db.js';
import { runHostedProjectAnalysis } from '../lib/ai/project-analysis.js';
import { runHostedProjectBrowserChecks } from '../lib/ai/project-browser-checks.js';
import { runHostedRecorderGeneration } from '../lib/ai/project-recorder.js';
import { canAutoExecuteAction, getTaskTypeForAction } from '../lib/agents/policies.js';
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

function summarizeAnalysis(result: AnalyzeResult): TaskOutput {
  if (!result.ok) {
    return {
      summary: result.error,
      details: {
        code: result.code ?? null,
      },
    };
  }

  const topRisk = result.result.risk_areas[0];
  const topManualCases = result.result.manual_test_cases.slice(0, 3).map((item) => item.title);

  return {
    summary: topRisk
      ? `Risk ${result.result.risk_score.toFixed(1)}/10. Top area: ${topRisk.area}.`
      : `Risk ${result.result.risk_score.toFixed(1)}/10 with ${result.result.manual_test_cases.length} manual test cases generated.`,
    details: {
      riskScore: result.result.risk_score,
      topRiskArea: topRisk ?? null,
      manualCaseTitles: topManualCases,
      coverageLevel: result.result.meta.coverage_level,
      warnings: result.debug.warnings,
      analysis: result.result,
      debug: result.debug,
    },
  };
}

function summarizeRecorderGeneration(result: UiRecorderGenerationResult): TaskOutput {
  return {
    summary: `Generated ${result.manual_test_cases.length} manual test cases and ${result.playwright_scenario.steps.length} Playwright steps.`,
    details: {
      manualTestCases: result.manual_test_cases,
      playwrightScenario: result.playwright_scenario,
      generatedManualCount: result.manual_test_cases.length,
      generatedPlaywrightStepCount: result.playwright_scenario.steps.length,
    },
  };
}

function summarizeGeneratedTests(result: AnalyzeResult): TaskOutput {
  if (!result.ok) {
    return {
      summary: result.error,
      details: {
        code: result.code ?? null,
      },
    };
  }

  const prioritizedUnit = result.result.test_plan.unit.slice(0, 3).map((item) => item.title);
  const prioritizedIntegration = result.result.test_plan.integration.slice(0, 3).map((item) => item.title);
  const prioritizedE2e = result.result.test_plan.e2e.slice(0, 3).map((item) => item.title);

  return {
    summary: `Generated ${result.result.manual_test_cases.length} manual cases with ${result.result.test_plan.unit.length + result.result.test_plan.integration.length + result.result.test_plan.e2e.length} prioritized automated test ideas.`,
    details: {
      manualTestCases: result.result.manual_test_cases,
      testPlan: result.result.test_plan,
      prioritizedUnit,
      prioritizedIntegration,
      prioritizedE2e,
      coverageLevel: result.result.meta.coverage_level,
      warnings: result.debug.warnings,
    },
  };
}

async function executeReadOnlyAction(action: {
  id: string;
  projectId: string;
  type: string;
  title: string;
  input: Prisma.JsonValue;
}): Promise<TaskOutput> {
  if (action.type === 'analyze_pr') {
    const project = await prisma.project.findUnique({
      where: { id: action.projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new Error('Project not found.');
    }

    const input = (action.input as Record<string, unknown>) ?? {};
    const includeDeepScan = input.deepScan === true || input.includeDeepScan === true;
    const result = await runHostedProjectAnalysis({
      organizationId: project.organizationId,
      projectId: action.projectId,
      includeDeepScan,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return summarizeAnalysis(result);
  }

  if (action.type === 'generate_from_recorder') {
    const project = await prisma.project.findUnique({
      where: { id: action.projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new Error('Project not found.');
    }

    const input = (action.input as Record<string, unknown>) ?? {};
    const generation = await runHostedRecorderGeneration({
      organizationId: project.organizationId,
      projectId: action.projectId,
      sessionId: typeof input.sessionId === 'string' ? input.sessionId : undefined,
      session: input.session,
      options: input.options,
    });

    if (!generation.ok) {
      throw new Error(generation.error);
    }

    return summarizeRecorderGeneration(generation.result);
  }

  if (action.type === 'generate_tests') {
    const project = await prisma.project.findUnique({
      where: { id: action.projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new Error('Project not found.');
    }

    const input = (action.input as Record<string, unknown>) ?? {};
    const includeDeepScan = input.deepScan === true || input.includeDeepScan === true;
    const result = await runHostedProjectAnalysis({
      organizationId: project.organizationId,
      projectId: action.projectId,
      includeDeepScan,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return summarizeGeneratedTests(result);
  }

  return {
    summary: action.type === 'generate_tests' ? 'Read-only generation completed.' : 'Read-only action completed.',
  };
}

async function executeSupportedAction(action: {
  id: string;
  projectId: string;
  type: string;
  title: string;
  input: Prisma.JsonValue;
}): Promise<TaskOutput> {
  if (
    action.type === 'analyze_pr' ||
    action.type === 'generate_tests' ||
    action.type === 'generate_from_recorder'
  ) {
    return executeReadOnlyAction(action);
  }

  if (action.type === 'run_browser_checks') {
    const project = await prisma.project.findUnique({
      where: { id: action.projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new Error('Project not found.');
    }

    return runHostedProjectBrowserChecks({
      organizationId: project.organizationId,
      projectId: action.projectId,
      input: ((action.input as Record<string, unknown> | null) ?? {}),
    });
  }

  if (action.type === 'sync_jira' || action.type === 'sync_trello' || action.type === 'export_sheets') {
    const output = await executeIntegrationAction(action);
    return {
      summary: action.type === 'export_sheets' ? 'Export completed successfully.' : 'Provider sync completed successfully.',
      details: output as Record<string, unknown>,
    };
  }

  throw new Error(`Unsupported action type: ${action.type}`);
}

async function runActionLifecycle(params: {
  action: {
    id: string;
    projectId: string;
    type: string;
    title: string;
    input: Prisma.JsonValue;
  };
  requestId: string;
  log: FastifyInstance['log'];
}) {
  const taskType = getTaskTypeForAction(params.action.type as AgentAction['type']);
  const input = (params.action.input as Record<string, unknown>) ?? {};

  await prisma.agentAction.update({
    where: { id: params.action.id },
    data: { status: 'running' },
  });

  const task = await createTaskForAction(params.action.id, params.action.projectId, params.action.title, taskType, input, 'running');

  logEvent(params.log, 'task.started', {
    requestId: params.requestId,
    projectId: params.action.projectId,
    actionId: params.action.id,
    taskId: task.id,
    status: 'running',
  });
  logDebug(params.log, 'task.started.debug', {
    requestId: params.requestId,
    projectId: params.action.projectId,
    actionId: params.action.id,
    taskId: task.id,
    taskType,
    status: 'running',
  });

  try {
    const output = await executeSupportedAction(params.action);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'passed',
        output: output as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    const completed = await prisma.agentAction.update({
      where: { id: params.action.id },
      data: {
        status: 'completed',
        result: toActionResultJson(output),
        completedAt: new Date(),
      },
    });

    logEvent(params.log, 'task.completed', {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      taskId: task.id,
      status: 'passed',
    });
    logDebug(params.log, 'task.completed.debug', {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      taskId: task.id,
      taskType,
      status: 'passed',
    });

    logEvent(params.log, 'agent_action.completed', {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      status: 'completed',
    });
    logDebug(params.log, 'agent_action.completed.debug', {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      actionType: params.action.type,
      status: 'completed',
    });

    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action execution failed.';

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      },
    });

    const failed = await prisma.agentAction.update({
      where: { id: params.action.id },
      data: {
        status: 'failed',
        result: { summary: message } as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    logError(params.log, 'task.failed', classifyError(error), {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      taskId: task.id,
      status: 'failed',
    }, error);

    logError(params.log, 'agent_action.failed', classifyError(error), {
      requestId: params.requestId,
      projectId: params.action.projectId,
      actionId: params.action.id,
      status: 'failed',
    }, error);

    return failed;
  }
}

function toActionResultJson(output: TaskOutput): Prisma.InputJsonValue {
  return output.details
    ? ({ summary: output.summary, ...output.details } as Prisma.InputJsonValue)
    : ({ summary: output.summary } as Prisma.InputJsonValue);
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
      const initialStatus: AgentActionStatus = payload.approvalRequired ? 'awaiting_approval' : 'approved';

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
          completedAt: null,
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

      if (canAutoExecuteAction({ approvalRequired: payload.approvalRequired })) {
        const updated = await runActionLifecycle({
          action: {
            id: action.id,
            projectId: payload.projectId,
            type: payload.type,
            title: payload.title,
            input: payload.input as Prisma.JsonValue,
          },
          requestId: request.id,
          log: request.log,
        });

        reply.code(201);
        return { action: toAction(updated) };
      }

      reply.code(201);
      return { action: toAction((await prisma.agentAction.findUniqueOrThrow({ where: { id: action.id } }))) };
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

      await prisma.agentAction.update({
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

      const completedOrFailed = await runActionLifecycle({
        action,
        requestId: request.id,
        log: request.log,
      });

      reply.code(201);
      return { action: toAction(completedOrFailed) };
    } catch (error) {
      logError(request.log, 'agent_action.approve.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });
}
