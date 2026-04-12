import type { SettingsLatest } from "./types";

export const DEFAULT_SETTINGS: SettingsLatest = {
  version: 1,
  pr: {
    maxFiles: 40,
    maxDiffLines: 5000,
    largePrTopRiskFiles: 15,
    enableApiFallback: true
  },
  ui: {
    maxScreenshotsPerSession: 100,
    maxSessionStorageMB: 50,
    eventThrottlePerSecond: 20,
    screenshotDelayMs: 200,
    recordScreenshots: true
  },
  analysis: {
    provider: "openai",
    model: "gpt-4.1-mini",
    deepScanDefault: false
  },
  auth: {
    openaiApiKey: "",
    openrouterApiKey: "",
    githubToken: ""
  },
  telemetry: {
    localEnabled: false
  },
  safeMode: {
    enabled: false
  }
};
