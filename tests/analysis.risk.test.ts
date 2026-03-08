import { describe, expect, it } from "vitest";
import { blendRiskScores, computeDeterministicRiskScore } from "../extension/engine/analysis/risk";

describe("analysis deterministic risk scoring", () => {
  it("scores broad runtime/config commits higher than low single-file edits", () => {
    const highContext = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "abc123",
      title: "scaffold",
      description: "",
      url: "https://github.com/org/repo/commit/abc123",
      files: [
        {
          path: "extension/background/index.ts",
          source: "github_api" as const,
          patch: "@@ -0,0 +1,50 @@\n+const a=1;\n+const b=2;\n-const x=0;"
        },
        {
          path: "engine/settings/validation.ts",
          source: "github_api" as const,
          patch: "@@ -0,0 +1,100 @@\n+line\n+line\n+line\n-line"
        },
        {
          path: "extension/manifest.json",
          source: "github_api" as const,
          patch: "@@ -0,0 +1,20 @@\n+line\n+line"
        }
      ]
    };

    const lowContext = {
      pageType: "commit" as const,
      repo: "org/repo",
      commitSha: "def456",
      title: "doc tweak",
      description: "",
      url: "https://github.com/org/repo/commit/def456",
      files: [
        {
          path: "README.md",
          source: "github_api" as const,
          patch: "@@ -1,2 +1,2 @@\n-line\n+line"
        }
      ]
    };

    const high = computeDeterministicRiskScore(highContext, { coverage: "base", trimmed: false });
    const low = computeDeterministicRiskScore(lowContext, { coverage: "base", trimmed: false });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("blending keeps score close to deterministic floor for low AI estimates", () => {
    const blended = blendRiskScores(2.5, 7.0);
    expect(blended).toBeGreaterThanOrEqual(6.2);
  });
});

