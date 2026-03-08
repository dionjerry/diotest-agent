import { describe, expect, it } from "vitest";
import { isValidAiAnalysisResult } from "../extension/engine/analysis/schema";

describe("analysis schema validator", () => {
  it("accepts valid payload", () => {
    const payload = {
      risk_score: 7,
      risk_areas: [{ area: "auth", severity: "high", evidence_files: ["src/auth.ts"], why: "changed" }],
      test_plan: {
        unit: [{ title: "u", evidence_files: ["x.ts"] }],
        integration: [{ title: "i", evidence_files: ["x.ts"] }],
        e2e: [{ title: "e", evidence_files: ["x.ts"] }]
      },
      manual_test_cases: [{ id: "TC-1", title: "t", preconditions: [], steps: ["1"], expected: ["ok"] }]
    };

    expect(isValidAiAnalysisResult(payload)).toBe(true);
  });

  it("rejects invalid payload", () => {
    expect(isValidAiAnalysisResult({ risk_score: 12 })).toBe(false);
  });
});
