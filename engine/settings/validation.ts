import { DEFAULT_SETTINGS } from "./defaults";
import { SETTING_RANGES } from "./ranges";
import type { SettingsLatest, SettingsValidationResult } from "./types";
import { migrateSettings } from "./migration";

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateSettings(input: unknown): SettingsValidationResult {
  const normalized = migrateSettings(input);
  const errors: SettingsValidationResult["errors"] = {};

  const numericChecks: Array<[keyof typeof SETTING_RANGES, number]> = [
    ["pr.maxFiles", normalized.pr.maxFiles],
    ["pr.maxDiffLines", normalized.pr.maxDiffLines],
    ["pr.largePrTopRiskFiles", normalized.pr.largePrTopRiskFiles],
    ["ui.maxScreenshotsPerSession", normalized.ui.maxScreenshotsPerSession],
    ["ui.maxSessionStorageMB", normalized.ui.maxSessionStorageMB],
    ["ui.eventThrottlePerSecond", normalized.ui.eventThrottlePerSecond],
    ["ui.screenshotDelayMs", normalized.ui.screenshotDelayMs]
  ];

  for (const [path, value] of numericChecks) {
    const { min, max } = SETTING_RANGES[path];
    if (!inRange(value, min, max)) {
      errors[path] = `Must be between ${min} and ${max}.`;
    }
  }

  if (normalized.pr.largePrTopRiskFiles > normalized.pr.maxFiles) {
    errors.global = "largePrTopRiskFiles cannot exceed maxFiles.";
  }

  const valid = Object.keys(errors).length === 0;
  const normalizedSettings: SettingsLatest = valid ? normalized : structuredClone(DEFAULT_SETTINGS);

  return {
    valid,
    errors,
    normalizedSettings
  };
}
