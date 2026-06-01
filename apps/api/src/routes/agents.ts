import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { ExecutedTool } from '../lib/agent-tools/types.js';
import { runHostedAgentChat, runHostedAgentChatWithTools, selectToolsForMessage } from '../lib/agents/orchestrator.js';
import { executeToolsWithProgress, getAllowedToolNamesForAction } from '../lib/agent-tools/registry.js';
import { classifyError, logDebug, logError, logEvent } from '../lib/logging.js';

const listThreadsSchema = z.object({
  projectId: z.string().min(1),
});

const threadIdParamsSchema = z.object({
  threadId: z.string().min(1),
});

const createThreadSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  content: z.string().min(1),
});

const sendMessageSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  content: z.string().min(1),
});

function toThread(record: {
  id: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{ id: string; role: string; content: string; meta: Prisma.JsonValue | null; createdAt: Date }>;
}) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: normalizeThreadTitle(record.title, 'Untitled thread'),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    messages: record.messages?.map((message) => ({
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: sanitizeAssistantText(message.content),
      meta: (message.meta as Record<string, unknown> | null) ?? null,
      createdAt: message.createdAt.toISOString(),
    })) ?? [],
    lastMessagePreview: sanitizeAssistantText(record.messages?.at(-1)?.content ?? '').slice(0, 120),
  };
}

function makeThreadTitle(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= 60 ? normalized : `${normalized.slice(0, 57)}...`;
}

function sanitizeAssistantText(content: string) {
  const trimmed = content.trim();
  return trimmed.replace(/^[:\-,.\s]+(?=[A-Za-z0-9])/, '');
}

function normalizeThreadTitle(candidate: string | null | undefined, fallback: string) {
  const normalized = sanitizeAssistantText(candidate ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 3 || !/[A-Za-z0-9]/.test(normalized)) {
    return fallback;
  }
  return normalized.length <= 60 ? normalized : `${normalized.slice(0, 57)}...`;
}

