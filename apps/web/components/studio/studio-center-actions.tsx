'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ActionState } from '@/app/actions';
import { createAgentActionAction } from '@/app/actions';
import { SubmitButton } from '@/components/forms/submit-button';
import { FormMessage } from '@/components/forms/form-message';

const initialState: ActionState = {};

// ── Rescan PR ─────────────────────────────────────────────────────────────────

export function RescanPRButton({
  projectId,
  repo,
  analysisRef,
  pageType,
  sessionId,
}: {
  projectId: string;
  repo: string;
  analysisRef: string;
  pageType: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createAgentActionAction, initialState);

  if (state.success) {
    router.refresh();
  }

  const isPr = pageType === 'pull_request';
  const inputJson = JSON.stringify({
    repo,
    ref: analysisRef,
    prNumber: isPr ? analysisRef : undefined,
    previousSessionId: sessionId,
    deepScan: true,
  });

  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="type" value="analyze_pr" />
      <input type="hidden" name="target" value="pr" />
      <input type="hidden" name="title" value={`Re-analyze ${isPr ? `PR #${analysisRef}` : analysisRef.slice(0, 8)}`} />
      <input type="hidden" name="description" value={`Re-run full analysis on ${repo} ${isPr ? `PR #${analysisRef}` : `commit ${analysisRef.slice(0, 8)}`} with deep scan.`} />
      <input type="hidden" name="readOnly" value="true" />
      <input type="hidden" name="approvalRequired" value="false" />
      <input type="hidden" name="inputJson" value={inputJson} />
      <SubmitButton
        idleLabel="Rescan PR"
        pendingLabel="Scanning..."
        className="h-11 rounded-[4px] border border-white/8 bg-[#17181d] px-5 text-sm text-white hover:bg-[#1f2026] transition"
        success={!!state.success}
      />
      {state.error ? (
        <div className="mt-1 text-xs">
          <FormMessage>{state.error}</FormMessage>
        </div>
      ) : null}
    </form>
  );
}

// ── Apply Recommendations Modal ────────────────────────────────────────────────

type SuggestedAction = {
  title: string;
  body: string;
  buttonLabel: string;
  actionType: string;
  target: string;
  priority: string;
  tone: string;
  readOnly: boolean;
  approvalRequired: boolean;
  rationale: string;
  input: Record<string, unknown>;
};

export function ApplyRecommendationsButton({
  projectId,
  recommendations,
}: {
  projectId: string;
  recommendations: SuggestedAction[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(recommendations.map((_, i) => i)));
  const [state, action] = useActionState(createAgentActionAction, initialState);
  const [submitted, setSubmitted] = useState(false);

  if (!recommendations.length) return null;

  const toneClass = (tone: string) => {
    if (tone === 'success') return 'text-[#53dca4]';
    if (tone === 'warn') return 'text-[#ffb24a]';
    if (tone === 'danger') return 'text-[#ff8780]';
    return 'text-[#9a9da5]';
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-[4px] bg-[#53dca4] px-5 text-sm font-semibold text-[#103223] hover:bg-[#4bc99a] transition"
      >
        Apply Recommendations
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-[8px] border border-white/10 bg-[#141519] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/6 px-6 py-4">
            <div>
              <div className="text-lg font-semibold text-white">Apply Recommendations</div>
              <div className="mt-1 text-xs text-[#8b8d94]">Select the actions to create. Each becomes an agent action in the queue.</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#8b8d94] hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {recommendations.map((rec, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-[4px] border p-4 transition ${selected.has(i) ? 'border-[#53dca4]/30 bg-[#1f2c25]' : 'border-white/6 bg-[#17181d] hover:bg-[#1b1c22]'}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-[#53dca4]"
                  checked={selected.has(i)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i); else next.delete(i);
                    setSelected(next);
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{rec.title}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${toneClass(rec.tone)}`}>{rec.priority}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#7e8087]">{rec.body}</div>
                  <div className="mt-1 text-[10px] text-[#666870]">{rec.rationale}</div>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-[3px] bg-[#111216] px-2 py-0.5 text-[10px] font-mono text-[#8b8d94]">{rec.actionType}</span>
                    {rec.approvalRequired && <span className="rounded-[3px] bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">Requires approval</span>}
                    {rec.readOnly && <span className="rounded-[3px] bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Read-only</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {submitted ? (
            <div className="border-t border-white/6 px-6 py-4">
              <div className="text-sm text-[#53dca4]">✓ {selected.size} action{selected.size !== 1 ? 's' : ''} queued successfully</div>
              <button onClick={() => setOpen(false)} className="mt-3 text-xs text-[#8b8d94] underline">Close</button>
            </div>
          ) : (
            <div className="border-t border-white/6 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-[#8b8d94]">{selected.size} of {recommendations.length} selected</span>
                <div className="flex gap-3">
                  <button onClick={() => setOpen(false)} className="h-9 rounded-[4px] border border-white/8 px-4 text-sm text-[#8b8d94] hover:text-white transition">
                    Cancel
                  </button>
                  {/* Submit one form per selected action */}
                  <button
                    type="button"
                    disabled={selected.size === 0}
                    onClick={async () => {
                      for (const i of selected) {
                        const rec = recommendations[i];
                        if (!rec) continue;
                        const fd = new FormData();
                        fd.set('projectId', projectId);
                        fd.set('type', rec.actionType);
                        fd.set('target', rec.target);
                        fd.set('title', rec.title);
                        fd.set('description', rec.body);
                        fd.set('readOnly', String(rec.readOnly));
                        fd.set('approvalRequired', String(rec.approvalRequired));
                        fd.set('inputJson', JSON.stringify(rec.input));
                        await action(fd);
                      }
                      setSubmitted(true);
                    }}
                    className="h-9 rounded-[4px] bg-[#53dca4] px-4 text-sm font-semibold text-[#103223] hover:bg-[#4bc99a] transition disabled:opacity-50"
                  >
                    Apply {selected.size} Action{selected.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
              {state.error ? (
                <div className="mt-2 text-xs">
                  <FormMessage>{state.error}</FormMessage>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
