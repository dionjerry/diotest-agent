import { describe, expect, it } from "vitest";
import {
  isCommitUrl,
  isPrUrl,
  isSupportedGithubReviewUrl,
  normalizePrContext,
  parseRepoAndCommitSha,
  parseRepoAndPrNumber
} from "../engine/pr/parser";

describe("pr parser", () => {
  it("detects github PR URLs", () => {
    expect(isPrUrl("https://github.com/org/repo/pull/123")).toBe(true);
    expect(isPrUrl("https://github.com/org/repo/issues/123")).toBe(false);
    expect(isCommitUrl("https://github.com/org/repo/commit/21646c696547a1b0a43916a78f1c7bb4f3cbe352")).toBe(true);
    expect(isSupportedGithubReviewUrl("https://github.com/org/repo/commit/21646c696547a1b0a43916a78f1c7bb4f3cbe352")).toBe(true);
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
      changedFiles: [" src/a.ts ", "src/a.ts", "src/b.ts"],
      extractionSource: "api"
    });

    expect(context.repo).toBe("acme/api");
    expect(context.prNumber).toBe(9);
    expect(context.pageType).toBe("pull_request");
    expect(context.title).toBe("Improve auth");
    expect(context.description).toBe("desc");
    expect(context.changedFiles).toEqual(["src/a.ts", "src/b.ts"]);
    expect(context.extractionSource).toBe("api");
  });

  it("parses and normalizes commit URL", () => {
    const parsed = parseRepoAndCommitSha("https://github.com/acme/api/commit/21646c696547a1b0a43916a78f1c7bb4f3cbe352");
    expect(parsed).toEqual({
      repo: "acme/api",
      commitSha: "21646c696547a1b0a43916a78f1c7bb4f3cbe352"
    });

    const context = normalizePrContext({
      url: "https://github.com/acme/api/commit/21646c696547a1b0a43916a78f1c7bb4f3cbe352",
      title: "Fix null checks",
      changedFiles: ["src/x.ts"]
    });

    expect(context.pageType).toBe("commit");
    expect(context.commitSha).toBe("21646c696547a1b0a43916a78f1c7bb4f3cbe352");
    expect(context.prNumber).toBeUndefined();
  });
});
