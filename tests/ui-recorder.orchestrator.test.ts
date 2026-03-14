import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";
import type { UiRecorderGenerationResult, UiRecorderSession } from "@diotest/domain/recorder/types";

vi.mock("@diotest/providers/openai", () => ({
  generateStructured: vi.fn(),
}));

import { generateStructured } from "@diotest/providers/openai";
import { generateUiRecorderArtifacts } from "@diotest/engine/recorder/orchestrator";

const validResult: UiRecorderGenerationResult = {
  manual_test_cases: [
    {
      id: "MTC-001",
      title: "Search flow",
      why: "Verify the flow works.",
      evidence_files: ["Click Search"],
      preconditions: ["User is on the search page"],
      steps: ["Click Search"],
      expected: ["Results page opens"],
      source: "flow",
    },
    {
      id: "MTC-002",
      title: "Explore visible CTA",
      why: "Verify visible page CTA is reachable.",
      evidence_files: ["Search page"],
      preconditions: ["User is on the search page"],
      steps: ["Click visible CTA"],
      expected: ["CTA destination opens"],
      source: "page",
    },
  ],
  playwright_scenario: {
    title: "Search flow",
    goal: "Verify search flow",
    steps: [
      { action: "click", target: "#search", assertion: "results visible" },
    ],
    notes: ["Use reviewed steps"],
  },
};

function buildSession(): UiRecorderSession {
  return {
    id: "session-1",
    name: "Recorded Flow",
    domain: "example.com",
    startUrl: "https://example.com",
    lastUrl: "https://example.com/results",
    startedAt: "2026-03-14T10:00:00.000Z",
    stoppedAt: "2026-03-14T10:01:00.000Z",
    status: "review",
    steps: [
      {
        id: "step-1",
        timestamp: "2026-03-14T10:00:10.000Z",
        action: "click",
        title: "Click Search",
        selector: "#search",
        url: "https://example.com",
        kept: true,
        screenshot: {
          id: "shot-1",
          capturedAt: "2026-03-14T10:00:10.000Z",
          dataUrl: "data:image/jpeg;base64,AAA",
        },
      },
      {
        id: "step-2",
        timestamp: "2026-03-14T10:00:20.000Z",
        action: "navigation",
        title: "Navigate to results",
        url: "https://example.com/results",
        kept: true,
      },
    ],
    pageSummaries: [
      {
        id: "page-1",
        url: "https://example.com",
        title: "Search page",
        capturedAt: "2026-03-14T10:00:09.000Z",
        summary: "Headings: Search | Fields: Destination | Actions: Search",
        headings: ["Search"],
        actions: ["Search"],
        fields: ["Destination"],
        sections: ["Hero"],
      },
    ],
    warnings: [],
    screenshotsCaptured: 1,
    storageTrimmed: false,
  };
}

describe("ui recorder orchestrator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends text-only structured generation when vision is disabled", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ ok: true, data: validResult });

    const settings = {
      ...DEFAULT_SETTINGS,
      auth: { ...DEFAULT_SETTINGS.auth, openaiApiKey: "sk-test" },
    };

    const result = await generateUiRecorderArtifacts(settings, buildSession(), {
      includeVision: false,
      includePageSummaries: true,
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(generateStructured)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateStructured).mock.calls[0]?.[0].userContent).toBeUndefined();
    expect(vi.mocked(generateStructured).mock.calls[0]?.[0].userPrompt).toContain("PAGE_SUMMARIES:");
    expect(vi.mocked(generateStructured).mock.calls[0]?.[0].userPrompt).toContain("Generate 3-6 manual test cases");
    expect(vi.mocked(generateStructured).mock.calls[0]?.[0].userPrompt).toContain("source='page'");
  });

  it("falls back to text-only generation if vision generation fails", async () => {
    vi.mocked(generateStructured)
      .mockResolvedValueOnce({ ok: false, error: "vision request failed" })
      .mockResolvedValueOnce({ ok: true, data: validResult });

    const settings = {
      ...DEFAULT_SETTINGS,
      auth: { ...DEFAULT_SETTINGS.auth, openaiApiKey: "sk-test" },
    };

    const result = await generateUiRecorderArtifacts(settings, buildSession(), {
      includeVision: true,
      includePageSummaries: true,
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(generateStructured)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateStructured).mock.calls[0]?.[0].userContent?.length).toBeGreaterThan(0);
    expect(vi.mocked(generateStructured).mock.calls[1]?.[0].userContent).toBeUndefined();
  });
});
