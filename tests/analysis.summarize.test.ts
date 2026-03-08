import { describe, expect, it } from "vitest";
import { estimateTokens, summarizeContext } from "../extension/engine/analysis/summarize";

describe("analysis summarize", () => {
  it("estimates tokens", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("trims files and diff lines", () => {
    const context = {
      pageType: "pull_request" as const,
      repo: "org/repo",
      prNumber: 1,
      title: "Title",
      description: "Desc",
      url: "https://github.com/org/repo/pull/1",
      files: [
        { path: "a.ts", patch: "line1\nline2\nline3", source: "dom" as const },
        { path: "b.ts", patch: "line1\nline2\nline3", source: "dom" as const }
      ]
    };

    const result = summarizeContext(context, 2, 1);
    expect(result.trimmed).toBe(true);
    expect(result.summary).toContain("FILE: a.ts");
    expect(result.summary).not.toContain("FILE: b.ts");
  });
});
