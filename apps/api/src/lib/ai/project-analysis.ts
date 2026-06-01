import type { AnalyzeResult } from '@diotest/domain/analysis/types';
import { runAiAnalyze } from '@diotest/engine/analysis/orchestrator';

import { buildProjectAnalysisContext } from '../agent-tools/context-tools.js';
import { getLegacyRuntimeSettings } from './runtime.js';

export async function runHostedProjectAnalysis(params: {
  organizationId: string;
  projectId: string;
  includeDeepScan?: boolean;
}): Promise<AnalyzeResult> {
  const settings = await getLegacyRuntimeSettings({
    organizationId: params.organizationId,
    projectId: params.projectId,
  });

  return runAiAnalyze({
    rawSettings: settings,
    mode: params.includeDeepScan ? 'pr_commit_deep_scan' : 'pr_commit',
    includeDeepScan: Boolean(params.includeDeepScan),
    extractContext: async () => {
      try {
        const context = await buildProjectAnalysisContext(params.projectId);
        return { ok: true as const, context };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Failed to build project analysis context.',
        };
      }
    },
  });
}
