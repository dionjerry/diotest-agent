import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "../extension/engine/prompts/v1";

describe("analysis prompt constraints", () => {
  it("requires explicit manual-case rationale and evidence in prompts", () => {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      "pr_commit",
      {
        pageType: "pull_request",
        repo: "org/repo",
        prNumber: 12,
        title: "t",
        description: "",
        files: [{ path: "src/main.ts", source: "dom" }],
        url: "https://github.com/org/repo/pull/12"
      },
      "summary"
    );

    expect(systemPrompt).toContain("Manual test cases must be change-specific");
    expect(userPrompt).toContain("For each manual_test_case include: id, title, why, evidence_files");
    expect(userPrompt).toContain("Do not output generic templates");
    expect(userPrompt).toContain("Each manual test must reference at least one changed file");
  });
});
