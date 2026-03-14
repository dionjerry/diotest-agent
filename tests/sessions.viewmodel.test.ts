import { describe, expect, it } from "vitest";
import type { AnalysisSessionThread } from "../extension/engine/sessions/types";
import { buildRepoGroups, buildRunsForRepo, sessionsNavReducer } from "../extension/sidepanel/lib/sessionsView";
import type { SessionsNavState } from "../extension/sidepanel/lib/sessionsView";

function thread(repo: string, ref: string, lastUpdatedAt: string, runIds: string[]): AnalysisSessionThread {
  return {
    threadId: `${repo}::${ref}`,
    repo,
    ref,
    pageType: "pull_request",
    lastUpdatedAt,
    runCount: runIds.length,
    runs: runIds.map((id, index) => ({
      id,
      threadId: `${repo}::${ref}`,
      createdAt: new Date(Date.parse(lastUpdatedAt) - index * 1000).toISOString(),
      updatedAt: new Date(Date.parse(lastUpdatedAt) - index * 1000).toISOString(),
      repo,
      ref,
      title: `PR ${ref} title`,
      pageType: "pull_request",
      url: "https://github.com/org/repo/pull/1",
      mode: "pr_commit",
      coverageLevel: "base",
      analysisQuality: "full",
      riskScore: 2,
      riskAreas: [],
      testPlan: { unit: [], integration: [], e2e: [] },
      manualTestCases: [],
      debug: {
        warnings: [],
        filesDetected: 1,
        filesSent: 1,
        deepScanUsed: false,
        extractionSource: "dom",
        normalizationFlags: []
      }
    }))
  };
}

describe("sessions view model", () => {
  it("groups threads by repo and sorts by latest timestamp", () => {
    const groups = buildRepoGroups([
      thread("a/repo", "1", "2026-03-10T10:00:00.000Z", ["a1"]),
      thread("b/repo", "3", "2026-03-10T12:00:00.000Z", ["b1"]),
      thread("a/repo", "2", "2026-03-10T11:00:00.000Z", ["a2", "a3"])
    ]);

    expect(groups[0]?.repo).toBe("b/repo");
    expect(groups[1]?.repo).toBe("a/repo");
    expect(groups[1]?.threadCount).toBe(2);
    expect(groups[1]?.runCount).toBe(3);
  });

  it("builds runs list by repo newest first", () => {
    const runs = buildRunsForRepo(
      [
        thread("a/repo", "1", "2026-03-10T10:00:00.000Z", ["a1"]),
        thread("a/repo", "2", "2026-03-10T11:00:00.000Z", ["a2"])
      ],
      "a/repo"
    );

    expect(runs).toHaveLength(2);
    expect(runs[0]?.id).toBe("a2");
    expect(runs[1]?.id).toBe("a1");
  });

  it("navigates repos -> runs -> detail and back safely", () => {
    let state: SessionsNavState = { mode: "repos", selectedRepo: null, selectedSessionId: null };

    state = sessionsNavReducer(state, { type: "open_repo", repo: "a/repo" });
    expect(state.mode).toBe("runs");

    state = sessionsNavReducer(state, { type: "open_session", sessionId: "s1" });
    expect(state.mode).toBe("detail");

    state = sessionsNavReducer(state, { type: "back" });
    expect(state.mode).toBe("runs");

    state = sessionsNavReducer(state, { type: "sync", sessionExists: false, repoHasRuns: false });
    expect(state.mode).toBe("repos");
  });
});
