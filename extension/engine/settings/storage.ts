import { DEFAULT_SETTINGS } from "./defaults";
import type { SettingsLatest, SettingsValidationResult } from "./types";
import { validateSettings } from "./validation";

const SETTINGS_KEY = "diotest.settings";

export async function loadSettings(): Promise<SettingsLatest> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] ?? DEFAULT_SETTINGS;
  return validateSettings(value).normalizedSettings;
}

export async function saveSettingsAtomically(input: unknown): Promise<SettingsValidationResult> {
  const validation = validateSettings(input);
  if (!validation.valid) {
    return validation;
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: validation.normalizedSettings });
  return validation;
}
