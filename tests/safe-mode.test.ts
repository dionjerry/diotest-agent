import { describe, expect, it } from "vitest";
import { assertSettingsForExecution } from "../engine/runtime/gating";
import { DEFAULT_SETTINGS } from "../engine/settings/defaults";

describe("safe mode", () => {
  it("disables recorder screenshots, api fallback, and telemetry", () => {
    const input = structuredClone(DEFAULT_SETTINGS);
    input.safeMode.enabled = true;

    const gate = assertSettingsForExecution(input);
    expect(gate.ok).toBe(true);
    expect(gate.settings?.ui.recordScreenshots).toBe(false);
    expect(gate.settings?.pr.enableApiFallback).toBe(false);
    expect(gate.settings?.telemetry.localEnabled).toBe(false);
  });
});
