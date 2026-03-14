import type { NumericSettingPath, SettingRange } from "./types";

export const SETTING_RANGES: Record<NumericSettingPath, SettingRange> = {
  "pr.maxFiles": { min: 5, max: 200 },
  "pr.maxDiffLines": { min: 500, max: 20000 },
  "pr.largePrTopRiskFiles": { min: 3, max: 100 },
  "ui.maxScreenshotsPerSession": { min: 0, max: 500 },
  "ui.maxSessionStorageMB": { min: 10, max: 200 },
  "ui.eventThrottlePerSecond": { min: 5, max: 100 },
  "ui.screenshotDelayMs": { min: 100, max: 1000 }
};
