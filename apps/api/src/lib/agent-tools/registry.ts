import type { AgentActionType } from '@diotest/domain/platform/types';

import {
  integrationStatusTool,
  latestAnalysisRunTool,
  latestRecorderSessionTool,
  librarySummaryTool,
  projectProfileTool,
  recentOperationsTool,
  repositoryDiagnosticsTool,
  runsSummaryTool,
  runtimeStatusTool,
} from './operations-tools.js';
import type { ExecutedTool, RuntimeTool, ToolExecutionContext } from './types.js';

const tools: RuntimeTool[] = [
  projectProfileTool,
  runtimeStatusTool,
  integrationStatusTool,
  recentOperationsTool,
  librarySummaryTool,
  runsSummaryTool,
  repositoryDiagnosticsTool,
  latestAnalysisRunTool,
  latestRecorderSessionTool,
];

const toolMap = new Map(tools.map((tool) => [tool.name, tool] as const));

type ToolCollection = AgentActionType | 'studio_agent_chat';

const allowedToolsByAction: Record<ToolCollection, string[]> = {
  analyze_pr: ['project_profile', 'runtime_status', 'integration_status', 'recent_operations', 'repository_diagnostics', 'latest_analysis_run'],
  generate_tests: ['project_profile', 'runtime_status', 'integration_status', 'recent_operations', 'repository_diagnostics', 'latest_analysis_run'],
  generate_from_recorder: ['project_profile', 'runtime_status', 'recent_operations', 'latest_recorder_session'],
  run_browser_checks: ['project_profile', 'runtime_status', 'integration_status', 'recent_operations', 'repository_diagnostics', 'latest_analysis_run', 'latest_recorder_session'],
  sync_jira: ['project_profile', 'integration_status', 'recent_operations'],
  sync_trello: ['project_profile', 'integration_status', 'recent_operations'],
  export_sheets: ['project_profile', 'recent_operations'],
  studio_agent_chat: [
    'project_profile',
    'runtime_status',
    'integration_status',
    'recent_operations',
    'library_summary',
    'runs_summary',
    'repository_diagnostics',
    'latest_analysis_run',
    'latest_recorder_session',
  ],
};

export function getAllowedToolNamesForAction(actionType: ToolCollection) {
  return allowedToolsByAction[actionType] ?? [];
}

export function getTool(name: string) {
  const tool = toolMap.get(name);
  if (!tool) {
    throw new Error(`Unknown runtime tool: ${name}`);
  }
  return tool;
}

export async function executeToolsForAction(actionType: ToolCollection, context: ToolExecutionContext): Promise<ExecutedTool[]> {
  const names = getAllowedToolNamesForAction(actionType);
  const executionContext: ToolExecutionContext = {
    ...context,
    cache: context.cache ?? new Map<string, unknown>(),
  };

  return Promise.all(names.map(async (name) => {
    const tool = getTool(name);
    const input = tool.inputSchema.parse({});
    const output = await tool.execute(input, executionContext);
    return { name: tool.name, description: tool.description, output };
  }));
}

export async function* executeToolsWithProgress(
  actionType: ToolCollection,
  context: ToolExecutionContext & { toolFilter?: string[] },
): AsyncGenerator<
  | { phase: 'start'; tool: string }
  | { phase: 'done'; tool: string; executed: ExecutedTool }
> {
  const allowed = getAllowedToolNamesForAction(actionType);
  const names = context.toolFilter
    ? allowed.filter((n) => context.toolFilter!.includes(n))
    : allowed;
  const executionContext: ToolExecutionContext = {
    ...context,
    cache: context.cache ?? new Map<string, unknown>(),
  };

  // Emit start events immediately for all tools, then run them in parallel.
  for (const name of names) {
    yield { phase: 'start', tool: name };
  }

  const results = await Promise.all(names.map(async (name) => {
    const tool = getTool(name);
    const input = tool.inputSchema.parse({});
    const output = await tool.execute(input, executionContext);
    return { name: tool.name, description: tool.description, output };
  }));

  for (const executed of results) {
    yield { phase: 'done', tool: executed.name, executed };
  }
}
