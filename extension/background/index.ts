import { ERROR_MESSAGES } from "../../engine/errors/codes";
import { buildPrExportFilename, buildUiSessionExportFilename } from "../../engine/exports/naming";
import { toSafeSettingsProfile } from "../../engine/exports/metadata";
import { assertSettingsForExecution } from "../../engine/runtime/gating";
import { DEFAULT_SETTINGS } from "../../engine/settings/defaults";
import { loadSettings, saveSettingsAtomically } from "../../engine/settings/storage";
import { autoSessionName } from "../../engine/ui/sessionNaming";
import { clearRecorderState, persistRecorderState, restoreRecorderState } from "../../engine/worker/state";
import { runPrAnalyze } from "../../engine/pr/orchestrator";
import type { PrExtractResult } from "../../engine/pr/types";

type Message =
  | { type: "settings.load" }
  | { type: "settings.save"; payload: unknown }
  | { type: "analysis.run"; payload: { mode: "pr" | "ui"; context?: Record<string, unknown> } }
  | { type: "pr.analyze"; payload: { tabId: number } }
  | { type: "pr.pageState"; payload: { onPr: boolean; url: string } }
  | { type: "recorder.start"; payload: { tabId: number; domain: string; flow: string } }
  | { type: "recorder.stop" }
  | { type: "recorder.status" }
  | { type: "export.filename"; payload: { mode: "pr" | "ui"; repo?: string; prNumber?: number; domain?: string; ext: "json" | "md" } };

function setBadge(text: string, color = "#d0021b"): void {
  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color });
}

async function requestPrExtract(tabId: number): Promise<PrExtractResult> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, { type: "pr.extract" })) as { payload?: PrExtractResult };
    if (!response?.payload) {
      return { ok: false, error: ERROR_MESSAGES.PR_EXTRACTION_FAILED };
    }
    return response.payload;
  } catch {
    return { ok: false, error: ERROR_MESSAGES.PR_EXTRACTION_FAILED };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("diotest.settings");
  if (!existing["diotest.settings"]) {
    await chrome.storage.local.set({ "diotest.settings": DEFAULT_SETTINGS });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const restored = await restoreRecorderState();
  if (restored.state?.active) {
    setBadge("REC");
  }
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case "settings.load": {
        const settings = await loadSettings();
        sendResponse({ ok: true, settings });
        return;
      }
      case "settings.save": {
        const result = await saveSettingsAtomically(message.payload);
        sendResponse(result.valid ? { ok: true, settings: result.normalizedSettings } : { ok: false, errors: result.errors });
        return;
      }
      case "analysis.run": {
        const settings = await loadSettings();
        const gate = assertSettingsForExecution(settings);
        if (!gate.ok || !gate.settings) {
          sendResponse({ ok: false, error: ERROR_MESSAGES.SETTINGS_VALIDATION_FAILED });
          return;
        }
        sendResponse({
          ok: true,
          meta: {
            engine_version: "0.1.0",
            settings_profile: toSafeSettingsProfile(gate.settings)
          },
          note: `${message.payload.mode.toUpperCase()} analysis accepted`
        });
        return;
      }
      case "pr.pageState": {
        if (message.payload.onPr) {
          setBadge("PR", "#2563eb");
        } else {
          const recorder = await restoreRecorderState();
          setBadge(recorder.state?.active ? "REC" : "", recorder.state?.active ? "#d0021b" : "#2563eb");
        }
        sendResponse({ ok: true });
        return;
      }
      case "pr.analyze": {
        const settings = await loadSettings();
        const result = await runPrAnalyze({
          rawSettings: settings,
          tabId: message.payload.tabId,
          extractPrContext: requestPrExtract
        });
        sendResponse(result);
        return;
      }
      case "recorder.start": {
        const settings = await loadSettings();
        const gate = assertSettingsForExecution(settings);
        if (!gate.ok || !gate.settings || gate.settings.safeMode.enabled) {
          sendResponse({ ok: false, error: "Safe mode or invalid settings blocks recorder start." });
          return;
        }
        const session = {
          active: true,
          startedAt: new Date().toISOString(),
          sessionId: crypto.randomUUID(),
          tabId: message.payload.tabId,
          domain: message.payload.domain,
          name: autoSessionName(message.payload.domain, message.payload.flow)
        };
        await persistRecorderState({
          active: session.active,
          startedAt: session.startedAt,
          sessionId: session.sessionId,
          tabId: session.tabId,
          domain: session.domain
        });
        setBadge("REC");
        sendResponse({ ok: true, session });
        return;
      }
      case "recorder.stop": {
        await clearRecorderState();
        setBadge("");
        sendResponse({ ok: true });
        return;
      }
      case "recorder.status": {
        const restored = await restoreRecorderState();
        sendResponse({ ok: true, state: restored.state, errorCode: restored.errorCode });
        return;
      }
      case "export.filename": {
        if (message.payload.mode === "pr") {
          sendResponse({ ok: true, filename: buildPrExportFilename(message.payload.repo ?? "repo", message.payload.prNumber ?? 0, message.payload.ext) });
          return;
        }
        sendResponse({ ok: true, filename: buildUiSessionExportFilename(message.payload.domain ?? "domain", message.payload.ext) });
        return;
      }
    }
  })();

  return true;
});
