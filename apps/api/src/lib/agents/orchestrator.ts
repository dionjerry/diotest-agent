import { z } from 'zod';

import type { TaskOutput } from '@diotest/domain/platform/types';
import { generateStructured } from '@diotest/providers';

import { executeToolsForAction, getAllowedToolNamesForAction, getTool } from '../agent-tools/registry.js';
import { generateStructuredWithRuntime } from '../ai/runtime.js';
import type { ExecutedTool } from '../agent-tools/types.js';

const browserChecksPlanSchema = z.object({
  summary: z.string().min(1),
  coverageGoal: z.string().min(1),
  checks: z.array(z.object({
    title: z.string().min(1),
    area: z.string().min(1),
    priority: z.enum(['high', 'medium', 'low']),
    steps: z.array(z.string().min(1)).min(2).max(6),
    expectedOutcome: z.string().min(1),
  })).min(3).max(8),
  warnings: z.array(z.string()),
  recommendedActions: z.array(z.string()).max(6),
});

const browserChecksPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'coverageGoal', 'checks', 'warnings', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    coverageGoal: { type: 'string' },
    checks: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'area', 'priority', 'steps', 'expectedOutcome'],
        properties: {
          title: { type: 'string' },
          area: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          steps: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string' },
          },
          expectedOutcome: { type: 'string' },
        },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedActions: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string' },
    },
  },
} as const;

const agentRecommendationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  buttonLabel: z.string().min(1),
  actionType: z.enum(['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets']),
  target: z.enum(['pr', 'recorder_session', 'test_case', 'run', 'project']),
  priority: z.enum(['high', 'medium', 'low']),
  tone: z.enum(['success', 'warn', 'neutral', 'danger']),
  readOnly: z.boolean(),
  approvalRequired: z.boolean(),
  rationale: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
});

const agentRecommendationsSchema = z.object({
  summary: z.string().min(1),
  recommendations: z.array(agentRecommendationSchema).min(3).max(5),
});

const agentRecommendationsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'recommendations'],
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'body',
          'buttonLabel',
          'actionType',
          'target',
          'priority',
          'tone',
          'readOnly',
          'approvalRequired',
          'rationale',
          'input',
        ],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          buttonLabel: { type: 'string' },
          actionType: {
            type: 'string',
            enum: ['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'],
          },
          target: {
            type: 'string',
            enum: ['pr', 'recorder_session', 'test_case', 'run', 'project'],
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          tone: {
            type: 'string',
            enum: ['success', 'warn', 'neutral', 'danger'],
          },
          readOnly: { type: 'boolean' },
          approvalRequired: { type: 'boolean' },
          rationale: { type: 'string' },
          input: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const;

export type HostedAgentRecommendations = z.infer<typeof agentRecommendationsSchema>;

const agentChatReplySchema = z.object({
  title: z.string().min(1),
  answer: z.string().min(1),
  reasoningSummary: z.string().min(1),
  investigationAreas: z.array(z.string()).max(6),
  toolTrace: z.array(z.object({
    tool: z.string().min(1),
    status: z.enum(['used']),
    note: z.string().min(1),
  })).max(12),
  suggestedActions: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    actionType: z.enum(['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets']),
    target: z.enum(['pr', 'recorder_session', 'test_case', 'run', 'project']),
    readOnly: z.boolean(),
    approvalRequired: z.boolean(),
    input: z.record(z.string(), z.unknown()),
  })).max(5),
});

const agentChatReplyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'answer', 'reasoningSummary', 'investigationAreas', 'toolTrace', 'suggestedActions'],
  properties: {
    title: { type: 'string' },
    answer: { type: 'string' },
    reasoningSummary: { type: 'string' },
    investigationAreas: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string' },
    },
    toolTrace: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tool', 'status', 'note'],
        properties: {
          tool: { type: 'string' },
          status: { type: 'string', enum: ['used'] },
          note: { type: 'string' },
        },
      },
    },
    suggestedActions: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'actionType', 'target', 'readOnly', 'approvalRequired', 'input'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          actionType: {
            type: 'string',
            enum: ['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'],
          },
          target: {
            type: 'string',
            enum: ['pr', 'recorder_session', 'test_case', 'run', 'project'],
          },
          readOnly: { type: 'boolean' },
          approvalRequired: { type: 'boolean' },
          input: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const;

export type HostedAgentChatReply = z.infer<typeof agentChatReplySchema>;
type HostedAgentChatReplyWithResolution = HostedAgentChatReply & {
  requiresRuntimeConfig?: boolean;
  resolutionHref?: string | null;
  resolutionLabel?: string | null;
};

