import { ERROR_CODES } from "../errors/codes";
import { applySafeMode } from "../settings/safeMode";
import type { SettingsLatest } from "../settings/types";
import { validateSettings } from "../settings/validation";

export function assertSettingsForExecution(raw: unknown): {
  ok: boolean;
  code?: (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
  settings?: SettingsLatest;
} {
  const result = validateSettings(raw);
  if (!result.valid) {
    return { ok: false, code: ERROR_CODES.SETTINGS_VALIDATION_FAILED };
  }

  return {
    ok: true,
    settings: applySafeMode(result.normalizedSettings)
  };
}
