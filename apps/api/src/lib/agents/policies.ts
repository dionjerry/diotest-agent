import type { AgentActionType, Task } from '@diotest/domain/platform/types';

export function getTaskTypeForAction(actionType: AgentActionType): Task['type'] {
  if (actionType === 'analyze_pr') return 'analysis';
  if (actionType === 'run_browser_checks') return 'run';
  if (actionType.startsWith('sync_')) return 'sync';
  if (actionType === 'export_sheets') return 'export';
  return 'generation';
}

export function canAutoExecuteAction(params: {
  approvalRequired: boolean;
}) {
  return !params.approvalRequired;
}
