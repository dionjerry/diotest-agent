import { describe, expect, it } from "vitest";
import { buildPrExportFilename, buildUiSessionExportFilename } from "@diotest/renderers/exports/naming";

describe("export naming conventions", () => {
  it("formats PR filenames", () => {
    expect(buildPrExportFilename("Org/Repo", 123, "json")).toBe("diotest_pr_org-repo_123.json");
  });

  it("formats UI filenames", () => {
    const name = buildUiSessionExportFilename("example.com", "md", new Date("2026-03-08T14:22:00.000Z"));
    expect(name).toBe("diotest_ui_session_example-com_2026-03-08-14-22.md");
  });
});
