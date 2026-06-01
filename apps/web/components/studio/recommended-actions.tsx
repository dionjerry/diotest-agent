'use client';

import { useActionState } from 'react';

import type { ActionState } from '@/app/actions';
import { createAgentActionAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import type { RuntimeAgentRecommendationsResponse } from '@/lib/api';

const initialState: ActionState = {};

export function RecommendedActions({
  projectId,
  summary,
  items,
}: {
  projectId: string;
  summary?: string;
  items: RuntimeAgentRecommendationsResponse['recommendations'];
}) {
  const [state, formAction] = useActionState(createAgentActionAction, initialState);

  return (
    <>
      {summary ? (
        <div className="mb-4 rounded-[4px] border border-white/6 bg-[#111216] px-4 py-3 text-sm leading-6 text-[#aeb1b7]">
          {summary}
        </div>
      ) : null}
      <div className="space-y-4">
        {items.map((item) => (
          <form key={`${item.actionType}-${item.title}`} action={formAction} className="rounded-[4px] border border-white/6 bg-[#17181d] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="type" value={item.actionType} />
            <input type="hidden" name="target" value={item.target} />
            <input type="hidden" name="title" value={item.title} />
            <input type="hidden" name="description" value={item.rationale} />
            <input type="hidden" name="readOnly" value={String(item.readOnly)} />
            <input type="hidden" name="approvalRequired" value={String(item.approvalRequired)} />
            <input type="hidden" name="inputJson" value={JSON.stringify(item.input)} />

            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-white">{item.title}</div>
              <Badge tone={item.tone}>{item.priority}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#7e8087]">{item.body}</p>
            <p className="mt-3 text-xs leading-6 text-[#62656d]">{item.rationale}</p>
            <SubmitButton
              idleLabel={item.buttonLabel}
              pendingLabel="Creating..."
              className={`mt-4 h-10 w-full rounded-[4px] text-sm font-medium ${item.tone === 'success' ? 'bg-[#111216] text-[#53dca4]' : item.tone === 'warn' ? 'bg-[#111216] text-[#ffb24a]' : item.tone === 'danger' ? 'bg-[#111216] text-[#ff8780]' : 'bg-[#111216] text-[#7e8087]'}`}
              success={!!state.success}
            />
          </form>
        ))}
      </div>
      {state.error ? (
        <div className="mt-4">
          <FormMessage>{state.error}</FormMessage>
        </div>
      ) : null}
      {state.success ? (
        <div className="mt-4">
          <FormMessage tone="success">{state.success}</FormMessage>
        </div>
      ) : null}
    </>
  );
}
