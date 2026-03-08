import { ERROR_MESSAGES } from "../errors/codes";
import { toSafeSettingsProfile } from "../exports/metadata";
import { assertSettingsForExecution } from "../runtime/gating";
import type { PrContext, PrExtractResult } from "./types";

export interface PrAnalyzeRequest {
  rawSettings: unknown;
  tabId: number;
  extractPrContext: (tabId: number) => Promise<PrExtractResult>;
}

export async function runPrAnalyze(request: PrAnalyzeRequest): Promise<
  | { ok: false; error: string }
  | { ok: true; context: PrContext; meta: { engine_version: string; settings_profile: unknown } }
> {
  const gate = assertSettingsForExecution(request.rawSettings);
  if (!gate.ok || !gate.settings) {
    return { ok: false, error: ERROR_MESSAGES.SETTINGS_VALIDATION_FAILED };
  }

  const extract = await request.extractPrContext(request.tabId);
  if (!extract.ok) {
    return { ok: false, error: extract.error };
  }

  return {
    ok: true,
    context: extract.context,
    meta: {
      engine_version: "0.1.0",
      settings_profile: toSafeSettingsProfile(gate.settings)
    }
  };
}
