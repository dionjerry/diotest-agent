import { ERROR_MESSAGES } from "../engine/errors/codes";
import { buildPrExportFilename, buildUiSessionExportFilename } from "../engine/exports/naming";
import { toSafeSettingsProfile } from "../engine/exports/metadata";
import { assertSettingsForExecution } from "../engine/runtime/gating";
import { DEFAULT_SETTINGS } from "../engine/settings/defaults";
import { loadSettings, saveSettingsAtomically } from "../engine/settings/storage";
import { autoSessionName } from "../engine/ui/sessionNaming";
import { clearRecorderState, persistRecorderState, restoreRecorderState } from "../engine/worker/state";
import { runAiAnalyze } from "../engine/analysis/orchestrator";
import type { AnalysisMode, ExtractionContext } from "../engine/analysis/types";
import type { PrExtractResult } from "../engine/pr/types";
import {
  clearAllAnalysisSessions,
  deleteAnalysisSessionRun,
  deleteAnalysisSessionThread,
  getAnalysisSession,
  listAnalysisSessions,
  saveAnalysisSession
} from "../engine/sessions/storage";

type Message =
  | { type: "settings.load" }
  | { type: "settings.save"; payload: unknown }
  | { type: "ui.openPanel"; payload: { tabId: number; intent: "review" | "review_analyze" | "settings" } }
  | { type: "analysis.run"; payload: { tabId: number; mode: AnalysisMode; includeDeepScan: boolean } }
  | { type: "pr.pageState"; payload: { onPr: boolean; url: string } }
  | { type: "sessions.list" }
  | { type: "sessions.get"; payload: { sessionId: string } }
  | { type: "sessions.deleteRun"; payload: { sessionId: string } }
  | { type: "sessions.deleteThread"; payload: { threadId: string } }
  | { type: "sessions.clearAll" }
  | { type: "recorder.start"; payload: { tabId: number; domain: string; flow: string } }
  | { type: "recorder.stop" }
  | { type: "recorder.status" }
  | { type: "export.filename"; payload: { mode: "pr" | "ui"; repo?: string; prNumber?: number; domain?: string; ext: "json" | "md" } };

function setBadge(text: string, color = "#d0021b"): void {
  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color });
}

function toExtractionContext(pr: PrExtractResult): ExtractionContext | null {
  if (!pr.ok) return null;
  return {
    pageType: pr.context.pageType,
    repo: pr.context.repo,
    prNumber: pr.context.prNumber,
    commitSha: pr.context.commitSha,
    title: pr.context.title,
    description: pr.context.description,
    url: pr.context.url,
    files: (pr.context.changedFiles ?? []).map((path) => ({ path, source: "dom" as const })),
    extractionSource: pr.context.extractionSource ?? "dom"
  };
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
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const restored = await restoreRecorderState();
  if (restored.state?.active) {
    setBadge("REC");
  }
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
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
      case "ui.openPanel": {
        await chrome.storage.local.set({
          "diotest.ui.intent": message.payload.intent,
          "diotest.ui.sourceTabId": message.payload.tabId
        });
        if (chrome.sidePanel?.open) {
          await chrome.sidePanel.open({ tabId: message.payload.tabId });
          sendResponse({ ok: true, mode: "sidepanel" });
          return;
        }
        sendResponse({ ok: false, mode: "sidepanel-unavailable", error: "Side Panel API is unavailable in this browser build." });
        return;
      }
      case "analysis.run": {
        const settings = await loadSettings();
        const result = await runAiAnalyze({
          rawSettings: settings,
          mode: message.payload.mode,
          includeDeepScan: message.payload.includeDeepScan,
          extractContext: async () => {
            const extracted = await requestPrExtract(message.payload.tabId);
            if (!extracted.ok) {
              return { ok: false as const, error: extracted.error };
            }
            const normalized = toExtractionContext(extracted);
            if (!normalized) {
              return { ok: false as const, error: ERROR_MESSAGES.PR_EXTRACTION_FAILED };
            }
            return { ok: true as const, context: normalized };
          }
        });
        if (result.ok) {
          const persisted = await saveAnalysisSession({
            mode: message.payload.mode,
            result: result.result,
            debug: result.debug
          });

          sendResponse({
            ...result,
            session_id: persisted.sessionId
          });
          return;
        }

        sendResponse(result);
        return;
      }
      case "sessions.list": {
        const sessions = await listAnalysisSessions();
        sendResponse({ ok: true, ...sessions });
        return;
      }
      case "sessions.get": {
        const session = await getAnalysisSession(message.payload.sessionId);
        sendResponse({ ok: true, session });
        return;
      }
      case "sessions.deleteRun": {
        const deleted = await deleteAnalysisSessionRun(message.payload.sessionId);
        sendResponse({ ok: true, removed: deleted.removed });
        return;
      }
      case "sessions.deleteThread": {
        const deleted = await deleteAnalysisSessionThread(message.payload.threadId);
        sendResponse({ ok: true, removed: deleted.removed });
        return;
      }
      case "sessions.clearAll": {
        await clearAllAnalysisSessions();
        sendResponse({ ok: true });
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
