import type { SettingsLatest } from "./types";

export function applySafeMode(settings: SettingsLatest): SettingsLatest {
  if (!settings.safeMode.enabled) {
    return settings;
  }

  return {
    ...settings,
    pr: {
      ...settings.pr,
      enableApiFallback: false
    },
    analysis: {
      ...settings.analysis,
      deepScanDefault: false
    },
    ui: {
      ...settings.ui,
      recordScreenshots: false
    },
    telemetry: {
      ...settings.telemetry,
      localEnabled: false
    }
  };
}
