import { describe, expect, it } from "vitest";
import { runPrAnalyze } from "@diotest/engine/pr/orchestrator";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";

describe("pr analyze orchestration", () => {
  it("returns extracted context when settings are valid", async () => {
    const result = await runPrAnalyze({
      rawSettings: DEFAULT_SETTINGS,
      tabId: 1,
      extractPrContext: async () => ({
        ok: true,
        context: {
          pageType: "pull_request",
          repo: "org/repo",
          prNumber: 12,
          title: "PR",
          description: "desc",
          changedFiles: ["src/a.ts"],
          url: "https://github.com/org/repo/pull/12"
        }
      })
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.repo).toBe("org/repo");
    }
  });

  it("fails when extraction fails", async () => {
    const result = await runPrAnalyze({
      rawSettings: DEFAULT_SETTINGS,
      tabId: 2,
      extractPrContext: async () => ({ ok: false, error: "PR extraction failed" })
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("failed");
    }
  });
});