const agentRunSchema = z.object({
  summary: z.string().min(1),
  plan: z.array(z.string().min(1)).min(3).max(8),
  investigationAreas: z.array(z.string()).max(6),
  evidence: z.array(z.object({
    tool: z.string().min(1),
    takeaway: z.string().min(1),
  })).min(2).max(8),
  proposedActions: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    actionType: z.enum(['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets']),
    target: z.enum(['pr', 'recorder_session', 'test_case', 'run', 'project']),
    readOnly: z.boolean(),
    approvalRequired: z.boolean(),
    input: z.record(z.string(), z.unknown()),
  })).max(5),
});

const agentRunJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'plan', 'investigationAreas', 'evidence', 'proposedActions'],
  properties: {
    summary: { type: 'string' },
    plan: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: { type: 'string' },
    },
    investigationAreas: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string' },
    },
    evidence: {
      type: 'array',
      minItems: 2,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tool', 'takeaway'],
        properties: {
          tool: { type: 'string' },
          takeaway: { type: 'string' },
        },
      },
    },
    proposedActions: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'actionType', 'target', 'readOnly', 'approvalRequired', 'input'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          actionType: {
            type: 'string',
            enum: ['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'],
          },
          target: {
            type: 'string',
            enum: ['pr', 'recorder_session', 'test_case', 'run', 'project'],
          },
          readOnly: { type: 'boolean' },
          approvalRequired: { type: 'boolean' },
          input: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const;

const runtimeHealthSchema = z.object({
  status: z.enum(['ok']),
  providerEcho: z.enum(['openai', 'openrouter']),
  modelEcho: z.string().min(1),
  scopeEcho: z.enum(['project', 'organization', 'system']),
  note: z.string().min(1),
});

const runtimeHealthJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'providerEcho', 'modelEcho', 'scopeEcho', 'note'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    providerEcho: { type: 'string', enum: ['openai', 'openrouter'] },
    modelEcho: { type: 'string' },
    scopeEcho: { type: 'string', enum: ['project', 'organization', 'system'] },
    note: { type: 'string' },
  },
} as const;

export type HostedAgentRun = z.infer<typeof agentRunSchema>;
export type RuntimeHealthResult = z.infer<typeof runtimeHealthSchema>;

function describeToolOutput(tool: ExecutedTool) {
  const output = tool.output;
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const record = output as Record<string, unknown>;

    if (typeof record.summary === 'string' && record.summary.trim()) {
      return record.summary.trim();
    }

    if (typeof record.status === 'string' && record.status.trim()) {
      return `Reported ${record.status.trim()} status.`;
    }

    if (Array.isArray(record.items)) {
      return `Loaded ${record.items.length} item${record.items.length === 1 ? '' : 's'}.`;
    }
  }

  return tool.description;
}

function buildAuthoritativeToolTrace(
  tools: ExecutedTool[],
  candidateTrace: HostedAgentChatReply['toolTrace'] = [],
): HostedAgentChatReply['toolTrace'] {
  const candidateByName = new Map(
    candidateTrace.map((item) => [item.tool.toLowerCase().replaceAll(' ', '_'), item] as const),
  );

  return tools.map((tool) => {
    const candidate = candidateByName.get(tool.name);
    return {
      tool: tool.name,
      status: 'used' as const,
      note: candidate?.note?.trim() || describeToolOutput(tool),
    };
  });
}

