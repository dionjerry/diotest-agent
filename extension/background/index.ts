import { ERROR_MESSAGES } from "../engine/errors/codes";
import { buildPrExportFilename, buildUiSessionExportFilename } from "../engine/exports/naming";
import { toSafeSettingsProfile } from "../engine/exports/metadata";
import { assertSettingsForExecution } from "../engine/runtime/gating";
import { DEFAULT_SETTINGS } from "../engine/settings/defaults";
import { loadSettings, saveSettingsAtomically } from "../engine/settings/storage";
import { autoSessionName } from "../engine/ui/sessionNaming";
import { clearRecorderState, persistRecorderState, restoreRecorderState } from "../engine/worker/state";
import type {
  RecorderActiveState,
  RecorderPageSummaryPayload,
  RawRecorderEvent,
  UiRecorderGenerationOptions,
  UiRecorderSession,
} from "../engine/recorder/types";
import {
  appendUiRecorderEvent,
  clearAllUiRecorderSessions,
  createUiRecorderSession,
  deleteUiRecorderSession,
  finalizeUiRecorderSession,
  getUiRecorderSession,
  listUiRecorderSessions,
  setUiRecorderGenerationOptions,
  updateUiRecorderSession
} from "../engine/recorder/storage";
import { generateUiRecorderArtifacts } from "../engine/recorder/orchestrator";
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
  | { type: "recorder.event"; payload: RawRecorderEvent }
  | { type: "recorder.stop" }
  | { type: "recorder.status" }
  | { type: "recorder.session.list" }
  | { type: "recorder.session.get"; payload: { sessionId: string } }
  | { type: "recorder.session.update"; payload: { sessionId: string; steps: Array<{ id: string; title: string; kept: boolean }> } }
  | { type: "recorder.session.generate"; payload: { sessionId: string; includeVision?: boolean; includePageSummaries?: boolean } }
  | { type: "recorder.session.delete"; payload: { sessionId: string } }
  | { type: "recorder.session.clearAll" }
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

async function injectUiRecorder(tabId: number, active: RecorderActiveState): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/ui-recorder.js"]
  });
  await chrome.tabs.sendMessage(tabId, {
    type: "recorder.control",
    payload: {
      action: "start",
      sessionId: active.sessionId,
      throttleMs: Math.round(1000 / Math.max(1, active.eventThrottlePerSecond))
    }
  });
}

async function requestPageSummary(tabId: number): Promise<RecorderPageSummaryPayload | undefined> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "recorder.control",
      payload: { action: "summarize_page" }
    }) as { ok?: boolean; summary?: RecorderPageSummaryPayload };
    return response?.ok ? response.summary : undefined;
  } catch {
    return undefined;
  }
}

function shouldCaptureScreenshot(event: RawRecorderEvent): boolean {
  return ["click", "change", "select", "submit", "navigation"].includes(event.action);
}

