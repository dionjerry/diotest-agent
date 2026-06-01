import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { runHostedAgentExecution, runHostedAgentRecommendations, runHostedRuntimeHealthCheck } from '../lib/agents/orchestrator.js';
import { resolveAiRuntimeConfigForValidation } from '../lib/ai/runtime.js';
import { runHostedProjectAnalysis } from '../lib/ai/project-analysis.js';
import { runHostedProjectBrowserChecks } from '../lib/ai/project-browser-checks.js';
import { runHostedRecorderGeneration } from '../lib/ai/project-recorder.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';

const analysisSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  includeDeepScan: z.boolean().optional(),
});

const recorderSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  session: z.unknown().optional(),
  options: z.unknown().optional(),
}).refine((payload) => Boolean(payload.sessionId || payload.session), {
  message: 'Either a stored sessionId or a recorder session payload is required.',
});

const browserChecksSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
});

const agentRecommendationsSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  focus: z.string().optional(),
});

const agentRunSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  goal: z.string().min(1),
  focus: z.string().optional(),
  allowedActionTypes: z.array(z.enum(['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'])).optional(),
});

const runtimeHealthSchema = z.object({
  organizationId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  preferredProvider: z.enum(['openai', 'openrouter']).optional(),
  model: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
});

export async function registerRuntimeRoutes(app: FastifyInstance) {
  app.post('/runtime/analysis', {
    schema: {
      tags: ['runtime'],
      summary: 'Run hosted AI analysis',
      description: 'Runs the hosted analysis engine using DB-backed AI runtime settings for the given project scope.',
    },
  }, async (request, reply) => {
    try {
      const payload = analysisSchema.parse(request.body);
      const result = await runHostedProjectAnalysis(payload);

      logEvent(request.log, 'runtime.analysis.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: result.ok ? 'success' : 'failed',
      });
      logDebug(request.log, 'runtime.analysis.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        includeDeepScan: Boolean(payload.includeDeepScan),
        ok: result.ok,
      });

      reply.code(result.ok ? 200 : 422);
      return result;
    } catch (error) {
      logError(request.log, 'runtime.analysis.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/runtime/recorder/generate', {
    schema: {
      tags: ['runtime'],
      summary: 'Generate hosted recorder artifacts',
      description: 'Runs recorder artifact generation using DB-backed AI runtime settings for the given project scope.',
    },
  }, async (request, reply) => {
    try {
      const payload = recorderSchema.parse(request.body);
      const result = await runHostedRecorderGeneration({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        sessionId: payload.sessionId,
        session: payload.session,
        options: payload.options,
      });

      logEvent(request.log, 'runtime.recorder.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: result.ok ? 'success' : 'failed',
      });
      logDebug(request.log, 'runtime.recorder.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        ok: result.ok,
      });

      reply.code(result.ok ? 200 : 422);
      return result;
    } catch (error) {
      logError(request.log, 'runtime.recorder.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/runtime/browser-checks', {
    schema: {
      tags: ['runtime'],
      summary: 'Plan hosted browser checks',
      description: 'Builds a browser-facing QA check plan using DB-backed AI runtime settings and the hosted tool registry.',
    },
  }, async (request, reply) => {
    try {
      const payload = browserChecksSchema.parse(request.body);
      const result = await runHostedProjectBrowserChecks(payload);

      logEvent(request.log, 'runtime.browser_checks.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: 'success',
      });
      logDebug(request.log, 'runtime.browser_checks.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        inputKeys: Object.keys(payload.input ?? {}).sort(),
      });

      reply.code(200);
      return result;
    } catch (error) {
      logError(request.log, 'runtime.browser_checks.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/runtime/agents/recommendations', {
    schema: {
      tags: ['runtime'],
      summary: 'Generate hosted agent recommendations',
      description: 'Builds structured Studio recommendations using DB-backed AI runtime settings and the hosted tool registry.',
    },
  }, async (request, reply) => {
    try {
      const payload = agentRecommendationsSchema.parse(request.body);
      const result = await runHostedAgentRecommendations(payload);

      logEvent(request.log, 'runtime.agent_recommendations.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: 'success',
      });
      logDebug(request.log, 'runtime.agent_recommendations.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        hasFocus: Boolean(payload.focus),
        recommendationCount: result.recommendations.length,
      });

      reply.code(200);
      return result;
    } catch (error) {
      logError(request.log, 'runtime.agent_recommendations.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/runtime/agents/run', {
    schema: {
      tags: ['runtime'],
      summary: 'Run bounded hosted agent planning',
      description: 'Creates a bounded execution plan using DB-backed AI runtime settings and hosted tools.',
    },
  }, async (request, reply) => {
    try {
      const payload = agentRunSchema.parse(request.body);
      const result = await runHostedAgentExecution(payload);

      logEvent(request.log, 'runtime.agent_run.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: 'success',
      });
      logDebug(request.log, 'runtime.agent_run.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        hasFocus: Boolean(payload.focus),
        proposedActionCount: result.proposedActions.length,
        evidenceCount: result.evidence.length,
      });

      reply.code(200);
      return result;
    } catch (error) {
      logError(request.log, 'runtime.agent_run.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  app.post('/runtime/health', {
    schema: {
      tags: ['runtime'],
      summary: 'Validate effective AI runtime configuration',
      description: 'Performs a lightweight provider call using the effective runtime configuration for the given scope.',
    },
  }, async (request, reply) => {
    try {
      const payload = runtimeHealthSchema.parse(request.body);
      const runtime = await resolveAiRuntimeConfigForValidation({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        draft: {
          preferredProvider: payload.preferredProvider,
          model: payload.model,
          openaiApiKey: payload.openaiApiKey,
          openrouterApiKey: payload.openrouterApiKey,
        },
      });
      const validation = await runHostedRuntimeHealthCheck({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        provider: runtime.provider,
        model: runtime.model,
        scope: runtime.scope,
        apiKey: runtime.apiKey,
      });

      logEvent(request.log, 'runtime.health.completed', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        status: 'success',
      });
      logDebug(request.log, 'runtime.health.completed.debug', {
        requestId: request.id,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        provider: runtime.provider,
        model: runtime.model,
        scope: runtime.scope,
      });

      reply.code(200);
      return {
        ok: true,
        scope: runtime.scope,
        provider: runtime.provider,
        model: runtime.model,
        validation,
      };
    } catch (error) {
      logError(request.log, 'runtime.health.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      if (error instanceof Error) {
        reply.code(422);
        return { message: error.message };
      }
      throw error;
    }
  });
}
