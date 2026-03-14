import { describe, expect, it } from "vitest";
import { filterContextFiles } from "@diotest/engine/analysis/contextFilter";
import { sanitizeAiIssues, sanitizeAiIssuesWithReport } from "@diotest/engine/analysis/postprocess";

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
        { path: "apps/extension/background/index.js", source: "github_api" as const },
        { path: "packages/engine/src/analysis/orchestrator.ts", source: "github_api" as const }
      ]
    };

    const result = filterContextFiles(context);
    expect(result.removedCount).toBe(1);
    expect(result.context.files).toHaveLength(1);
    expect(result.context.files[0]?.path).toBe("packages/engine/src/analysis/orchestrator.ts");
    expect(result.droppedFilesSummary[0]?.reason).toBe("generated_or_low_signal_artifact");
  });

  it("prioritizes runtime and test-impact files ahead of docs", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [
        { path: "README.md", source: "github_api" as const },
        { path: "engine/runtime/gating.ts", source: "github_api" as const },
        { path: "tests/runtime.test.ts", source: "github_api" as const }
      ]
    };

    const result = filterContextFiles(context);
    expect(result.context.files[0]?.path).toBe("tests/runtime.test.ts");
    expect(result.context.files[1]?.path).toBe("engine/runtime/gating.ts");
    expect(result.context.files[2]?.path).toBe("README.md");
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
      manual_test_cases: [
        { id: "TC-1", title: "x", why: "runtime change requires verification", evidence_files: ["src/main.ts"], preconditions: [], steps: ["1"], expected: ["ok"] }
      ]
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
      manual_test_cases: [
        { id: "TC-1", title: "x", why: "runtime change requires verification", evidence_files: ["src/main.ts"], preconditions: [], steps: ["1"], expected: ["ok"] }
      ]
    };

    const cleaned = sanitizeAiIssues(payload, context, { trimmed: false, coverage: "deep_scan" });
    expect(cleaned.risk_areas).toHaveLength(1);
    expect(cleaned.risk_areas[0]?.area).toContain("Runtime");
    expect(cleaned.test_plan.unit).toHaveLength(0);
  });

  it("normalizes evidence files to analyzed context only and reports flags", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [
        { path: "src/main.ts", source: "github_api" as const },
        { path: "src/service.ts", source: "github_api" as const }
      ]
    };

    const payload = {
      risk_score: 6.1,
      risk_areas: [
        {
          area: " Sensitive paths affected. ",
          severity: "medium" as const,
          evidence_files: ["src/main.ts", "outside/file.ts", "src/main.ts"],
          why: "   Explanation with extra spacing.   "
        }
      ],
      test_plan: {
        unit: [{ title: "   Verify runtime flow   ", evidence_files: ["outside/file.ts"], notes: "   Detail   " }],
        integration: [],
        e2e: []
      },
      manual_test_cases: [
        { id: "TC-1", title: "x", why: "runtime change requires verification", evidence_files: ["src/main.ts"], preconditions: [], steps: ["1"], expected: ["ok"] }
      ]
    };

    const cleaned = sanitizeAiIssuesWithReport(payload, context, { trimmed: false, coverage: "base" });
    expect(cleaned.payload.risk_areas[0]?.evidence_files).toEqual(["src/main.ts"]);
    expect(cleaned.payload.risk_areas[0]?.area).toBe("Sensitive paths affected");
    expect(cleaned.payload.risk_areas[0]?.why).toBe("Explanation with extra spacing.");
    expect(cleaned.payload.test_plan.unit[0]?.evidence_files).toEqual(["src/main.ts"]);
    expect(cleaned.flagsApplied).toContain("normalized_titles_why_and_evidence");
  });

  it("removes generic manual cases and synthesizes specific replacements when needed", () => {
    const context = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc",
      title: "x",
      description: "",
      url: "https://github.com/org/repo/commit/abc",
      files: [
        { path: "apps/web/utils/posthog.ts", source: "github_api" as const },
        { path: "apps/web/utils/llms/index.ts", source: "github_api" as const }
      ]
    };

    const payload = {
      risk_score: 6.1,
      risk_areas: [
        {
          area: "Privacy disclosure risk",
          severity: "medium" as const,
          evidence_files: ["apps/web/utils/posthog.ts"],
          why: "Privacy mode toggles based on approved emails."
        }
      ],
      test_plan: {
        unit: [],
        integration: [],
        e2e: []
      },
      manual_test_cases: [
        {
          id: "MT-1",
          title: "Verify configuration",
          why: "Review docs",
          evidence_files: ["README.md"],
          preconditions: [],
          steps: ["Review"],
          expected: ["OK"]
        }
      ]
    };

    const cleaned = sanitizeAiIssuesWithReport(payload, context, { trimmed: false, coverage: "base" });
    expect(cleaned.flagsApplied).toContain("manual_cases_generic_removed");
    expect(cleaned.flagsApplied).toContain("manual_cases_rewritten_from_risk");
    expect(cleaned.payload.manual_test_cases.length).toBeGreaterThanOrEqual(2);
    expect(cleaned.payload.manual_test_cases[0]?.why.length).toBeGreaterThan(10);
    for (const testCase of cleaned.payload.manual_test_cases) {
      expect(testCase.evidence_files.every((path) => context.files.some((f) => f.path === path))).toBe(true);
    }
    expect(cleaned.manualCaseQuality.generated).toBe(1);
    expect(cleaned.manualCaseQuality.kept).toBeGreaterThanOrEqual(2);
  });
});
