import type { AnalysisSessionRun, AnalysisSessionThread } from "@diotest/domain/sessions/types";

export interface RepoGroupViewModel {
  repo: string;
  threadCount: number;
  runCount: number;
  lastUpdatedAt: string;
}

export type SessionsViewMode = "repos" | "runs" | "detail";

export interface SessionsNavState {
  mode: SessionsViewMode;
  selectedRepo: string | null;
  selectedSessionId: string | null;
}

export type SessionsNavAction =
  | { type: "open_repo"; repo: string }
  | { type: "open_session"; sessionId: string }
  | { type: "back" }
  | { type: "reset" }
  | { type: "sync"; sessionExists: boolean; repoHasRuns: boolean };

function byNewestDate<T extends { updatedAt: string }>(a: T, b: T): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function buildRepoGroups(threads: AnalysisSessionThread[]): RepoGroupViewModel[] {
  const byRepo = new Map<string, AnalysisSessionThread[]>();
  for (const thread of threads) {
    const list = byRepo.get(thread.repo) ?? [];
    list.push(thread);
    byRepo.set(thread.repo, list);
  }

  const groups = Array.from(byRepo.entries()).map(([repo, repoThreads]) => {
    const runCount = repoThreads.reduce((sum, thread) => sum + thread.runCount, 0);
    const lastUpdatedAt = repoThreads
      .map((thread) => thread.lastUpdatedAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date(0).toISOString();

    return {
      repo,
      threadCount: repoThreads.length,
      runCount,
      lastUpdatedAt
    };
  });

  return groups.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
}

export function buildRunsForRepo(threads: AnalysisSessionThread[], repo: string | null): AnalysisSessionRun[] {
  if (!repo) return [];
  const runs = threads
    .filter((thread) => thread.repo === repo)
    .flatMap((thread) => thread.runs)
    .sort(byNewestDate);
  return runs;
}

export function sessionsNavReducer(state: SessionsNavState, action: SessionsNavAction): SessionsNavState {
  switch (action.type) {
    case "open_repo":
      return { mode: "runs", selectedRepo: action.repo, selectedSessionId: null };
    case "open_session":
      return { ...state, mode: "detail", selectedSessionId: action.sessionId };
    case "back":
      if (state.mode === "detail") return { ...state, mode: "runs", selectedSessionId: null };
      if (state.mode === "runs") return { mode: "repos", selectedRepo: null, selectedSessionId: null };
      return state;
    case "reset":
      return { mode: "repos", selectedRepo: null, selectedSessionId: null };
    case "sync":
      if (state.mode === "detail" && !action.sessionExists) {
        if (action.repoHasRuns) return { ...state, mode: "runs", selectedSessionId: null };
        return { mode: "repos", selectedRepo: null, selectedSessionId: null };
      }
      if (state.mode === "runs" && !action.repoHasRuns) {
        return { mode: "repos", selectedRepo: null, selectedSessionId: null };
      }
      return state;
    default:
      return state;
  }
}
