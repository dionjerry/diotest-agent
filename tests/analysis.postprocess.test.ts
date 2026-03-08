import { describe, expect, it } from "vitest";
import { filterContextFiles } from "../extension/engine/analysis/contextFilter";
import { sanitizeAiIssues } from "../extension/engine/analysis/postprocess";

describe("analysis context filtering + issue sanitation", () => {
  it("filters generated extension build artifacts from context", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [
        { path: "extension/background/index.js", source: "github_api" as const },
        { path: "extension/engine/analysis/orchestrator.ts", source: "github_api" as const }
      ]
    };

    const result = filterContextFiles(context);
    expect(result.removedCount).toBe(1);
    expect(result.context.files).toHaveLength(1);
    expect(result.context.files[0]?.path).toBe("extension/engine/analysis/orchestrator.ts");
  });

  it("removes no-test claims when test files exist", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [
        { path: "src/main.ts", source: "github_api" as const },
        { path: "tests/main.test.ts", source: "github_api" as const }
      ]
    };

    const payload = {
      risk_score: 6.1,
      risk_areas: [
        { area: "Absence of test files", severity: "medium" as const, evidence_files: ["src/main.ts"], why: "No test files changed" },
        { area: "Runtime settings change", severity: "medium" as const, evidence_files: ["src/main.ts"], why: "Config changed" }
      ],
      test_plan: {
        unit: [
          { title: "Add tests for changed code", evidence_files: ["src/main.ts"], notes: null },
          { title: "No test files changed for this update", evidence_files: ["src/main.ts"], notes: null }
        ],
        integration: [],
        e2e: []
      },
      manual_test_cases: [{ id: "TC-1", title: "x", preconditions: [], steps: ["1"], expected: ["ok"] }]
    };

    const cleaned = sanitizeAiIssues(payload, context, { trimmed: false, coverage: "base" });
    expect(cleaned.risk_areas).toHaveLength(1);
    expect(cleaned.risk_areas[0]?.area).toContain("Runtime");
    expect(cleaned.test_plan.unit).toHaveLength(1);
    expect(cleaned.test_plan.unit[0]?.title).toContain("Add tests");
  });

  it("removes uncertainty claims when context is not trimmed and coverage is full", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [{ path: "src/main.ts", source: "github_api" as const }]
    };

    const payload = {
      risk_score: 6.1,
      risk_areas: [
        { area: "Token budget and partial scan impact", severity: "low" as const, evidence_files: ["src/main.ts"], why: "Context was token-budget trimmed" },
        { area: "Runtime settings change", severity: "medium" as const, evidence_files: ["src/main.ts"], why: "Config changed" }
      ],
      test_plan: {
        unit: [{ title: "Address context truncation risk", evidence_files: ["src/main.ts"], notes: null }],
        integration: [],
        e2e: []
      },
      manual_test_cases: [{ id: "TC-1", title: "x", preconditions: [], steps: ["1"], expected: ["ok"] }]
    };

    const cleaned = sanitizeAiIssues(payload, context, { trimmed: false, coverage: "deep_scan" });
    expect(cleaned.risk_areas).toHaveLength(1);
    expect(cleaned.risk_areas[0]?.area).toContain("Runtime");
    expect(cleaned.test_plan.unit).toHaveLength(0);
  });
});
