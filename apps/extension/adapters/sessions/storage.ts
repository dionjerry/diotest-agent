import type { AnalysisSessionThread, SaveAnalysisSessionInput, AnalysisSessionRun, SessionListResponse } from "@diotest/domain/sessions/types";
import { ANALYSIS_SESSIONS_KEY, DEFAULT_MAX_ANALYSIS_RUNS } from "@diotest/domain/sessions/types";

function parseStoredRuns(value: unknown): AnalysisSessionRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => !!item && typeof item === "object") as AnalysisSessionRun[];
}

function byNewestUpdatedAt(a: AnalysisSessionRun, b: AnalysisSessionRun): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function buildSessionThreadId(repo: string, ref: string): string {
  return `${repo}::${ref}`;
}

export function groupRunsToThreads(runs: AnalysisSessionRun[]): AnalysisSessionThread[] {
  const byThread = new Map<string, AnalysisSessionRun[]>();
  for (const run of runs) {
    const list = byThread.get(run.threadId) ?? [];
    list.push(run);
    byThread.set(run.threadId, list);
  }

  const threads = Array.from(byThread.entries()).map(([threadId, threadRuns]) => {
    const sortedRuns = [...threadRuns].sort(byNewestUpdatedAt);
    const head = sortedRuns[0];
    return {
      threadId,
      repo: head?.repo ?? "unknown/unknown",
      ref: head?.ref ?? "unknown",
      pageType: head?.pageType ?? "pull_request",
      lastUpdatedAt: head?.updatedAt ?? new Date(0).toISOString(),
      runCount: sortedRuns.length,
      runs: sortedRuns
    };
  });

  return threads.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
}

export function enforceRunRetention(runs: AnalysisSessionRun[], maxRuns = DEFAULT_MAX_ANALYSIS_RUNS): {
  runs: AnalysisSessionRun[];
  trimmedCount: number;
} {
  const sorted = [...runs].sort(byNewestUpdatedAt);
  if (sorted.length <= maxRuns) {
    return { runs: sorted, trimmedCount: 0 };
  }

  const kept = sorted.slice(0, maxRuns);
  return {
    runs: kept,
    trimmedCount: sorted.length - kept.length
  };
}

export async function listAnalysisSessions(): Promise<SessionListResponse> {
  const stored = await chrome.storage.local.get(ANALYSIS_SESSIONS_KEY);
  const runs = parseStoredRuns(stored[ANALYSIS_SESSIONS_KEY]).sort(byNewestUpdatedAt);
  return {
    threads: groupRunsToThreads(runs),
    totalRuns: runs.length
  };
}

export async function getAnalysisSession(sessionId: string): Promise<AnalysisSessionRun | null> {
  const stored = await chrome.storage.local.get(ANALYSIS_SESSIONS_KEY);
  const runs = parseStoredRuns(stored[ANALYSIS_SESSIONS_KEY]);
  return runs.find((run) => run.id === sessionId) ?? null;
}

export async function clearAllAnalysisSessions(): Promise<void> {
  await chrome.storage.local.remove(ANALYSIS_SESSIONS_KEY);
}

export async function deleteAnalysisSessionRun(sessionId: string): Promise<{ removed: boolean }> {
  const stored = await chrome.storage.local.get(ANALYSIS_SESSIONS_KEY);
  const runs = parseStoredRuns(stored[ANALYSIS_SESSIONS_KEY]);
  const filtered = runs.filter((run) => run.id !== sessionId);
  if (filtered.length === runs.length) {
    return { removed: false };
  }

  await chrome.storage.local.set({ [ANALYSIS_SESSIONS_KEY]: filtered });
  return { removed: true };
}

export async function deleteAnalysisSessionThread(threadId: string): Promise<{ removed: number }> {
  const stored = await chrome.storage.local.get(ANALYSIS_SESSIONS_KEY);
  const runs = parseStoredRuns(stored[ANALYSIS_SESSIONS_KEY]);
  const filtered = runs.filter((run) => run.threadId !== threadId);
  const removed = runs.length - filtered.length;
  if (removed > 0) {
    await chrome.storage.local.set({ [ANALYSIS_SESSIONS_KEY]: filtered });
  }

  return { removed };
}

export async function saveAnalysisSession(input: SaveAnalysisSessionInput): Promise<{ sessionId: string; trimmedCount: number }> {
  const now = new Date().toISOString();
  const ref = String(input.debug.request_inspector.ref || input.result.meta.analysis_mode);
  const threadId = buildSessionThreadId(input.debug.request_inspector.repo, ref);
  const sessionId = crypto.randomUUID();

  const run: AnalysisSessionRun = {
    id: sessionId,
    threadId,
    createdAt: now,
    updatedAt: now,
    repo: input.debug.request_inspector.repo,
    ref,
    title: input.debug.raw_context.title?.trim() || undefined,
    pageType: input.debug.request_inspector.page_type,
    url: input.debug.raw_context.url,
    mode: input.mode,
    coverageLevel: input.result.meta.coverage_level,
    analysisQuality: input.debug.request_inspector.analysis_quality,
    riskScore: input.result.risk_score,
    riskAreas: input.result.risk_areas,
    testPlan: input.result.test_plan,
    manualTestCases: input.result.manual_test_cases,
    debug: {
      warnings: input.debug.warnings,
      filesDetected: input.debug.request_inspector.files_detected,
      filesSent: input.debug.request_inspector.files_sent_to_ai,
      deepScanUsed: input.debug.request_inspector.deep_scan_used,
      extractionSource: input.debug.request_inspector.extraction_source,
      normalizationFlags: input.debug.request_inspector.normalization_flags_applied
    }
  };

  const stored = await chrome.storage.local.get(ANALYSIS_SESSIONS_KEY);
  const existing = parseStoredRuns(stored[ANALYSIS_SESSIONS_KEY]);
  const retained = enforceRunRetention([run, ...existing], DEFAULT_MAX_ANALYSIS_RUNS);

  if (retained.trimmedCount > 0) {
    const current = retained.runs.find((item) => item.id === sessionId);
    if (current) {
      current.debug.retentionTrimmed = true;
    }
  }

  await chrome.storage.local.set({ [ANALYSIS_SESSIONS_KEY]: retained.runs });
  return { sessionId, trimmedCount: retained.trimmedCount };
}
