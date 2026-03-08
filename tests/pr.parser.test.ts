import { describe, expect, it } from "vitest";
import { isPrUrl, normalizePrContext, parseRepoAndPrNumber } from "../engine/pr/parser";

describe("pr parser", () => {
  it("detects github PR URLs", () => {
    expect(isPrUrl("https://github.com/org/repo/pull/123")).toBe(true);
    expect(isPrUrl("https://github.com/org/repo/issues/123")).toBe(false);
  });

  it("parses repo and PR number", () => {
    expect(parseRepoAndPrNumber("https://github.com/openai/codex/pull/42")).toEqual({
      repo: "openai/codex",
      prNumber: 42
    });
  });

  it("normalizes and deduplicates files", () => {
    const context = normalizePrContext({
      url: "https://github.com/acme/api/pull/9",
      title: "  Improve auth  ",
      description: "  desc  ",
      changedFiles: [" src/a.ts ", "src/a.ts", "src/b.ts"]
    });

    expect(context.repo).toBe("acme/api");
    expect(context.prNumber).toBe(9);
    expect(context.title).toBe("Improve auth");
    expect(context.description).toBe("desc");
    expect(context.changedFiles).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
