import { DEFAULT_SETTINGS } from "./defaults";
import type { SettingsLatest } from "./types";

export function migrateSettings(raw: unknown): SettingsLatest {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_SETTINGS);
  }

  const candidate = raw as Partial<SettingsLatest>;

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
    analysis: {
      ...DEFAULT_SETTINGS.analysis,
      ...(candidate.analysis ?? {})
    },
    auth: {
      ...DEFAULT_SETTINGS.auth,
      ...(candidate.auth ?? {})
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
