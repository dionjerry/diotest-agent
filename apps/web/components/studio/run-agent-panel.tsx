'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { ActionState } from '@/app/actions';
import { createAgentActionAction, createStudioAgentThreadAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const initialState: ActionState = {};

type SuggestedRunAction = {
  title: string;
  description: string;
  type: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
  target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
  targetId?: string;
  readOnly: boolean;
  approvalRequired: boolean;
  input: Record<string, unknown>;
};

export function RunAgentPanel({
  organizationId,
  projectId,
  prompt,
  actions,
  runtimeStatus,
}: {
  organizationId: string;
  projectId: string;
  prompt: string;
  actions: SuggestedRunAction[];
  runtimeStatus: {
    configured: boolean;
    provider: 'openai' | 'openrouter';
    model: string;
    missingKeyFor: 'openai' | 'openrouter' | null;
  } | null;
}) {
  const router = useRouter();
  const [threadState, createThreadAction] = useActionState(createStudioAgentThreadAction, initialState);
  const [actionState, createAction] = useActionState(createAgentActionAction, initialState);
  const runtimeConfigured = runtimeStatus?.configured ?? true;
  const runtimeHref = '/app/settings/runtime';

  useEffect(() => {
    if (threadState.threadId) {
      router.push(`/studio?thread=${threadState.threadId}`);
      router.refresh();
    }
  }, [router, threadState.threadId]);

  return (
    <Card className="rounded-[24px] border-white/8 bg-[#15171d]/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Agent Manager</div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Open a focused Studio thread for this run or trigger a concrete follow-up action from the current evidence.
          </p>
        </div>
        <Badge tone={runtimeConfigured ? 'brand' : 'warn'}>{runtimeConfigured ? 'Run context' : 'Needs config'}</Badge>
      </div>

      <div className={`rounded-2xl border p-4 ${runtimeConfigured ? 'border-emerald-500/15 bg-emerald-500/[0.05]' : 'border-amber-500/20 bg-amber-500/[0.05]'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Runtime status</div>
            <div className="mt-1 text-sm font-medium text-white">
              {runtimeConfigured
                ? `${runtimeStatus?.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} · ${runtimeStatus?.model || 'model not set'}`
                : `Missing ${runtimeStatus?.missingKeyFor === 'openrouter' ? 'OpenRouter' : 'OpenAI'} API key`}
            </div>
            <div className="mt-1 text-xs leading-6 text-zinc-400">
              {runtimeConfigured
                ? 'This run can be discussed in a live Studio thread.'
                : 'Discuss This Run is disabled until Runtime Settings has a valid provider key.'}
            </div>
          </div>
          {!runtimeConfigured ? (
            <Link href={runtimeHref} className="inline-flex h-8 items-center rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-400/15">
              Open Runtime Settings
            </Link>
          ) : null}
        </div>
      </div>

      <form action={createThreadAction} className="mt-4 space-y-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="content" value={prompt} />
        <SubmitButton
          idleLabel={runtimeConfigured ? 'Discuss This Run' : 'Runtime config required'}
          pendingLabel="Opening thread..."
          className="w-full rounded-xl bg-brand px-4 text-emerald-950 hover:bg-emerald-400"
          success={!!threadState.success}
          disabled={!runtimeConfigured}
        />
        {threadState.error ? <FormMessage>{threadState.error}</FormMessage> : null}
        {!runtimeConfigured ? (
          <FormMessage tone="muted">
            Save and test a valid {runtimeStatus?.missingKeyFor === 'openrouter' ? 'OpenRouter' : 'OpenAI'} key before starting a run discussion thread.
          </FormMessage>
        ) : null}
      </form>

      <div className="mt-5 space-y-3">
        {actions.map((action) => (
          <form key={`${action.type}-${action.title}`} action={createAction} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="type" value={action.type} />
            <input type="hidden" name="target" value={action.target} />
            <input type="hidden" name="targetId" value={action.targetId ?? ''} />
            <input type="hidden" name="title" value={action.title} />
            <input type="hidden" name="description" value={action.description} />
            <input type="hidden" name="readOnly" value={String(action.readOnly)} />
            <input type="hidden" name="approvalRequired" value={String(action.approvalRequired)} />
            <input type="hidden" name="inputJson" value={JSON.stringify(action.input)} />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">{action.title}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-400">{action.description}</div>
              </div>
              <Badge tone={action.approvalRequired ? 'warn' : 'brand'}>
                {action.approvalRequired ? 'Approval' : 'Direct'}
              </Badge>
            </div>

            <SubmitButton
              idleLabel={action.approvalRequired ? 'Create approval action' : 'Run action'}
              pendingLabel="Creating..."
              className="mt-4 rounded-xl bg-zinc-100 px-4 text-zinc-950 hover:bg-white"
              success={!!actionState.success}
            />
          </form>
        ))}
        {actionState.error ? <FormMessage>{actionState.error}</FormMessage> : null}
        {actionState.success ? <FormMessage tone="success">{actionState.success}</FormMessage> : null}
      </div>
    </Card>
  );
}
