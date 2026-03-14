import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSessionThreadId,
  clearAllAnalysisSessions,
  deleteAnalysisSessionRun,
  deleteAnalysisSessionThread,
  enforceRunRetention,
  getAnalysisSession,
  groupRunsToThreads,
  listAnalysisSessions,
  saveAnalysisSession
} from "../extension/engine/sessions/storage";
import type { AnalysisSessionRun } from "../extension/engine/sessions/types";
import { ANALYSIS_SESSIONS_KEY } from "../extension/engine/sessions/types";

function buildRun(id: string, repo: string, ref: string, updatedAt: string): AnalysisSessionRun {
  return {
    id,
    threadId: buildSessionThreadId(repo, ref),
    createdAt: updatedAt,
    updatedAt,
    repo,
    ref,
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
  };
}

describe("analysis sessions storage", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];

    Object.assign(globalThis, {
      chrome: {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: store[key] })),
            set: vi.fn(async (value: Record<string, unknown>) => Object.assign(store, value)),
            remove: vi.fn(async (key: string) => {
              delete store[key];
            })
          }
        }
      }
    });

    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
  });

  it("groups runs by repo+ref threads and sorts newest first", () => {
    const grouped = groupRunsToThreads([
      buildRun("a", "org/repo", "12", "2026-03-10T10:00:00.000Z"),
      buildRun("b", "org/repo", "12", "2026-03-10T11:00:00.000Z"),
      buildRun("c", "org/repo", "99", "2026-03-10T09:00:00.000Z")
    ]);

    expect(grouped[0]?.ref).toBe("12");
    expect(grouped[0]?.runs[0]?.id).toBe("b");
    expect(grouped[1]?.ref).toBe("99");
  });

  it("enforces retention limit and keeps newest runs", () => {
    const retained = enforceRunRetention(
      [
        buildRun("a", "org/repo", "1", "2026-03-10T10:00:00.000Z"),
        buildRun("b", "org/repo", "1", "2026-03-10T11:00:00.000Z"),
        buildRun("c", "org/repo", "1", "2026-03-10T12:00:00.000Z")
      ],
      2
    );

    expect(retained.trimmedCount).toBe(1);
    expect(retained.runs.map((run) => run.id)).toEqual(["c", "b"]);
  });

  it("saves and retrieves sessions, then deletes by run and thread", async () => {
    const baseResult = {
      meta: {
        schema_version: "1.0.0" as const,
        engine_version: "0.1.0",
        prompt_version: "v1",
        analysis_mode: "pr_commit" as const,
        coverage_level: "base" as const
      },
      risk_score: 3,
      risk_areas: [],
      test_plan: { unit: [], integration: [], e2e: [] },
      manual_test_cases: []
    };

    const baseDebug = {
      token_estimate: 100,
      warnings: [],
      context_summary: "x",
      raw_context: {
        pageType: "pull_request" as const,
        repo: "org/repo",
        prNumber: 1,
        title: "t",
        description: "",
        files: [{ path: "a.ts", source: "dom" as const }],
        url: "https://github.com/org/repo/pull/1",
        extractionSource: "dom" as const
      },
      request_inspector: {
        mode: "pr_commit" as const,
        page_type: "pull_request" as const,
        repo: "org/repo",
        ref: "1",
        files_detected: 1,
        files_sent_to_ai: 1,
        deep_scan_requested: false,
        deep_scan_used: false,
        extraction_source: "dom" as const,
        analysis_quality: "full" as const,
        dropped_files_summary: [],
        normalization_flags_applied: [],
        manual_cases_generated: 0,
        manual_cases_kept: 0,
        screenshots_sent: false,
        prompt_preview: "x"
      }
    };

    const first = await saveAnalysisSession({ mode: "pr_commit", result: baseResult, debug: baseDebug as any });
    expect(first.sessionId).toBe("11111111-1111-4111-8111-111111111111");

    vi.spyOn(crypto, "randomUUID").mockReturnValue("22222222-2222-4222-8222-222222222222");
    await saveAnalysisSession({
      mode: "pr_commit",
      result: baseResult,
      debug: {
        ...(baseDebug as any),
        request_inspector: {
          ...(baseDebug as any).request_inspector,
          ref: "2"
        }
      }
    });

    const list = await listAnalysisSessions();
    expect(list.totalRuns).toBe(2);
    expect(list.threads).toHaveLength(2);

    const one = await getAnalysisSession("11111111-1111-4111-8111-111111111111");
    expect(one?.ref).toBe("1");

    const removedRun = await deleteAnalysisSessionRun("11111111-1111-4111-8111-111111111111");
    expect(removedRun.removed).toBe(true);

    const removedThread = await deleteAnalysisSessionThread(buildSessionThreadId("org/repo", "2"));
    expect(removedThread.removed).toBe(1);

    await clearAllAnalysisSessions();
    expect(store[ANALYSIS_SESSIONS_KEY]).toBeUndefined();
  });
});