function classifyProviderError(message: string): {
  title: string;
  answer: string;
  requiresRuntimeConfig: boolean;
  resolutionHref: string | null;
  resolutionLabel: string | null;
} {
  if (/AI runtime config|No AI runtime configuration/i.test(message)) {
    return {
      title: 'Runtime not configured',
      answer: 'No AI provider is configured. Add a valid API key in Runtime Settings to start using the agent.',
      requiresRuntimeConfig: true,
      resolutionHref: '/app/settings/runtime',
      resolutionLabel: 'Open Runtime Settings',
    };
  }

  // Parse OpenRouter/OpenAI error JSON embedded in the message
  const jsonMatch = message.match(/\{.*\}/s);
  let providerJson: { error?: { message?: string; code?: number; metadata?: { headers?: Record<string, string>; provider_name?: string } } } | null = null;
  if (jsonMatch) {
    try { providerJson = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
  }

  const providerCode = providerJson?.error?.code;
  const providerMessage = providerJson?.error?.message ?? '';
  const headers = providerJson?.error?.metadata?.headers ?? {};
  const resetTs = headers['X-RateLimit-Reset'];
  const remaining = headers['X-RateLimit-Remaining'];

  if (providerCode === 429 || /429|rate.?limit|too many requests/i.test(message)) {
    let resetInfo = '';
    if (resetTs) {
      const resetDate = new Date(Number(resetTs));
      const now = Date.now();
      const diffMs = resetDate.getTime() - now;
      const diffMins = Math.ceil(diffMs / 60000);
      resetInfo = diffMs > 0
        ? ` Resets in ${diffMins < 60 ? `${diffMins}m` : `${Math.ceil(diffMins / 60)}h`}.`
        : ' Limit resets soon.';
    }
    const freeTier = /free-models-per-day|free tier/i.test(providerMessage);
    return {
      title: 'Rate limit reached',
      answer: freeTier
        ? `OpenRouter free tier limit hit (${remaining ?? '0'} requests remaining).${resetInfo} Add credits at openrouter.ai or switch to a paid model in Runtime Settings.`
        : `Provider rate limit reached.${resetInfo} Try again shortly or switch to a different model in Runtime Settings.`,
      requiresRuntimeConfig: false,
      resolutionHref: '/app/settings/runtime',
      resolutionLabel: 'Change model',
    };
  }

  if (/401|unauthorized|invalid.*key|api.*key/i.test(message)) {
    return {
      title: 'Invalid API key',
      answer: 'The API key was rejected by the provider. Check that the key in Runtime Settings is correct and active.',
      requiresRuntimeConfig: true,
      resolutionHref: '/app/settings/runtime',
      resolutionLabel: 'Check API key',
    };
  }

  if (/timeout|aborted|abort/i.test(message)) {
    return {
      title: 'Request timed out',
      answer: 'The provider took too long to respond. This can happen with free or overloaded models. Try again or switch to a faster model in Runtime Settings.',
      requiresRuntimeConfig: false,
      resolutionHref: '/app/settings/runtime',
      resolutionLabel: 'Switch model',
    };
  }

  if (/503|502|upstream|overloaded/i.test(message)) {
    return {
      title: 'Provider unavailable',
      answer: 'The AI provider is temporarily unavailable or overloaded. Try again in a moment or switch to a different model.',
      requiresRuntimeConfig: false,
      resolutionHref: '/app/settings/runtime',
      resolutionLabel: 'Switch model',
    };
  }

  return {
    title: 'Agent response failed',
    answer: `The agent couldn't generate a reply. Provider said: ${message.slice(0, 200)}`,
    requiresRuntimeConfig: false,
    resolutionHref: '/app/settings/runtime',
    resolutionLabel: 'Check runtime settings',
  };
}

function buildFallbackAssistantReply(error: unknown) {
  const message = error instanceof Error ? error.message : 'The agent could not respond.';
  const classified = classifyProviderError(message);

  return {
    title: classified.title,
    answer: classified.answer,
    reasoningSummary: `Agent failed: ${message.slice(0, 120)}`,
    investigationAreas: ['Agent runtime health'],
    toolTrace: [] as Array<{ tool: string; status: 'used'; note: string }>,
    requiresRuntimeConfig: classified.requiresRuntimeConfig,
    resolutionHref: classified.resolutionHref,
    resolutionLabel: classified.resolutionLabel,
    suggestedActions: [] as Array<{
      title: string;
      description: string;
      actionType: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
      target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
      readOnly: boolean;
      approvalRequired: boolean;
      input: Record<string, unknown>;
    }>,
  };
}

export async function registerAgentRoutes(app: FastifyInstance) {
  app.get('/agent-threads', async (request) => {
    const query = listThreadsSchema.parse(request.query);
    const threads = await prisma.agentThread.findMany({
      where: { projectId: query.projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return {
      threads: await Promise.all(threads.map(async (thread) => {
        const latestMessage = await prisma.agentMessage.findFirst({
          where: { threadId: thread.id },
          orderBy: { createdAt: 'desc' },
        });

        return {
          id: thread.id,
          projectId: thread.projectId,
          title: thread.title,
          createdAt: thread.createdAt.toISOString(),
          updatedAt: thread.updatedAt.toISOString(),
          lastMessagePreview: latestMessage?.content.slice(0, 120) ?? '',
        };
      })),
    };
  });

  app.get('/agent-threads/:threadId', async (request, reply) => {
    const params = threadIdParamsSchema.parse(request.params);
    const thread = await prisma.agentThread.findUnique({
      where: { id: params.threadId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      reply.code(404);
      return { message: 'Thread not found.' };
    }

    return { thread: toThread(thread) };
  });

  app.post('/agent-threads', async (request, reply) => {
    try {
      const payload = createThreadSchema.parse(request.body);
      const thread = await prisma.agentThread.create({
        data: {
          projectId: payload.projectId,
          title: makeThreadTitle(payload.content),
        },
      });

      await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'user',
          content: payload.content,
        },
      });

      const assistant = await runHostedAgentChat({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        messages: [{ role: 'user', content: payload.content }],
      }).catch((error) => buildFallbackAssistantReply(error));
      const assistantAnswer = sanitizeAssistantText(assistant.answer);
      const threadTitle = normalizeThreadTitle(assistant.title, thread.title);

      await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: assistantAnswer,
          meta: {
            reasoningSummary: assistant.reasoningSummary,
            toolTrace: assistant.toolTrace,
            requiresRuntimeConfig: 'requiresRuntimeConfig' in assistant ? assistant.requiresRuntimeConfig : false,
            resolutionHref: 'resolutionHref' in assistant ? assistant.resolutionHref : null,
            resolutionLabel: 'resolutionLabel' in assistant ? assistant.resolutionLabel : null,
            suggestedActions: assistant.suggestedActions,
            investigationAreas: assistant.investigationAreas,
          } as Prisma.InputJsonValue,
        },
      });

      const updated = await prisma.agentThread.update({
        where: { id: thread.id },
        data: {
          title: threadTitle,
          updatedAt: new Date(),
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      logEvent(request.log, 'agent_thread.created', {
        requestId: request.id,
        projectId: payload.projectId,
        threadId: thread.id,
        status: 'success',
      });
      logDebug(request.log, 'agent_thread.created.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        threadId: thread.id,
        suggestionCount: assistant.suggestedActions.length,
      });

      reply.code(201);
      return { thread: toThread(updated) };
    } catch (error) {
      logError(request.log, 'agent_thread.create.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  // ── Streaming SSE for new thread ─────────────────────────────────────────
  app.post('/agent-threads/stream', async (request, reply) => {
    const payload = createThreadSchema.parse(request.body);

    const thread = await prisma.agentThread.create({
      data: { projectId: payload.projectId, title: makeThreadTitle(payload.content) },
    });

    await prisma.agentMessage.create({
      data: { threadId: thread.id, role: 'user', content: payload.content },
    });

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.hijack();

    const emit = (data: object) => { reply.raw.write(`data: ${JSON.stringify(data)}\n\n`); };

    try {
      emit({ type: 'thread_created', threadId: thread.id });

      const messages = [{ role: 'user' as const, content: payload.content }];
      const selectedToolNames = selectToolsForMessage({
        messages,
        availableTools: getAllowedToolNamesForAction('studio_agent_chat'),
      });

      const allTools: ExecutedTool[] = [];
      if (selectedToolNames.length > 0) {
        for await (const event of executeToolsWithProgress('studio_agent_chat', {
          organizationId: payload.organizationId,
          projectId: payload.projectId,
          actionType: 'studio_agent_chat',
          toolFilter: selectedToolNames,
        })) {
          if (event.phase === 'start') {
            emit({ type: 'tool_start', tool: event.tool });
          } else {
            emit({ type: 'tool_done', tool: event.tool });
            allTools.push(event.executed);
          }
        }
      }

      emit({ type: 'generating' });

      const assistant = await runHostedAgentChatWithTools({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        messages,
        tools: allTools,
      }).catch((error) => buildFallbackAssistantReply(error));

      const assistantAnswer = sanitizeAssistantText(assistant.answer);
      const threadTitle = normalizeThreadTitle(assistant.title, thread.title);

      await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: assistantAnswer,
          meta: {
            reasoningSummary: assistant.reasoningSummary,
            toolTrace: assistant.toolTrace,
            requiresRuntimeConfig: 'requiresRuntimeConfig' in assistant ? assistant.requiresRuntimeConfig : false,
            resolutionHref: 'resolutionHref' in assistant ? assistant.resolutionHref : null,
            resolutionLabel: 'resolutionLabel' in assistant ? assistant.resolutionLabel : null,
            suggestedActions: assistant.suggestedActions,
            investigationAreas: assistant.investigationAreas,
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.agentThread.update({
        where: { id: thread.id },
        data: { title: threadTitle, updatedAt: new Date() },
      });

      emit({ type: 'complete', threadId: thread.id });
    } catch (error) {
      emit({ type: 'error', message: error instanceof Error ? error.message : 'Stream failed.' });
      logError(request.log, 'agent_thread.create_stream.failed', classifyError(error), { requestId: request.id }, error);
    } finally {
      reply.raw.end();
    }
  });

  app.post('/agent-threads/:threadId/messages', async (request, reply) => {
    try {
      const params = threadIdParamsSchema.parse(request.params);
      const payload = sendMessageSchema.parse(request.body);
      const thread = await prisma.agentThread.findUnique({
        where: { id: params.threadId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!thread || thread.projectId !== payload.projectId) {
        reply.code(404);
        return { message: 'Thread not found.' };
      }

      await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'user',
          content: payload.content,
        },
      });

      const conversation = [
        ...thread.messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
        { role: 'user' as const, content: payload.content },
      ];

      const assistant = await runHostedAgentChat({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        messages: conversation,
      }).catch((error) => buildFallbackAssistantReply(error));
      const assistantAnswer = sanitizeAssistantText(assistant.answer);
      const nextTitle = normalizeThreadTitle(assistant.title, thread.title);

      await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: assistantAnswer,
          meta: {
            reasoningSummary: assistant.reasoningSummary,
            toolTrace: assistant.toolTrace,
            requiresRuntimeConfig: 'requiresRuntimeConfig' in assistant ? assistant.requiresRuntimeConfig : false,
            resolutionHref: 'resolutionHref' in assistant ? assistant.resolutionHref : null,
            resolutionLabel: 'resolutionLabel' in assistant ? assistant.resolutionLabel : null,
            suggestedActions: assistant.suggestedActions,
            investigationAreas: assistant.investigationAreas,
          } as Prisma.InputJsonValue,
        },
      });

      const updated = await prisma.agentThread.update({
        where: { id: thread.id },
        data: {
          updatedAt: new Date(),
          title: thread.messages.length <= 1 ? nextTitle : thread.title,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      logEvent(request.log, 'agent_thread.message.created', {
        requestId: request.id,
        projectId: payload.projectId,
        threadId: thread.id,
        status: 'success',
      });
      logDebug(request.log, 'agent_thread.message.created.debug', {
        requestId: request.id,
        projectId: payload.projectId,
        threadId: thread.id,
        messageCount: updated.messages.length,
        suggestionCount: assistant.suggestedActions.length,
      });

      reply.code(201);
      return { thread: toThread(updated) };
    } catch (error) {
      logError(request.log, 'agent_thread.message.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
      throw error;
    }
  });

  // ── Streaming SSE endpoint ────────────────────────────────────────────────
  app.post('/agent-threads/:threadId/messages/stream', async (request, reply) => {
    const params = threadIdParamsSchema.parse(request.params);
    const payload = sendMessageSchema.parse(request.body);

    const thread = await prisma.agentThread.findUnique({
      where: { id: params.threadId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!thread || thread.projectId !== payload.projectId) {
      reply.code(404);
      return { message: 'Thread not found.' };
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.hijack();

    const emit = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await prisma.agentMessage.create({
        data: { threadId: thread.id, role: 'user', content: payload.content },
      });

      emit({ type: 'user_saved' });

      const conversation = [
        ...thread.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: payload.content },
      ];

      const selectedToolNames = selectToolsForMessage({
        messages: conversation,
        availableTools: getAllowedToolNamesForAction('studio_agent_chat'),
      });

      const allTools: ExecutedTool[] = [];
      if (selectedToolNames.length > 0) {
        for await (const event of executeToolsWithProgress('studio_agent_chat', {
          organizationId: payload.organizationId,
          projectId: payload.projectId,
          actionType: 'studio_agent_chat',
          toolFilter: selectedToolNames,
        })) {
          if (event.phase === 'start') {
            emit({ type: 'tool_start', tool: event.tool });
          } else {
            emit({ type: 'tool_done', tool: event.tool });
            allTools.push(event.executed);
          }
        }
      }

      emit({ type: 'generating' });

      const assistant = await runHostedAgentChatWithTools({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        messages: conversation,
        tools: allTools,
      }).catch((error) => buildFallbackAssistantReply(error));

      const assistantAnswer = sanitizeAssistantText(assistant.answer);
      const nextTitle = normalizeThreadTitle(assistant.title, thread.title);

      const saved = await prisma.agentMessage.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: assistantAnswer,
          meta: {
            reasoningSummary: assistant.reasoningSummary,
            toolTrace: assistant.toolTrace,
            requiresRuntimeConfig: 'requiresRuntimeConfig' in assistant ? assistant.requiresRuntimeConfig : false,
            resolutionHref: 'resolutionHref' in assistant ? assistant.resolutionHref : null,
            resolutionLabel: 'resolutionLabel' in assistant ? assistant.resolutionLabel : null,
            suggestedActions: assistant.suggestedActions,
            investigationAreas: assistant.investigationAreas,
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.agentThread.update({
        where: { id: thread.id },
        data: {
          updatedAt: new Date(),
          title: thread.messages.length <= 1 ? nextTitle : thread.title,
        },
      });

      emit({
        type: 'complete',
        message: {
          id: saved.id,
          role: 'assistant',
          content: assistantAnswer,
          meta: saved.meta,
          createdAt: saved.createdAt.toISOString(),
        },
      });

      logEvent(request.log, 'agent_thread.message.streamed', {
        requestId: request.id,
        projectId: payload.projectId,
        threadId: thread.id,
        status: 'success',
      });
    } catch (error) {
      emit({ type: 'error', message: error instanceof Error ? error.message : 'Stream failed.' });
      logError(request.log, 'agent_thread.stream.failed', classifyError(error), { requestId: request.id, status: 'failed' }, error);
    } finally {
      reply.raw.end();
    }
  });
}
