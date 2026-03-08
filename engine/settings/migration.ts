import { DEFAULT_SETTINGS } from "./defaults";
import type { SettingsLatest } from "./types";

export function migrateSettings(raw: unknown): SettingsLatest {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_SETTINGS);
  }

  const candidate = raw as Partial<SettingsLatest>;

  // Template for future migration:
  // if (candidate.version === 1) {
  //   return { ...candidate, version: 2, ui: { ...candidate.ui, captureScrollEvents: false } };
  // }

  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...candidate,
    pr: {
      ...DEFAULT_SETTINGS.pr,
      ...(candidate.pr ?? {})
    },
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(candidate.ui ?? {})
    },
    telemetry: {
      ...DEFAULT_SETTINGS.telemetry,
      ...(candidate.telemetry ?? {})
    },
    safeMode: {
      ...DEFAULT_SETTINGS.safeMode,
      ...(candidate.safeMode ?? {})
    },
    version: 1
  };
}
