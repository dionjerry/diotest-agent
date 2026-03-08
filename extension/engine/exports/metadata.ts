import type { SettingsLatest } from "../settings/types";

export interface SafeSettingsProfile {
  pr: {
    maxFiles: number;
    maxDiffLines: number;
    largePrTopRiskFiles: number;
    enableApiFallback: boolean;
  };
  ui: {
    maxScreenshotsPerSession: number;
    maxSessionStorageMB: number;
    eventThrottlePerSecond: number;
    screenshotDelayMs: number;
    recordScreenshots: boolean;
  };
  analysis: {
    model: string;
    deepScanDefault: boolean;
  };
  telemetry: {
    localEnabled: boolean;
  };
  safeMode: {
    enabled: boolean;
  };
}

export function toSafeSettingsProfile(settings: SettingsLatest): SafeSettingsProfile {
  return {
    pr: { ...settings.pr },
    ui: { ...settings.ui },
    analysis: { ...settings.analysis },
    telemetry: { ...settings.telemetry },
    safeMode: { ...settings.safeMode }
  };
}
