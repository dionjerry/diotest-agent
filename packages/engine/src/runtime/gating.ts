import { ERROR_CODES } from "@diotest/domain/errors/codes";
import { applySafeMode } from "@diotest/domain/settings/safeMode";
import type { SettingsLatest } from "@diotest/domain/settings/types";
import { validateSettings } from "@diotest/domain/settings/validation";

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
