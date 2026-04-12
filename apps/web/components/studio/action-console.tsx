'use client';

import { useActionState, useMemo, useState } from 'react';

import type { ActionState } from '@/app/actions';
import { approveAgentActionAction, createAgentActionAction } from '@/app/actions';
import type { ActionsResponse } from '@/lib/api';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const initialState: ActionState = {};

function toneForStatus(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'awaiting_approval':
      return 'warn' as const;
    case 'failed':
      return 'danger' as const;
    default:
      return 'neutral' as const;
  }
}

export function ActionConsole({
  projectId,
  actions,
  tasks,
}: {
  projectId: string;
  actions: ActionsResponse['actions'];
  tasks: ActionsResponse['tasks'];
}) {
  const [createState, createAction] = useActionState(createAgentActionAction, initialState);
  const [approveState, approveAction] = useActionState(approveAgentActionAction, initialState);
  const [actionType, setActionType] = useState<'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets'>('analyze_pr');
  const [integrationMode, setIntegrationMode] = useState<'create' | 'status_check'>('create');
  const generatedInputJson = useMemo(() => {
    if (actionType === 'sync_jira') {
      return JSON.stringify({
        mode: integrationMode,
        ...(integrationMode === 'status_check' ? { issueKey: '' } : { title: '', description: '', labels: [] }),
      });
    }

    if (actionType === 'sync_trello') {
      return JSON.stringify({
        mode: integrationMode,
        ...(integrationMode === 'status_check' ? { cardId: '' } : { title: '', description: '' }),
      });
    }

    if (actionType === 'export_sheets') {
      return JSON.stringify({
        mode: 'tickets_table',
        rows: [],
      });
    }

    return '{"riskLevel":"high","source":"studio"}';
  }, [actionType, integrationMode]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <div className="grid gap-5">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-soft">Agent actions</div>
              <h2 className="mt-3 text-xl font-semibold text-text">Create the next testing action</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Read-only actions can complete immediately. Anything mutating or external stays approve-first and lands in the task queue.
              </p>
            </div>
            <Badge tone="brand">Typed workflow</Badge>
          </div>
          <form action={createAction} className="mt-6 space-y-5">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label>Action type</Label>
                <select
                  name="type"
                  defaultValue="analyze_pr"
                  onChange={(event) => {
                    const nextType = event.target.value as typeof actionType;
                    setActionType(nextType);
                    if (nextType === 'export_sheets') {
                      setIntegrationMode('create');
                    }
                  }}
                  className="h-11 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
                >
                  <option value="analyze_pr">Analyze PR</option>
                  <option value="generate_tests">Generate tests</option>
                  <option value="generate_from_recorder">Generate from recorder</option>
                  <option value="run_browser_checks">Run browser checks</option>
                  <option value="sync_jira">Sync to Jira</option>
                  <option value="sync_trello">Sync to Trello</option>
                  <option value="export_sheets">Export to Sheets</option>
                </select>
              </div>
              <div>
                <Label>Target</Label>
                <select
                  name="target"
                  defaultValue="project"
                  className="h-11 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
                >
                  <option value="project">Project</option>
                  <option value="pr">PR</option>
                  <option value="recorder_session">Recorder session</option>
                  <option value="test_case">Test case</option>
                  <option value="run">Run</option>
                </select>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <Label>Title</Label>
                <Input name="title" defaultValue="Analyze checkout PR" placeholder="Short action title" />
              </div>
              <div>
                <Label>Target ID</Label>
                <Input name="targetId" placeholder="Optional id like PR-47" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea name="description" placeholder="Explain what the agent should do and why." className="min-h-24" />
            </div>
            {(actionType === 'sync_jira' || actionType === 'sync_trello') ? (
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <Label>Mode</Label>
                  <select
                    name="mode"
                    value={integrationMode}
                    onChange={(event) => setIntegrationMode(event.target.value as 'create' | 'status_check')}
                    className="h-11 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
                  >
                    <option value="create">Create</option>
                    <option value="status_check">Status check</option>
                  </select>
                </div>
                {actionType === 'sync_jira' && integrationMode === 'status_check' ? (
                  <div>
                    <Label>Issue key</Label>
                    <Input name="integrationId" placeholder="DIO-123" />
                  </div>
                ) : null}
                {actionType === 'sync_trello' && integrationMode === 'status_check' ? (
                  <div>
                    <Label>Card ID</Label>
                    <Input name="integrationId" placeholder="Trello card id" />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <Label>Input JSON</Label>
              <Textarea
                name="inputJson"
                className="min-h-32 font-mono text-xs"
                value={generatedInputJson}
                onChange={() => undefined}
                readOnly
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200">
                <input type="checkbox" name="readOnly" defaultChecked className="h-4 w-4 accent-emerald-500" />
                Read-only action
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200">
                <input type="checkbox" name="approvalRequired" className="h-4 w-4 accent-emerald-500" />
                Require approval before execution
              </label>
            </div>
            <FormMessage tone="success">{createState.success}</FormMessage>
            <FormMessage>{createState.error}</FormMessage>
            <SubmitButton idleLabel="Create action" pendingLabel="Creating action..." />
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-soft">Action queue</div>
              <h2 className="mt-3 text-xl font-semibold text-text">Review and approve</h2>
            </div>
            <Badge>{actions.length} total</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {actions.length > 0 ? (
              actions.map((action) => (
                <div key={action.id} className="rounded-3xl border border-line bg-zinc-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text">{action.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-soft">{action.type.replaceAll('_', ' ')} · {action.target}</div>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{action.description}</p>
                    </div>
                    <Badge tone={toneForStatus(action.status)}>{action.status.replaceAll('_', ' ')}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-soft">
                    <span>{action.readOnly ? 'Read only' : 'Mutating/external'}</span>
                    <span>•</span>
                    <span>{action.approvalRequired ? 'Approve first' : 'Can execute directly'}</span>
                  </div>
                  {action.result ? (
                    <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-emerald-100">
                      {(action.result.summary as string | undefined) ?? 'Completed'}
                    </div>
                  ) : null}
                  {action.status === 'awaiting_approval' ? (
                    <form action={approveAction} className="mt-4">
                      <input type="hidden" name="actionId" value={action.id} />
                      <SubmitButton idleLabel="Approve action" pendingLabel="Approving..." />
                    </form>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-line bg-zinc-950/30 px-4 py-6 text-sm text-muted">
                No actions created yet. Seed one from the form above or let webhook-driven analysis create them later.
              </div>
            )}
          </div>
          <FormMessage tone="success">{approveState.success}</FormMessage>
          <FormMessage>{approveState.error}</FormMessage>
        </Card>
      </div>

      <Card className="h-fit p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-soft">Task queue</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Execution state</h2>
        <div className="mt-6 space-y-3">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-line bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-text">{task.title}</div>
                  <Badge tone={toneForStatus(task.status)}>{task.status}</Badge>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-soft">{task.type}</div>
                {task.output?.summary ? <p className="mt-3 text-sm leading-6 text-muted">{task.output.summary}</p> : null}
                {task.error ? <p className="mt-3 text-sm text-rose-200">{task.error}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-zinc-950/30 px-4 py-6 text-sm text-muted">
              No queued tasks yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
