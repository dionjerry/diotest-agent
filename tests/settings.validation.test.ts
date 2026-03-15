import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";
import { validateSettings } from "@diotest/domain/settings/validation";

describe("settings range validation", () => {
  it("accepts defaults", () => {
    const result = validateSettings(DEFAULT_SETTINGS);
    expect(result.valid).toBe(true);
  });

  it("rejects out-of-range values for all numeric fields", () => {
    const bad = structuredClone(DEFAULT_SETTINGS);
    bad.pr.maxFiles = 1;
    bad.pr.maxDiffLines = 499;
    bad.pr.largePrTopRiskFiles = 101;
    bad.ui.maxScreenshotsPerSession = 999;
    bad.ui.maxSessionStorageMB = 9;
    bad.ui.eventThrottlePerSecond = 101;
    bad.ui.screenshotDelayMs = 50;

    const result = validateSettings(bad);
    expect(result.valid).toBe(false);
    expect(result.errors["pr.maxFiles"]).toBeDefined();
    expect(result.errors["pr.maxDiffLines"]).toBeDefined();
    expect(result.errors["pr.largePrTopRiskFiles"]).toBeDefined();
    expect(result.errors["ui.maxScreenshotsPerSession"]).toBeDefined();
    expect(result.errors["ui.maxSessionStorageMB"]).toBeDefined();
    expect(result.errors["ui.eventThrottlePerSecond"]).toBeDefined();
    expect(result.errors["ui.screenshotDelayMs"]).toBeDefined();
  });

  it("accepts provider switching without forcing API keys at save time", () => {
    const openRouter = structuredClone(DEFAULT_SETTINGS);
    openRouter.analysis.provider = "openrouter";
    openRouter.analysis.model = "openai/gpt-4.1-mini";

    const result = validateSettings(openRouter);
    expect(result.valid).toBe(true);
  });
});
