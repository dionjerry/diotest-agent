import type { TaskOutput } from '@diotest/domain/platform/types';

import { runHostedBrowserChecks } from '../agents/orchestrator.js';

export async function runHostedProjectBrowserChecks(params: {
  organizationId: string;
  projectId: string;
  input?: Record<string, unknown>;
}): Promise<TaskOutput> {
  return runHostedBrowserChecks(params);
}
