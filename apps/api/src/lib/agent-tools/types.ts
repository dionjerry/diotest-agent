import { z } from 'zod';

import type { AgentActionType } from '@diotest/domain/platform/types';

export type ToolExecutionContext = {
  organizationId: string;
  projectId: string;
  actionType: AgentActionType | 'studio_agent_chat';
  cache?: Map<string, unknown>;
};

export interface RuntimeTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}

export type ExecutedTool = {
  name: string;
  description: string;
  output: unknown;
};
