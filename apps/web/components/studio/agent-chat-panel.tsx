'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { ActionState } from '@/app/actions';
import { createAgentActionAction, createStudioAgentThreadAction, runStudioAgentPlanAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AgentThreadDetail, AgentThreadSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

const initialState: ActionState = {};

type AgentPlanResult = {
  summary: string;
  plan: string[];
  investigationAreas: string[];
  evidence: Array<{ tool: string; takeaway: string }>;
  proposedActions: Array<{
    title: string;
    description: string;
    actionType: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
    target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
    readOnly: boolean;
    approvalRequired: boolean;
    input: Record<string, unknown>;
  }>;
};

type ToolTraceItem = { tool: string; status: 'used'; note: string };

type OptimisticMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  thinkingSeconds?: number;
};

type AssistantMeta = {
  reasoningSummary?: string;
  toolTrace?: ToolTraceItem[];
  suggestedActions?: SuggestedAgentAction[];
  investigationAreas?: string[];
  requiresRuntimeConfig?: boolean;
  resolutionHref?: string | null;
  resolutionLabel?: string | null;
} | null;

type SuggestedAgentAction = {
  title: string;
  description: string;
  actionType: 'analyze_pr' | 'generate_tests' | 'generate_from_recorder' | 'run_browser_checks' | 'sync_jira' | 'sync_trello' | 'export_sheets';
  target: 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';
  readOnly: boolean;
  approvalRequired: boolean;
  input: Record<string, unknown>;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function buildThreadHref(pathname: string, searchParams: URLSearchParams, threadId: string) {
  const next = new URLSearchParams(searchParams.toString());
  next.set('thread', threadId);
  return `${pathname}?${next.toString()}`;
}

function detectRuntimeConfigRequirement(meta: AssistantMeta, content: string) {
  return Boolean(
    meta?.requiresRuntimeConfig
    || meta?.resolutionHref === '/app/settings/runtime'
    || /runtime configuration is incomplete|valid provider key in Runtime Settings|no ai runtime configuration/i.test(content),
  );
}

// ── Thread card ───────────────────────────────────────────────────────────────

function ThreadCard({ href, active, title, updatedAt }: {
  href: string; active: boolean; title: string; preview: string; updatedAt: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between gap-3 rounded-[8px] border px-3.5 py-2.5 transition-all duration-150',
        active
          ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
          : 'border-transparent hover:border-white/[0.07] hover:bg-white/[0.03]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full transition-all', active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-zinc-700 group-hover:bg-zinc-500')} />
        <div className={cn('truncate text-[13px] font-medium leading-snug', active ? 'text-emerald-100' : 'text-zinc-300 group-hover:text-white')}>
          {title}
        </div>
      </div>
      <div className="flex-shrink-0 text-[11px] text-zinc-600 group-hover:text-zinc-500">{formatTime(updatedAt)}</div>
    </Link>
  );
}

// ── Tool trace bubble ─────────────────────────────────────────────────────────

function ToolTraceLine({ tool, note, index }: { tool: string; note: string; index: number }) {
  return (
    <div className="flex items-start gap-3 rounded-[4px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-300">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">{tool.replaceAll('_', ' ')}</div>
        <div className="mt-0.5 text-[12px] leading-[1.5] text-zinc-300">{note}</div>
      </div>
      <span className="mt-0.5 flex-shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">used</span>
    </div>
  );
}

// ── Thinking / streaming bubble ───────────────────────────────────────────────

function ThinkingBubble({ traces = [], phase = 'thinking' }: { traces?: ToolTraceItem[]; phase?: 'thinking' | 'generating' }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-[6px] border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border border-emerald-400/15 bg-emerald-500/10 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
          AI
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
              {phase === 'generating' ? 'Generating' : 'Thinking'}
            </span>
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="inline-block h-1 w-1 rounded-full bg-emerald-400/70"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-zinc-600">{elapsed}s</span>
          </div>
          {traces.length > 0 ? (
            <div className="space-y-1">
              {traces.map((trace, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] py-0.5">
                  <span className="text-emerald-500 text-[10px]">✓</span>
                  <span className="text-zinc-400">{trace.tool.replaceAll('_', ' ')}</span>
                </div>
              ))}
              {phase === 'generating' && (
                <div className="flex items-center gap-2 text-[12px] py-0.5 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-zinc-400">generating reply…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-zinc-500">
              {phase === 'generating' ? 'Generating reply…' : 'Reading your message…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ role, content, meta, createdAt, thinkingSeconds }: {
  role: 'user' | 'assistant';
  content: string;
  meta: AssistantMeta;
  createdAt: string;
  thinkingSeconds?: number;
}) {
  const [traceOpen, setTraceOpen] = useState(false);
  const isAssistant = role === 'assistant';
  const trace = meta?.toolTrace ?? [];

  return (
    <div className={cn('rounded-[6px] border p-4', isAssistant ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]')}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold uppercase tracking-wider',
          isAssistant ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/15' : 'bg-white/[0.05] text-zinc-300 border border-white/[0.08]',
        )}>
          {isAssistant ? 'AI' : 'You'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
              isAssistant ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-white/8 bg-white/[0.04] text-zinc-300',
            )}>
              {isAssistant ? 'Agent' : 'You'}
            </span>
            <span className="text-[11px] text-zinc-600">{formatTime(createdAt)}</span>
          </div>
          <div className={cn('whitespace-pre-wrap text-[13px] leading-[1.75]', isAssistant ? 'text-zinc-100' : 'text-zinc-200')}>
            {content}
          </div>
          {isAssistant && (trace.length > 0 || thinkingSeconds) && (
            <div className="mt-3 border-t border-white/[0.04] pt-2.5">
              <button
                type="button"
                onClick={() => setTraceOpen((v) => !v)}
                className="flex items-center gap-2 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <span className="text-emerald-500/60">◈</span>
                {thinkingSeconds
                  ? `Thought for ${thinkingSeconds}s`
                  : `${trace.length} tool call${trace.length !== 1 ? 's' : ''}`}
                {trace.length > 0 && <span className="text-zinc-700">{traceOpen ? '▲' : '▼'}</span>}
              </button>
              {traceOpen && trace.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {trace.map((item, i) => (
                    <ToolTraceLine key={`${item.tool}-${i}`} tool={item.tool} note={item.note} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ action, projectId }: {
  action: SuggestedAgentAction;
  projectId: string;
}) {
  const [state, formAction] = useActionState(createAgentActionAction, initialState);
  return (
    <form action={formAction} className="rounded-[6px] border border-white/[0.06] bg-white/[0.02] p-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="type" value={action.actionType} />
      <input type="hidden" name="target" value={action.target} />
      <input type="hidden" name="title" value={action.title} />
      <input type="hidden" name="description" value={action.description} />
      <input type="hidden" name="readOnly" value={String(action.readOnly)} />
      <input type="hidden" name="approvalRequired" value={String(action.approvalRequired)} />
      <input type="hidden" name="inputJson" value={JSON.stringify(action.input)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-white">{action.title}</div>
          <div className="mt-1 text-[12px] leading-[1.5] text-zinc-400">{action.description}</div>
        </div>
        <Badge tone={action.approvalRequired ? 'warn' : 'brand'}>{action.approvalRequired ? 'Approval' : 'Direct'}</Badge>
      </div>
      <SubmitButton
        idleLabel={action.approvalRequired ? 'Create Approval Action' : 'Run Action'}
        pendingLabel="Creating..."
        className="mt-3 h-8 rounded-[4px] bg-zinc-100 px-3 text-xs text-zinc-950 hover:bg-white"
        success={!!state.success}
      />
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}

// ── Plan proposed action ──────────────────────────────────────────────────────

function PlanActionCard({ action, projectId }: {
  action: AgentPlanResult['proposedActions'][0];
  projectId: string;
}) {
  const [state, formAction] = useActionState(createAgentActionAction, initialState);
  return (
    <form action={formAction} className="rounded-[4px] border border-white/[0.05] bg-white/[0.02] p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="type" value={action.actionType} />
      <input type="hidden" name="target" value={action.target} />
      <input type="hidden" name="title" value={action.title} />
      <input type="hidden" name="description" value={action.description} />
      <input type="hidden" name="readOnly" value={String(action.readOnly)} />
      <input type="hidden" name="approvalRequired" value={String(action.approvalRequired)} />
      <input type="hidden" name="inputJson" value={JSON.stringify(action.input)} />
      <div className="text-[12px] font-medium text-white">{action.title}</div>
      <div className="mt-1 text-[11px] text-zinc-400">{action.description}</div>
      <SubmitButton
        idleLabel={action.approvalRequired ? 'Create Approval Action' : 'Run Action'}
        pendingLabel="Creating..."
        className="mt-2 h-7 rounded-[3px] bg-zinc-100 px-3 text-[11px] text-zinc-950 hover:bg-white"
        success={!!state.success}
      />
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentChatPanel({
  organizationId,
  projectId,
  threads,
  activeThread,
  runtimeStatus,
}: {
  organizationId: string;
  projectId: string;
  threads: AgentThreadSummary[];
  activeThread: AgentThreadDetail | null;
  runtimeStatus: {
    configured: boolean;
    provider: 'openai' | 'openrouter';
    model: string;
    missingKeyFor: 'openai' | 'openrouter' | null;
  } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const [planState] = useActionState(runStudioAgentPlanAction, initialState);
  const [newThreadDraft, setNewThreadDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [pendingReplyContent, setPendingReplyContent] = useState<string | null>(null);
  const [streamingTools, setStreamingTools] = useState<ToolTraceItem[]>([]);
  const [visibleStreamingTools, setVisibleStreamingTools] = useState<ToolTraceItem[]>([]);
  const [streamPhase, setStreamPhase] = useState<'thinking' | 'generating'>('thinking');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isNewThreadMode, setIsNewThreadMode] = useState(false);
  const [threadDropdownOpen, setThreadDropdownOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const streamStartRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const sendStreamingMessage = useCallback(async (threadId: string, content: string) => {
    setIsStreaming(true);
    setStreamingTools([]);
    setVisibleStreamingTools([]);
    setStreamPhase('thinking');
    setStreamError(null);
    setPendingReplyContent(content);
    streamStartRef.current = Date.now();

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, organizationId, projectId, content }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream request failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; tool?: string; message?: OptimisticMessage; threadId?: string };
            if (event.type === 'tool_done' && event.tool) {
              setStreamingTools((prev) => [...prev, { tool: event.tool!, status: 'used', note: '' }]);
            }
            if (event.type === 'generating') {
              setStreamPhase('generating');
            }
            if (event.type === 'error') {
              setStreamError((event as { message?: string }).message ?? 'Stream error.');
            }
            if (event.type === 'complete') {
              const thinkingSecs = Math.round((Date.now() - streamStartRef.current) / 1000);
              // Instantly show user message + AI reply from SSE data (no wait for router.refresh)
              const userMsg: OptimisticMessage = { id: `opt-user-${Date.now()}`, role: 'user', content: content, meta: null, createdAt: new Date().toISOString() };
              const msgs: OptimisticMessage[] = [userMsg];
              if (event.message) msgs.push({ ...event.message, thinkingSeconds: thinkingSecs });
              setOptimisticMessages((prev) => [...prev, ...msgs]);
              setPendingReplyContent(null);
              setStreamingTools([]);
              setStreamPhase('thinking');
              // Refresh in background to sync — once done, optimistic messages are replaced
              router.push(buildThreadHref(pathname, new URLSearchParams(searchParams.toString()), threadId));
              router.refresh();
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Failed to stream reply.');
      setPendingReplyContent(null);
    } finally {
      setIsStreaming(false);
    }
  }, [organizationId, projectId, pathname, router, searchParams]);

  const createStreamingThread = useCallback(async (content: string) => {
    if (!content.trim() || isCreatingThread) return;
    setIsCreatingThread(true);
    setStreamingTools([]);
    setVisibleStreamingTools([]);
    setStreamError(null);
    setPendingReplyContent(content);
    setNewThreadDraft('');

    try {
      const response = await fetch('/api/agent/thread-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, projectId, content }),
      });

      if (!response.ok || !response.body) throw new Error('Thread stream failed.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; tool?: string; threadId?: string; message?: string };
            if (event.type === 'tool_done' && event.tool) {
              setStreamingTools((prev) => [...prev, { tool: event.tool!, status: 'used', note: '' }]);
            }
            if (event.type === 'error') {
              setStreamError(event.message ?? 'Stream error.');
            }
            if (event.type === 'complete' && event.threadId) {
              setPendingReplyContent(null);
              setStreamingTools([]);
              router.push(buildThreadHref(pathname, new URLSearchParams(searchParams.toString()), event.threadId));
              router.refresh();
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Failed to create thread.');
      setPendingReplyContent(null);
    } finally {
      setIsCreatingThread(false);
    }
  }, [organizationId, projectId, pathname, router, searchParams, isCreatingThread]);

  const latestAssistantMsg = useMemo(
    () => [...(activeThread?.messages ?? [])].reverse().find((m) => m.role === 'assistant'),
    [activeThread],
  );
  const latestAssistantMeta = (latestAssistantMsg?.meta ?? null) as AssistantMeta;
  const latestAssistantContent = latestAssistantMsg?.content ?? '';

  const planResult = useMemo(() => {
    if (!planState.resultJson) return null;
    try { return JSON.parse(planState.resultJson) as AgentPlanResult; } catch { return null; }
  }, [planState.resultJson]);

  useEffect(() => {
    setReplyDraft('');
    setPendingReplyContent(null);
    setStreamingTools([]);
    setVisibleStreamingTools([]);
    setStreamPhase('thinking');
    setStreamError(null);
    setIsNewThreadMode(false);
    setOptimisticMessages([]);
  }, [activeThread?.id]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.id, activeThread?.messages.length]);

  // Stagger streaming tools — reveal one every 120ms for a live feel
  useEffect(() => {
    if (streamingTools.length === 0) { setVisibleStreamingTools([]); return; }
    const next = streamingTools[visibleStreamingTools.length];
    if (!next) return;
    const t = setTimeout(() => setVisibleStreamingTools((v) => [...v, next]), 120);
    return () => clearTimeout(t);
  }, [streamingTools, visibleStreamingTools]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setThreadDropdownOpen(false);
      }
    }
    if (threadDropdownOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [threadDropdownOpen]);

  const runtimeConfigured = runtimeStatus?.configured ?? true;
  const historicalRuntimeIssue = runtimeConfigured && detectRuntimeConfigRequirement(latestAssistantMeta, latestAssistantContent);
  const needsRuntimeConfig = !runtimeConfigured;
  const runtimeHref = latestAssistantMeta?.resolutionHref ?? '/app/settings/runtime';
  const runtimeLabel = latestAssistantMeta?.resolutionLabel ?? 'Open Runtime Settings';
  const suggestedActions = latestAssistantMeta?.suggestedActions ?? [];
  const showLatestAssistantDiagnostics = !historicalRuntimeIssue;
  const quickPrompts = [
    'Inspect the latest analysis run and tell me what to verify next.',
    'Review the latest recorder session and surface the highest-risk missing cases.',
    'Summarize queued actions and tell me what should be approved first.',
  ];
  const runtimeTone = runtimeConfigured ? 'success' : 'warn';
  const runtimeSummary = runtimeConfigured
    ? `${runtimeStatus?.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} · ${runtimeStatus?.model || 'model not set'}`
    : `Missing ${runtimeStatus?.missingKeyFor === 'openrouter' ? 'OpenRouter' : 'OpenAI'} API key`;
  const threadCreationBlocked = needsRuntimeConfig;
  const threadReplyBlocked = needsRuntimeConfig;
  const showConversationTools = !needsRuntimeConfig;

  const activeThreadTitle = isNewThreadMode ? 'New thread' : (activeThread?.title ?? 'Agent Manager');

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col overflow-hidden bg-[#0c0d11] border-l border-white/[0.06]">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-white/[0.06] bg-[#0e1015]/80 px-3 h-12">
        {/* Thread name / dropdown trigger */}
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setThreadDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 max-w-full rounded-[6px] px-2 py-1 hover:bg-white/[0.04] transition group"
          >
            <span className="truncate text-[13px] font-semibold text-white">{activeThreadTitle}</span>
            <span className="material-symbols-outlined flex-shrink-0 text-[14px] text-zinc-500 group-hover:text-zinc-300 transition">
              {threadDropdownOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {threadDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-[10px] border border-white/[0.08] bg-[#131418] shadow-2xl">
              <div className="max-h-[300px] overflow-y-auto p-1.5">
                {threads.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[12px] text-zinc-600">No threads yet</div>
                ) : threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={buildThreadHref(pathname, new URLSearchParams(searchParams.toString()), thread.id)}
                    onClick={() => { setThreadDropdownOpen(false); setIsNewThreadMode(false); }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[7px] px-3 py-2.5 transition',
                      thread.id === activeThread?.id && !isNewThreadMode
                        ? 'bg-emerald-500/[0.08] text-emerald-100'
                        : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', thread.id === activeThread?.id && !isNewThreadMode ? 'bg-emerald-400' : 'bg-zinc-700')} />
                    <span className="flex-1 truncate text-[13px]">{thread.title}</span>
                    <span className="flex-shrink-0 text-[11px] text-zinc-600">{formatTime(thread.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Runtime indicator */}
        {runtimeConfigured ? (
          <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
            Live
          </span>
        ) : (
          <Link href={runtimeHref} className="flex-shrink-0 flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Config
          </Link>
        )}

        {/* + New thread */}
        <button
          type="button"
          disabled={threadCreationBlocked}
          onClick={() => { setIsNewThreadMode(true); setThreadDropdownOpen(false); setNewThreadDraft(''); }}
          className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-[6px] text-zinc-400 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          title="New thread"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>

      {/* Conversation area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isNewThreadMode ? (
          /* ── New thread: centered input ─────────────────── */
          <div className="flex h-full flex-col items-center justify-center px-6">
            <div className="w-full max-w-md space-y-3">
              {isCreatingThread ? (
                <>
                  <MessageBubble role="user" content={pendingReplyContent ?? ''} meta={null} createdAt={new Date().toISOString()} />
                  <ThinkingBubble traces={visibleStreamingTools} phase={streamPhase} />
                </>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/10">
                      <span className="material-symbols-outlined text-[18px] text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                    </div>
                    <div className="text-[13px] font-medium text-zinc-300">New thread</div>
                  </div>
                  <Textarea
                    value={newThreadDraft}
                    onChange={(e) => setNewThreadDraft(e.currentTarget.value)}
                    placeholder={quickPrompts[0]}
                    className="min-h-[88px] resize-none rounded-[10px] border-white/[0.07] bg-white/[0.03] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && newThreadDraft.trim()) {
                        e.preventDefault();
                        void createStreamingThread(newThreadDraft);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={!newThreadDraft.trim()}
                      onClick={() => void createStreamingThread(newThreadDraft)}
                      className="h-9 rounded-[8px] bg-emerald-500 px-4 text-[13px] font-semibold text-emerald-950 hover:bg-emerald-400 transition disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewThreadMode(false)}
                      className="h-9 rounded-[8px] px-3 text-[12px] text-zinc-500 hover:text-zinc-300 transition"
                    >
                      Cancel
                    </button>
                    {streamError ? <span className="text-[12px] text-red-400">{streamError}</span> : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : !activeThread ? (
          /* ── No thread selected ─────────────────────────── */
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/10">
                <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="text-[14px] font-medium text-zinc-300">No thread selected</div>
              <p className="mx-auto mt-2 max-w-[24ch] text-[12px] leading-[1.6] text-zinc-600">
                Press <span className="text-zinc-400">+</span> to start a new investigation or pick a thread above.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {/* Thread title */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-3">
              <div className="truncate text-[13px] font-semibold text-white">{activeThread.title}</div>
              <Badge tone={needsRuntimeConfig ? 'warn' : 'success'}>
                {needsRuntimeConfig ? 'Config needed' : 'Ready'}
              </Badge>
            </div>

            {/* Messages — server + optimistic (shown instantly on complete, replaced when refresh lands) */}
            {activeThread.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                meta={(msg.meta ?? null) as AssistantMeta}
                createdAt={msg.createdAt}
              />
            ))}
            {optimisticMessages
              .filter((om) => !activeThread.messages.some((m) => m.id === om.id))
              .map((om) => (
                <MessageBubble
                  key={`opt-${om.id}`}
                  role={om.role}
                  content={om.content}
                  meta={(om.meta ?? null) as AssistantMeta}
                  createdAt={om.createdAt}
                  thinkingSeconds={om.thinkingSeconds}
                />
              ))}

            {pendingReplyContent ? (
              <>
                <MessageBubble
                  role="user"
                  content={pendingReplyContent}
                  meta={null}
                  createdAt={new Date().toISOString()}
                />
                <ThinkingBubble traces={visibleStreamingTools} phase={streamPhase} />
              </>
            ) : null}

            {/* Runtime config CTA */}
            {needsRuntimeConfig && (
              <div className="rounded-[10px] border border-amber-500/20 bg-amber-500/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-amber-100">Agent paused until runtime is configured</div>
                    <p className="mt-1 text-[12px] leading-[1.6] text-amber-200/70">
                      The thread history is still visible, but new agent replies and planning are disabled until a valid provider key is saved for the selected runtime scope.
                    </p>
                  </div>
                  <Link href={runtimeHref} className="inline-flex h-8 items-center rounded-[6px] border border-amber-400/20 bg-amber-400/10 px-3 text-[12px] font-medium text-amber-100 hover:bg-amber-400/15 transition">
                    {runtimeLabel}
                  </Link>
                </div>
              </div>
            )}

            {historicalRuntimeIssue && (
              <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.15em] text-emerald-200">Runtime restored</div>
                <div className="mt-1 text-[13px] leading-[1.7] text-emerald-100/80">
                  Earlier replies in this thread were blocked by missing runtime configuration. The saved runtime is available now, so you can continue this conversation.
                </div>
              </div>
            )}

            {/* Investigation areas */}
            {showLatestAssistantDiagnostics && latestAssistantMeta?.investigationAreas?.length && !pendingReplyContent ? (
              <div className="flex flex-wrap gap-1.5 px-1">
                {latestAssistantMeta.investigationAreas.map((area) => (
                  <span key={area} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-500">
                    {area}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Suggested actions — fade out when user is actively replying */}
            {showLatestAssistantDiagnostics && suggestedActions.length > 0 && !pendingReplyContent && (
              <div className={cn('space-y-2 transition-opacity duration-300', pendingReplyContent ? 'opacity-0' : 'opacity-100')}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-600">Suggested</div>
                {suggestedActions.map((action, i) => (
                  <SuggestionCard key={`${action.actionType}-${i}`} action={action} projectId={projectId} />
                ))}
              </div>
            )}

            {/* Execution plan — only appears when AI returns a plan result */}
            {planResult && showConversationTools && showLatestAssistantDiagnostics && (
              <div className="space-y-3 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Execution Plan</div>
                <div className="rounded-[4px] border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 text-[13px] leading-[1.7] text-zinc-100">
                  {planResult.summary}
                </div>
                <div className="space-y-1.5">
                  {planResult.plan.map((step, i) => (
                    <div key={i} className="flex gap-3 rounded-[4px] border border-white/[0.05] bg-white/[0.02] p-3 text-[12px] text-zinc-200">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-300">{i + 1}</div>
                      <div className="leading-[1.6]">{step}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  {planResult.proposedActions.slice(0, 3).map((action, i) => (
                    <PlanActionCard key={`${action.actionType}-${i}`} action={action} projectId={projectId} />
                  ))}
                </div>
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>
        )}
      </div>

      {/* Reply in thread */}
      {activeThread && !isNewThreadMode && (
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0e1015]/80 px-4 py-4">
          {threadReplyBlocked ? (
            <div className="space-y-3">
              <div className="rounded-[10px] border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.15em] text-amber-200">Replies paused</div>
                <div className="mt-1 text-[13px] leading-[1.7] text-amber-100/80">
                  This thread cannot continue until a valid {runtimeStatus?.missingKeyFor === 'openrouter' ? 'OpenRouter' : 'OpenAI'} key is saved and tested in Runtime Settings.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" className="h-9 rounded-[8px]" onClick={() => router.push(runtimeHref)}>
                  <span>{runtimeLabel}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.currentTarget.value)}
                disabled={isStreaming}
                placeholder="Reply — ask the agent to inspect runs, recorder output, or the test library..."
                className={cn(
                  'min-h-[68px] resize-none rounded-[10px] border-white/[0.07] bg-white/[0.03] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 transition',
                  isStreaming ? 'opacity-50 cursor-not-allowed' : '',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyDraft.trim() && !isStreaming) {
                    e.preventDefault();
                    const content = replyDraft.trim();
                    setReplyDraft('');
                    void sendStreamingMessage(activeThread.id, content);
                  }
                }}
              />
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isStreaming || !replyDraft.trim()}
                  onClick={() => {
                    const content = replyDraft.trim();
                    if (!content || isStreaming) return;
                    setReplyDraft('');
                    void sendStreamingMessage(activeThread.id, content);
                  }}
                  className={cn(
                    'h-9 rounded-[8px] px-4 text-[13px] font-semibold transition',
                    isStreaming || !replyDraft.trim()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
                  )}
                >
                  {isStreaming ? 'Streaming…' : 'Send'}
                </button>
                <Button variant="ghost" size="sm" className="h-8 rounded-[4px] text-zinc-500 text-[12px]" disabled>
                  Context aware
                </Button>
                {streamError ? <span className="text-[12px] text-red-400">{streamError}</span> : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
