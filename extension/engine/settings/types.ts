export interface SettingsV1 {
  version: 1;
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
  auth: {
    openaiApiKey: string;
    githubToken: string;
  };
  telemetry: {
    localEnabled: boolean;
  };
  safeMode: {
    enabled: boolean;
  };
}

export type SettingsLatest = SettingsV1;

export type NumericSettingPath =
  | "pr.maxFiles"
  | "pr.maxDiffLines"
  | "pr.largePrTopRiskFiles"
  | "ui.maxScreenshotsPerSession"
  | "ui.maxSessionStorageMB"
  | "ui.eventThrottlePerSecond"
  | "ui.screenshotDelayMs";

export interface SettingRange {
  min: number;
  max: number;
}

export type SettingsErrors = Partial<Record<NumericSettingPath | "global", string>>;

export interface SettingsValidationResult {
  valid: boolean;
  errors: SettingsErrors;
  normalizedSettings: SettingsLatest;
}
