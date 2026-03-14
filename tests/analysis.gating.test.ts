import { describe, expect, it } from "vitest";
import { runAiAnalyze } from "@diotest/engine/analysis/orchestrator";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";

describe("analysis gating", () => {
  it("blocks when OpenAI key is missing", async () => {
    const result = await runAiAnalyze({
      rawSettings: DEFAULT_SETTINGS,
      mode: "pr_commit",
      includeDeepScan: false,
      extractContext: async () => ({
        ok: true,
        context: {
          pageType: "pull_request",
          repo: "org/repo",
          prNumber: 2,
          title: "x",
          description: "",
          url: "https://github.com/org/repo/pull/2",
          files: []
        }
      })
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("OpenAI API key is missing");
    }
  });

  it("blocks in safe mode", async () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.safeMode.enabled = true;
    settings.auth.openaiApiKey = "sk-test";

    const result = await runAiAnalyze({
      rawSettings: settings,
      mode: "pr_commit",
      includeDeepScan: false,
      extractContext: async () => ({ ok: false, error: "x" })
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Safe mode");
    }
  });
});