async function maybeCaptureScreenshot(active: RecorderActiveState, session: UiRecorderSession, event: RawRecorderEvent) {
  if (!active.recordScreenshots) return undefined;
  if (!shouldCaptureScreenshot(event)) return undefined;
  if (session.screenshotsCaptured >= active.maxScreenshotsPerSession) return undefined;
  await new Promise((resolve) => setTimeout(resolve, active.screenshotDelayMs));
  try {
    const tab = await chrome.tabs.get(active.tabId);
    const windowId = typeof tab.windowId === "number" ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 60 });
    return {
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      dataUrl: typeof dataUrl === "string" ? dataUrl : ""
    };
  } catch {
    return undefined;
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  void (async () => {
    if (changeInfo.status !== "complete") return;
    const restored = await restoreRecorderState();
    if (!restored.state?.active || restored.state.tabId !== tabId) return;
    try {
      await injectUiRecorder(tabId, restored.state);
    } catch {
      // ignore reinjection failures on unsupported pages
    }
  })();
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void (async () => {
    try {
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
        const activeState: RecorderActiveState = {
          active: session.active,
          startedAt: session.startedAt,
          sessionId: session.sessionId,
          tabId: session.tabId,
          domain: session.domain,
          eventThrottlePerSecond: gate.settings.ui.eventThrottlePerSecond,
          screenshotDelayMs: gate.settings.ui.screenshotDelayMs,
          recordScreenshots: gate.settings.ui.recordScreenshots,
          maxScreenshotsPerSession: gate.settings.ui.maxScreenshotsPerSession,
          maxSessionStorageMB: gate.settings.ui.maxSessionStorageMB
        };
        await persistRecorderState(activeState);
        const tab = await chrome.tabs.get(message.payload.tabId);
        await createUiRecorderSession(activeState, session.name, tab.url ?? `https://${session.domain}`);
        await injectUiRecorder(message.payload.tabId, activeState);
        setBadge("REC");
        sendResponse({ ok: true, session });
        return;
      }
      case "recorder.event": {
        const restored = await restoreRecorderState();
        if (!restored.state?.active || restored.state.sessionId !== message.payload.sessionId) {
          sendResponse({ ok: false, ignored: true });
          return;
        }
        const currentSession = await getUiRecorderSession(message.payload.sessionId);
        if (!currentSession) {
          sendResponse({ ok: false, ignored: true });
          return;
        }
        const screenshot = await maybeCaptureScreenshot(restored.state, currentSession, message.payload);
        const pageSummary = shouldCaptureScreenshot(message.payload) ? await requestPageSummary(restored.state.tabId) : undefined;
        const updated = await appendUiRecorderEvent(restored.state, message.payload, screenshot, pageSummary);
        sendResponse({ ok: true, session: updated });
        return;
      }
      case "recorder.stop": {
        const restored = await restoreRecorderState();
        const finalPageSummary = restored.state?.active ? await requestPageSummary(restored.state.tabId) : undefined;
        if (restored.state?.active) {
          try {
            await chrome.tabs.sendMessage(restored.state.tabId, { type: "recorder.control", payload: { action: "stop" } });
          } catch {
            // ignore tab messaging failures on stop
          }
        }
        let session = restored.state?.sessionId ? await finalizeUiRecorderSession(restored.state.sessionId) : null;
        if (session && finalPageSummary) {
          session = await updateUiRecorderSession(session.id, (current) => ({
            ...current,
            pageSummaries: [
              ...(current.pageSummaries ?? []).filter((item) => item.url !== finalPageSummary.url),
              {
                id: crypto.randomUUID(),
                url: finalPageSummary.url,
                title: finalPageSummary.title,
                capturedAt: new Date().toISOString(),
                summary: finalPageSummary.summary,
                headings: finalPageSummary.headings,
                actions: finalPageSummary.actions,
                fields: finalPageSummary.fields,
                sections: finalPageSummary.sections,
              }
            ].slice(-12),
          }));
        }
        await clearRecorderState();
        setBadge("");
        sendResponse({ ok: true, session });
        return;
      }
      case "recorder.status": {
        const restored = await restoreRecorderState();
        sendResponse({ ok: true, state: restored.state, errorCode: restored.errorCode });
        return;
      }
      case "recorder.session.list": {
        const sessions = await listUiRecorderSessions();
        sendResponse({ ok: true, sessions });
        return;
      }
      case "recorder.session.get": {
        const session = await getUiRecorderSession(message.payload.sessionId);
        sendResponse({ ok: true, session });
        return;
      }
      case "recorder.session.update": {
        const session = await updateUiRecorderSession(message.payload.sessionId, (current) => ({
          ...current,
          steps: current.steps.map((step) => {
            const update = message.payload.steps.find((item) => item.id === step.id);
            return update ? { ...step, title: update.title, kept: update.kept } : step;
          }),
          status: "review"
        }));
        sendResponse({ ok: true, session });
        return;
      }
      case "recorder.session.generate": {
        const settings = await loadSettings();
        const session = await getUiRecorderSession(message.payload.sessionId);
        if (!session) {
          sendResponse({ ok: false, error: "Recorder session not found." });
          return;
        }
        const options: UiRecorderGenerationOptions = {
          includeVision: Boolean(message.payload.includeVision),
          includePageSummaries: message.payload.includePageSummaries !== false,
        };
        const generated = await generateUiRecorderArtifacts(settings, session, options);
        if (!generated.ok) {
          sendResponse(generated);
          return;
        }
        let updated = await updateUiRecorderSession(message.payload.sessionId, (current) => ({
          ...current,
          status: "generated",
          generated: generated.result
        }));
        if (updated) {
          updated = await setUiRecorderGenerationOptions(message.payload.sessionId, options);
          updated = await updateUiRecorderSession(message.payload.sessionId, (current) => ({
            ...current,
            status: "generated",
            generated: generated.result,
          }));
        }
        sendResponse({ ok: true, session: updated });
        return;
      }
      case "recorder.session.delete": {
        const deleted = await deleteUiRecorderSession(message.payload.sessionId);
        sendResponse({ ok: true, removed: deleted.removed });
        return;
      }
      case "recorder.session.clearAll": {
        await clearAllUiRecorderSessions();
        sendResponse({ ok: true });
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
      sendResponse({ ok: false, error: "Unsupported message type." });
    } catch (error) {
      console.error("DioTest background message failure", {
        type: (message as { type?: string })?.type,
        error
      });
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected background error."
      });
    }
  })();

  return true;
});