function classifyProviderError(message: string) {
  if (/AI runtime config|No AI runtime configuration/i.test(message)) {
    return { title: 'Runtime not configured', answer: 'No AI provider is configured. Add a valid API key in Runtime Settings.', requiresRuntimeConfig: true, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Open Runtime Settings' };
  }
  const jsonMatch = message.match(/\{.*\}/s);
  let providerJson: { error?: { message?: string; code?: number; metadata?: { headers?: Record<string, string> } } } | null = null;
  if (jsonMatch) { try { providerJson = JSON.parse(jsonMatch[0]); } catch { /* ignore */ } }
  const providerCode = providerJson?.error?.code;
  const providerMessage = providerJson?.error?.message ?? '';
  const headers = providerJson?.error?.metadata?.headers ?? {};
  const resetTs = headers['X-RateLimit-Reset'];
  const remaining = headers['X-RateLimit-Remaining'];
  if (providerCode === 429 || /429|rate.?limit|too many requests/i.test(message)) {
    let resetInfo = '';
    if (resetTs) {
      const diffMins = Math.ceil((Number(resetTs) - Date.now()) / 60000);
      resetInfo = diffMins > 0 ? ` Resets in ${diffMins < 60 ? `${diffMins}m` : `${Math.ceil(diffMins / 60)}h`}.` : ' Limit resets soon.';
    }
    const freeTier = /free-models-per-day|free tier/i.test(providerMessage);
    return { title: 'Rate limit reached', answer: freeTier ? `OpenRouter free tier limit hit (${remaining ?? '0'} requests remaining).${resetInfo} Add credits at openrouter.ai or switch to a paid model in Runtime Settings.` : `Provider rate limit reached.${resetInfo} Try again shortly or switch model.`, requiresRuntimeConfig: false, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Change model' };
  }
  if (/401|unauthorized|invalid.*key|api.*key/i.test(message)) {
    return { title: 'Invalid API key', answer: 'The API key was rejected. Check Runtime Settings.', requiresRuntimeConfig: true, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Check API key' };
  }
  if (/timeout|aborted|abort/i.test(message)) {
    return { title: 'Request timed out', answer: 'The provider took too long to respond. Try again or switch to a faster model.', requiresRuntimeConfig: false, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Switch model' };
  }
  if (/503|502|upstream|overloaded/i.test(message)) {
    return { title: 'Provider unavailable', answer: 'The AI provider is temporarily unavailable. Try again in a moment or switch model.', requiresRuntimeConfig: false, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Switch model' };
  }
  return { title: 'Agent response failed', answer: `The agent couldn't generate a reply: ${message.slice(0, 200)}`, requiresRuntimeConfig: false, resolutionHref: '/app/settings/runtime', resolutionLabel: 'Check runtime settings' };
}

export async function runHostedBrowserChecks(params: {
  organizationId: string;
  projectId: string;
  input?: Record<string, unknown>;
}): Promise<TaskOutput> {
  const tools = await executeToolsForAction('run_browser_checks', {
    organizationId: params.organizationId,
    projectId: params.projectId,
    actionType: 'run_browser_checks',
  });

  const response = await generateStructuredWithRuntime({
    organizationId: params.organizationId,
    projectId: params.projectId,
    feature: 'agents',
    timeoutMs: 60_000,
    systemPrompt: [
      'You are DioTest browser QA planner.',
      'Create a focused browser check plan for the project based only on the provided tool outputs.',
      'Prioritize browser-visible user flows, auth, navigation, runtime misconfiguration symptoms, and integration touchpoints.',
      'Do not invent unavailable routes or integrations.',
      'Return concise, execution-ready checks with clear expected outcomes.',
    ].join(' '),
    userPrompt: JSON.stringify({
      request: {
        action: 'run_browser_checks',
        source: params.input?.source ?? 'unknown',
        projectSlug: params.input?.projectSlug ?? null,
        focus: params.input?.focus ?? 'Validate the current project runtime and browser-facing flows.',
      },
      tools,
    }, null, 2),
    schema: browserChecksPlanJsonSchema,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Browser check plan generation failed.');
  }

  const plan = browserChecksPlanSchema.parse(response.data);

  return {
    summary: plan.summary,
    details: {
      coverageGoal: plan.coverageGoal,
      checks: plan.checks,
      warnings: plan.warnings,
      recommendedActions: plan.recommendedActions,
      toolsUsed: tools.map((tool) => tool.name),
    },
  };
}

export async function runHostedAgentRecommendations(params: {
  organizationId: string;
  projectId: string;
  focus?: string;
}): Promise<HostedAgentRecommendations> {
  const tools = await executeToolsForAction('run_browser_checks', {
    organizationId: params.organizationId,
    projectId: params.projectId,
    actionType: 'run_browser_checks',
  });

  const response = await generateStructuredWithRuntime({
    organizationId: params.organizationId,
    projectId: params.projectId,
    feature: 'agents',
    timeoutMs: 60_000,
    systemPrompt: [
      'You are DioTest Agent Studio recommendation planner.',
      'Recommend the next highest-value testing actions for this project based only on the provided tool outputs.',
      'Choose from the allowed action types only.',
      'Prefer concrete, execution-ready recommendations tied to visible project risk, runtime health, repository status, and recent operations.',
      'Do not invent unavailable integrations, PRs, or recorder sessions.',
      'Balance urgency with feasibility and return concise recommendations.',
    ].join(' '),
    userPrompt: JSON.stringify({
      request: {
        area: 'studio_recommendations',
        focus: params.focus ?? 'Recommend the next best agent actions for this project.',
      },
      allowedActionTypes: ['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'],
      tools,
    }, null, 2),
    schema: agentRecommendationsJsonSchema,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Agent recommendations generation failed.');
  }

  return agentRecommendationsSchema.parse(response.data);
}

const toolSelectorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['tools', 'reasoning'],
  properties: {
    tools: { type: 'array', items: { type: 'string' }, maxItems: 9 },
    reasoning: { type: 'string' },
  },
} as const;

export function selectToolsForMessage(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  availableTools: string[];
}): string[] {
  const latest = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const m = latest.toLowerCase().trim();

  // Greetings and very short messages with no project keywords → no tools
  if (/^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|sure|yes|no|got it|great|nice|cool)\.?$/.test(m)) {
    return [];
  }
  if (m.length < 25 && !/run|test|pr|risk|analysis|recorder|library|action|jira|trello|repo|integration|runtime|session/.test(m)) {
    return [];
  }

  // Always useful context for project questions
  const selected = new Set<string>(['project_profile', 'runtime_status']);

  if (/run|analysis|risk|pr|pull.?request|commit|scan|branch|code|file|churn/.test(m)) {
    selected.add('latest_analysis_run');
    selected.add('runs_summary');
    selected.add('repository_diagnostics');
  }
  if (/recorder|session|flow|step|screenshot|capture|click/.test(m)) {
    selected.add('latest_recorder_session');
  }
  if (/library|test.?case|manual|case|generated/.test(m)) {
    selected.add('library_summary');
  }
  if (/action|task|queue|pending|approve|queued/.test(m)) {
    selected.add('recent_operations');
  }
  if (/jira|trello|integration|sync|ticket|issue/.test(m)) {
    selected.add('integration_status');
  }
  if (/repo|repository|webhook|github|branch|connect/.test(m)) {
    selected.add('repository_diagnostics');
  }

  return [...selected].filter((t) => params.availableTools.includes(t));
}

export async function runHostedAgentChat(params: {
  organizationId: string;
  projectId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<HostedAgentChatReplyWithResolution> {
  const allToolNames = getAllowedToolNamesForAction('studio_agent_chat');
  const selectedToolNames = selectToolsForMessage({
    messages: params.messages,
    availableTools: allToolNames,
  });

  const tools = selectedToolNames.length > 0
    ? await Promise.all(selectedToolNames.map(async (name) => {
        const tool = getTool(name);
        const input = tool.inputSchema.parse({});
        const output = await tool.execute(input, {
          organizationId: params.organizationId,
          projectId: params.projectId,
          actionType: 'studio_agent_chat',
          cache: new Map(),
        });
        return { name: tool.name, description: tool.description, output };
      }))
    : [];

  try {
    const response = await generateStructuredWithRuntime({
      organizationId: params.organizationId,
      projectId: params.projectId,
      feature: 'agents',
      timeoutMs: 60_000,
      systemPrompt: [
      'You are the DioTest Studio agent manager.',
      'The user will ask you to inspect runs, recorder sessions, project health, recommendations, and library items.',
      'Answer directly from the provided tool outputs and conversation history.',
      'Use detailed run, recorder, and repository tools when they are present instead of staying at a summary-only level.',
      'Focus on what should be investigated next, why it matters, and what actions the user can run.',
      'The selected AI provider is authoritative. Never ask for an OpenAI key when OpenRouter is the selected and configured provider, and never ask for an OpenRouter key when OpenAI is the selected and configured provider.',
      'Only mention runtime configuration when the selected provider itself is missing a key or model.',
        'Return a short reasoningSummary that explains how you reached the answer without exposing hidden chain-of-thought.',
        'Return a toolTrace that lists each provided tool you actually relied on and why.',
        'Only suggest supported agent action types.',
        'Do not invent missing project facts, run ids, or integrations.',
      ].join(' '),
      userPrompt: JSON.stringify({
        conversation: params.messages,
        tools,
      }, null, 2),
      schema: agentChatReplyJsonSchema,
    });

    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Agent chat reply generation failed.');
    }

    const parsed = agentChatReplySchema.parse(response.data);
    return {
      ...parsed,
      toolTrace: buildAuthoritativeToolTrace(tools, parsed.toolTrace),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The agent could not respond.';
    const classified = classifyProviderError(message);
    return {
      ...classified,
      reasoningSummary: `Agent failed: ${message.slice(0, 120)}`,
      investigationAreas: ['Agent runtime health'],
      toolTrace: buildAuthoritativeToolTrace(tools),
      suggestedActions: [],
    };
  }
}

export async function runHostedAgentChatWithTools(params: {
  organizationId: string;
  projectId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: ExecutedTool[];
}): Promise<HostedAgentChatReplyWithResolution> {
  const { tools } = params;
  try {
    const response = await generateStructuredWithRuntime({
      organizationId: params.organizationId,
      projectId: params.projectId,
      feature: 'agents',
      timeoutMs: 60_000,
      systemPrompt: [
        'You are the DioTest Studio agent manager.',
        'The user will ask you to inspect runs, recorder sessions, project health, recommendations, and library items.',
        'Answer directly from the provided tool outputs and conversation history.',
        'Use detailed run, recorder, and repository tools when they are present instead of staying at a summary-only level.',
        'Focus on what should be investigated next, why it matters, and what actions the user can run.',
        'The selected AI provider is authoritative. Never ask for an OpenAI key when OpenRouter is the selected and configured provider, and never ask for an OpenRouter key when OpenAI is the selected and configured provider.',
        'Only mention runtime configuration when the selected provider itself is missing a key or model.',
        'Return a short reasoningSummary that explains how you reached the answer without exposing hidden chain-of-thought.',
        'Return a toolTrace that lists each provided tool you actually relied on and why.',
        'Only suggest supported agent action types.',
        'Do not invent missing project facts, run ids, or integrations.',
      ].join(' '),
      userPrompt: JSON.stringify({ conversation: params.messages, tools }, null, 2),
      schema: agentChatReplyJsonSchema,
    });

    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Agent chat reply generation failed.');
    }

    const parsed = agentChatReplySchema.parse(response.data);
    return {
      ...parsed,
      toolTrace: buildAuthoritativeToolTrace(tools, parsed.toolTrace),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The agent could not respond.';
    const classified = classifyProviderError(message);
    return {
      ...classified,
      reasoningSummary: `Agent failed: ${message.slice(0, 120)}`,
      investigationAreas: ['Agent runtime health'],
      toolTrace: buildAuthoritativeToolTrace(tools),
      suggestedActions: [],
    };
  }
}

export async function runHostedAgentExecution(params: {
  organizationId: string;
  projectId: string;
  goal: string;
  focus?: string;
  allowedActionTypes?: Array<'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets'>;
}): Promise<HostedAgentRun> {
  const tools = await executeToolsForAction('studio_agent_chat', {
    organizationId: params.organizationId,
    projectId: params.projectId,
    actionType: 'studio_agent_chat',
  });

  const allowedActionTypes = params.allowedActionTypes ?? ['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'];

  const response = await generateStructuredWithRuntime({
    organizationId: params.organizationId,
    projectId: params.projectId,
    feature: 'agents',
    timeoutMs: 60_000,
    systemPrompt: [
      'You are the DioTest agent execution planner.',
      'Produce a bounded plan for the given goal using only the provided tool outputs.',
      'Prefer the latest analysis run, latest recorder session, and repository diagnostics when they provide concrete evidence.',
      'Do not recursively call tools or invent hidden state.',
      'Return investigation areas, evidence, and a concrete set of proposed next actions.',
      'Only use supported action types.',
    ].join(' '),
    userPrompt: JSON.stringify({
      goal: params.goal,
      focus: params.focus ?? null,
      allowedActionTypes,
      tools,
    }, null, 2),
    schema: agentRunJsonSchema,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Agent run generation failed.');
  }

  return agentRunSchema.parse(response.data);
}

export async function runHostedRuntimeHealthCheck(params: {
  organizationId?: string;
  projectId?: string;
  provider: 'openai' | 'openrouter';
  model: string;
  scope: 'project' | 'organization' | 'system';
  apiKey: string;
}): Promise<RuntimeHealthResult> {
  const response = await generateStructured({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    timeoutMs: 30_000,
    systemPrompt: [
      'You are validating DioTest runtime configuration.',
      'Echo back the provider, model, and scope from the prompt.',
      'Return status ok and a short note only.',
    ].join(' '),
    userPrompt: JSON.stringify({
      provider: params.provider,
      model: params.model,
      scope: params.scope,
    }),
    schema: runtimeHealthJsonSchema,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Runtime health check failed.');
  }

  return runtimeHealthSchema.parse(response.data);
}
