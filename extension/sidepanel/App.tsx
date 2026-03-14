import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SettingsLatest } from "../engine/settings/types";
import { DEFAULT_SETTINGS } from "../engine/settings/defaults";
import { SettingsPanel } from "./components/SettingsPanel";
import { sendMessage } from "./lib/messages";
import { Button } from "./components/ui/button";
import type { AiAnalysisResultV1, AnalyzeDebug, AnalysisMode } from "../engine/analysis/types";
import { CodeViewer } from "./components/CodeViewer";
import { Checkbox } from "./components/ui/checkbox";
import type { AnalysisSessionRun, AnalysisSessionThread } from "../engine/sessions/types";
import { buildRepoGroups, buildRunsForRepo, sessionsNavReducer } from "./lib/sessionsView";
import type { UiRecorderGenerationOptions, UiRecorderSession, UiRecorderSessionGroup } from "../engine/recorder/types";
import { recorderNavReducer, sessionsForDomain } from "./lib/recorderView";

function formatElapsed(startedAt: string): string {
  const delta = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const s = Math.floor(delta / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

async function resolveAnalysisTabId(): Promise<number | null> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && active.url && !active.url.startsWith("extension://")) {
    return active.id;
  }
  const stored = await chrome.storage.local.get("diotest.ui.sourceTabId");
  const sourceTabId = stored["diotest.ui.sourceTabId"] as number | undefined;
  if (sourceTabId) {
    try {
      const tab = await chrome.tabs.get(sourceTabId);
      if (tab?.id && tab.url?.startsWith("https://github.com/")) return tab.id;
    } catch { /* ignore stale */ }
  }
  const githubTabs = await chrome.tabs.query({
    currentWindow: true,
    url: ["https://github.com/*/*/pull/*", "https://github.com/*/*/commit/*"],
  });
  return githubTabs[0]?.id ?? null;
}

function getRiskClass(score: number): string {
  if (score >= 7) return "score-high";
  if (score >= 4) return "score-medium";
  return "score-low";
}

function getRiskLabel(score: number): string {
  if (score >= 7) return "High risk";
  if (score >= 4) return "Medium risk";
  return "Low risk";
}

function cleanSessionTitle(title?: string): string | null {
  if (!title) return null;
  const normalized = title.trim();
  if (!normalized) return null;
  if (/^search code, repositories, users, issues, pull requests\.\.\.$/i.test(normalized)) return null;
  return normalized;
}

function formatRecorderAction(action: string): string {
  switch (action) {
    case "click":
      return "Clicked";
    case "input":
      return "Typed";
    case "change":
      return "Changed";
    case "select":
      return "Selected";
    case "submit":
      return "Submitted";
    case "focus":
      return "Focused";
    case "blur":
      return "Blurred";
    case "scroll":
      return "Scrolled";
    case "keydown":
      return "Pressed key";
    case "navigation":
      return "Navigated";
    default:
      return action;
  }
}

function formatRecorderStepMeta(step: UiRecorderSession["steps"][number]): string {
  const parts = [new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })];
  if (step.selector) parts.push(step.selector);
  if (step.value) parts.push(step.value);
  if (step.key) parts.push(step.key);
  return parts.join(" · ");
}

function formatRecorderStatus(status: UiRecorderSession["status"]): string {
  switch (status) {
    case "generated":
      return "Generated";
    case "review":
      return "Ready for review";
    case "recording":
      return "Recording";
    default:
      return status;
  }
}

function getRecorderGenerateLabel(state: "idle" | "saving_review" | "generating" | "error"): string {
  switch (state) {
    case "saving_review":
      return "Saving Review…";
    case "generating":
      return "Generating…";
    case "error":
      return "Generate Again";
    default:
      return "Generate Outputs";
  }
}

function getRecorderUrlLabel(value: string): string {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search ? "?" : ""}`;
    return `${url.hostname}${path}`;
  } catch {
    return value;
  }
}

function UrlCard({ label, value }: { label: string; value: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="recorder-url-card">
      <div className="recorder-url-head">
        <span className="debug-key">{label}</span>
        <div className="row-actions recorder-url-actions">
          <Button variant="ghost" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Collapse" : "Expand"}
          </Button>
          <CopyButton text={value} />
          <a className="recorder-url-open" href={value} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
      </div>
      <div className={`recorder-url-value${expanded ? " expanded" : ""}`} title={value}>
        {expanded ? value : getRecorderUrlLabel(value)}
      </div>
    </div>
  );
}

// ── Copy button with "Copied!" feedback ──
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button className={`manual-case-copy${copied ? " copied" : ""}`} onClick={() => void handleCopy()}>
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Model options including Claude ──
const MODEL_OPTIONS = [
  { group: "Anthropic", options: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"] },
  { group: "OpenAI",    options: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"] },
] as const;

const DEFAULT_RECORDER_GENERATION_OPTIONS: UiRecorderGenerationOptions = {
  includeVision: false,
  includePageSummaries: true,
};

export default function App() {
  const [settings, setSettings]             = useState<SettingsLatest>(DEFAULT_SETTINGS);
  const [tab, setTab]                       = useState<"review" | "sessions" | "settings">("review");
  const [recorder, setRecorder]             = useState<{ active: boolean; startedAt?: string; domain?: string; sessionId?: string }>({ active: false });
  const [activeRecorderSession, setActiveRecorderSession] = useState<UiRecorderSession | null>(null);
  const [analysis, setAnalysis]             = useState<AiAnalysisResultV1 | null>(null);
  const [debug, setDebug]                   = useState<AnalyzeDebug | null>(null);
  const [analyzeError, setAnalyzeError]     = useState<string | null>(null);
  const [analyzing, setAnalyzing]           = useState(false);
  const [includeDeepScan, setIncludeDeepScan] = useState(false);
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded]   = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isTrustExpanded, setIsTrustExpanded]     = useState(false);
  const [sessionThreads, setSessionThreads] = useState<AnalysisSessionThread[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AnalysisSessionRun | null>(null);
  const [sessionsNav, dispatchSessionsNav] = useReducer(sessionsNavReducer, {
    mode: "repos",
    selectedRepo: null,
    selectedSessionId: null,
  });
  const [sessionsSurface, setSessionsSurface] = useState<"analysis" | "recorder">("analysis");
  const [recorderGroups, setRecorderGroups] = useState<UiRecorderSessionGroup[]>([]);
  const [recorderSessionsError, setRecorderSessionsError] = useState<string | null>(null);
  const [selectedRecorderSession, setSelectedRecorderSession] = useState<UiRecorderSession | null>(null);
  const [recorderDetailTab, setRecorderDetailTab] = useState<"overview" | "steps" | "results">("overview");
  const [recorderGenerationOptions, setRecorderGenerationOptions] = useState<UiRecorderGenerationOptions>(DEFAULT_RECORDER_GENERATION_OPTIONS);
  const [recorderRequestState, setRecorderRequestState] = useState<"idle" | "saving_review" | "generating" | "error">("idle");
  const [recorderNav, dispatchRecorderNav] = useReducer(recorderNavReducer, {
    mode: "domains",
    selectedDomain: null,
    selectedSessionId: null,
  });
  const debugDetailsRef = useRef<HTMLDivElement | null>(null);

  async function refreshActiveRecorderSession(sessionId: string): Promise<UiRecorderSession | null> {
    const response = await sendMessage<{ ok: boolean; session: UiRecorderSession | null }>({
      type: "recorder.session.get",
      payload: { sessionId },
    });
    if (!response.ok) return null;
    setActiveRecorderSession(response.session);
    return response.session;
  }

  useEffect(() => {
    void (async () => {
      const loaded = await sendMessage<{ ok: boolean; settings: SettingsLatest }>({ type: "settings.load" });
      if (loaded.ok) {
        setSettings(loaded.settings);
        setIncludeDeepScan(loaded.settings.analysis.deepScanDefault);
      }
      const status = await sendMessage<{ ok: boolean; state: { active: boolean; startedAt: string; domain: string; sessionId: string } | null }>({ type: "recorder.status" });
      if (status.ok && status.state) {
        setRecorder({
          active: status.state.active,
          startedAt: status.state.startedAt,
          domain: status.state.domain,
          sessionId: status.state.sessionId,
        });
        await refreshActiveRecorderSession(status.state.sessionId);
      }
      const intentData = await chrome.storage.local.get("diotest.ui.intent");
      const intent = intentData["diotest.ui.intent"] as "review" | "review_analyze" | "settings" | undefined;
      if (intent === "settings") setTab("settings");
      else setTab("review");
      if (intent === "review_analyze") await runAnalysis(loaded.ok ? loaded.settings.analysis.deepScanDefault : false);
      if (intent) await chrome.storage.local.remove("diotest.ui.intent");
      await refreshSessions();
      await refreshRecorderSessions();
    })();
  }, []);

  useEffect(() => {
    if (!recorder.active) return;
    const t = setInterval(() => {
      setRecorder((r) => ({ ...r }));
      if (recorder.sessionId) {
        void refreshActiveRecorderSession(recorder.sessionId);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [recorder.active, recorder.sessionId]);

  useEffect(() => {
    if (isDebugExpanded) debugDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isDebugExpanded]);

  useEffect(() => {
    setRecorderDetailTab("overview");
    setRecorderGenerationOptions(
      selectedRecorderSession?.lastGenerationOptions
        ? {
            includeVision: selectedRecorderSession.lastGenerationOptions.includeVision,
            includePageSummaries: selectedRecorderSession.lastGenerationOptions.includePageSummaries,
          }
        : DEFAULT_RECORDER_GENERATION_OPTIONS
    );
    setRecorderRequestState("idle");
  }, [selectedRecorderSession?.id]);

  const recordingTime = useMemo(
    () => (recorder.startedAt ? formatElapsed(recorder.startedAt) : "00:00"),
    [recorder]
  );
  const totalSavedRuns = useMemo(
    () => sessionThreads.reduce((total, thread) => total + thread.runCount, 0),
    [sessionThreads]
  );
  const repoGroups = useMemo(() => buildRepoGroups(sessionThreads), [sessionThreads]);
  const runsForSelectedRepo = useMemo(
    () => buildRunsForRepo(sessionThreads, sessionsNav.selectedRepo),
    [sessionThreads, sessionsNav.selectedRepo]
  );
  const recorderSessionsForSelectedDomain = useMemo(
    () => sessionsForDomain(recorderGroups, recorderNav.selectedDomain),
    [recorderGroups, recorderNav.selectedDomain]
  );
  const liveRecorderSteps = useMemo(
    () => [...(activeRecorderSession?.steps ?? [])].slice(-8).reverse(),
    [activeRecorderSession]
  );

  async function refreshSessions() {
    const sessions = await sendMessage<{ ok: boolean; threads?: AnalysisSessionThread[] }>({ type: "sessions.list" });
    if (!sessions.ok || !sessions.threads) {
      setSessionsError("Unable to load saved sessions.");
      return;
    }

    setSessionsError(null);
    setSessionThreads(sessions.threads);

    if (selectedSession) {
      const current = sessions.threads.flatMap((thread) => thread.runs).find((run) => run.id === selectedSession.id) ?? null;
      setSelectedSession(current);
      dispatchSessionsNav({
        type: "sync",
        sessionExists: !!current,
        repoHasRuns: buildRunsForRepo(sessions.threads, sessionsNav.selectedRepo).length > 0,
      });
      return;
    }

    dispatchSessionsNav({
      type: "sync",
      sessionExists: false,
      repoHasRuns: buildRunsForRepo(sessions.threads, sessionsNav.selectedRepo).length > 0,
    });
  }

  async function refreshRecorderSessions() {
    const response = await sendMessage<{ ok: boolean; sessions?: UiRecorderSessionGroup[] }>({ type: "recorder.session.list" });
    if (!response.ok || !response.sessions) {
      setRecorderSessionsError("Unable to load recorder sessions.");
      return;
    }
    setRecorderSessionsError(null);
    setRecorderGroups(response.sessions);
    if (selectedRecorderSession) {
      const current = response.sessions.flatMap((group) => group.sessions).find((session) => session.id === selectedRecorderSession.id) ?? null;
      setSelectedRecorderSession(current);
    }
  }

  async function openSession(sessionId: string) {
    const response = await sendMessage<{ ok: boolean; session: AnalysisSessionRun | null }>({
      type: "sessions.get",
      payload: { sessionId },
    });
    if (!response.ok) {
      setSessionsError("Could not open selected session.");
      return;
    }

    setSelectedSession(response.session);
    if (response.session) {
      dispatchSessionsNav({ type: "open_session", sessionId: response.session.id });
    }
  }

  async function openRecorderSession(sessionId: string) {
    const response = await sendMessage<{ ok: boolean; session: UiRecorderSession | null }>({
      type: "recorder.session.get",
      payload: { sessionId },
    });
    if (!response.ok) {
      setRecorderSessionsError("Could not open recorder session.");
      return;
    }
    setSelectedRecorderSession(response.session);
    if (response.session) {
      dispatchRecorderNav({ type: "open_session", sessionId: response.session.id });
    }
  }

  async function deleteRun(sessionId: string) {
    if (!confirm("Delete this saved run?")) return;
    await sendMessage({ type: "sessions.deleteRun", payload: { sessionId } });
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
      dispatchSessionsNav({ type: "back" });
    }
    await refreshSessions();
  }

  async function deleteRepoThread(repo: string) {
    if (!confirm(`Delete all saved runs for ${repo}?`)) return;
    const repoThreadIds = sessionThreads.filter((thread) => thread.repo === repo).map((thread) => thread.threadId);
    await Promise.all(repoThreadIds.map((threadId) => sendMessage({ type: "sessions.deleteThread", payload: { threadId } })));
    setSelectedSession(null);
    dispatchSessionsNav({ type: "reset" });
    await refreshSessions();
  }

  async function clearAllSessions() {
    if (!confirm("Clear all saved analysis sessions?")) return;
    await sendMessage({ type: "sessions.clearAll" });
    setSelectedSession(null);
    dispatchSessionsNav({ type: "reset" });
    await refreshSessions();
  }

  async function saveRecorderReview(showProgress = false) {
    if (!selectedRecorderSession) return;
    if (showProgress) setRecorderRequestState("saving_review");
    const response = await sendMessage<{ ok: boolean; session: UiRecorderSession | null }>({
      type: "recorder.session.update",
      payload: {
        sessionId: selectedRecorderSession.id,
        steps: selectedRecorderSession.steps.map((step) => ({ id: step.id, title: step.title, kept: step.kept })),
      },
    });
    if (!response.ok || !response.session) {
      setRecorderSessionsError("Unable to save recorder review.");
      if (showProgress) setRecorderRequestState("error");
      return;
    }
    setSelectedRecorderSession(response.session);
    await refreshRecorderSessions();
    if (showProgress) setRecorderRequestState("idle");
  }

  async function generateRecorderOutputs() {
    if (!selectedRecorderSession) return;
    if (recorderRequestState === "saving_review" || recorderRequestState === "generating") return;
    setRecorderSessionsError(null);
    setRecorderRequestState("saving_review");
    const reviewResponse = await sendMessage<{ ok: boolean; session: UiRecorderSession | null }>({
      type: "recorder.session.update",
      payload: {
        sessionId: selectedRecorderSession.id,
        steps: selectedRecorderSession.steps.map((step) => ({ id: step.id, title: step.title, kept: step.kept })),
      },
    });
    if (!reviewResponse.ok || !reviewResponse.session) {
      setRecorderSessionsError("Unable to save recorder review.");
      setRecorderRequestState("error");
      return;
    }
    setSelectedRecorderSession(reviewResponse.session);
    setRecorderRequestState("generating");
    const response = await sendMessage<
      | { ok: false; error: string }
      | { ok: true; session: UiRecorderSession | null }
    >({
      type: "recorder.session.generate",
      payload: {
        sessionId: selectedRecorderSession.id,
        includeVision: recorderGenerationOptions.includeVision,
        includePageSummaries: recorderGenerationOptions.includePageSummaries,
      },
    });
    if (!response.ok || !response.session) {
      setRecorderSessionsError(response.ok ? "Unable to generate recorder outputs." : response.error);
      setRecorderRequestState("error");
      return;
    }
    setSelectedRecorderSession(response.session);
    setRecorderDetailTab("results");
    await refreshRecorderSessions();
    setRecorderRequestState("idle");
  }

  async function deleteRecorderSession(sessionId: string) {
    if (!confirm("Delete this recorder session?")) return;
    await sendMessage({ type: "recorder.session.delete", payload: { sessionId } });
    if (selectedRecorderSession?.id === sessionId) {
      setSelectedRecorderSession(null);
      dispatchRecorderNav({ type: "back" });
    }
    await refreshRecorderSessions();
  }

  async function clearAllRecorderSessions() {
    if (!confirm("Clear all recorder sessions?")) return;
    await sendMessage({ type: "recorder.session.clearAll" });
    setSelectedRecorderSession(null);
    dispatchRecorderNav({ type: "reset" });
    await refreshRecorderSessions();
  }

  async function runAnalysis(scanOverride?: boolean) {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setDebug(null);
    setIsTrustExpanded(false);
    setIsDebugExpanded(false);
    try {
      const targetTabId = await resolveAnalysisTabId();
      if (!targetTabId) {
        setAnalyzeError("Open a GitHub PR or commit page, then run Analyze.");
        return;
      }
      const deepScan = typeof scanOverride === "boolean" ? scanOverride : includeDeepScan;
      const mode: AnalysisMode = deepScan ? "pr_commit_deep_scan" : "pr_commit";
      const result = await sendMessage<
        | { ok: false; error: string }
        | { ok: true; result: AiAnalysisResultV1; debug: AnalyzeDebug }
      >({ type: "analysis.run", payload: { tabId: targetTabId, mode, includeDeepScan: deepScan } });
      if (!result.ok) { setAnalyzeError(result.error); return; }
      setAnalysis(result.result);
      setDebug(result.debug);
      await refreshSessions();
    } finally {
      setAnalyzing(false);
    }
  }

  async function onChangeModel(model: string) {
    const next = structuredClone(settings);
    next.analysis.model = model;
    const result = await sendMessage<{ ok: boolean; settings?: SettingsLatest; errors?: Record<string, string> }>({
      type: "settings.save",
      payload: next,
    });
    if (result.ok && result.settings) { setSettings(result.settings); return; }
    setAnalyzeError("Could not save model selection. Check Settings.");
  }

  async function startRecorder() {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active?.id || !active.url) return;
    const domain = new URL(active.url).hostname;
    const res = await sendMessage<{ ok: boolean; session?: { startedAt: string; domain: string; sessionId: string }; error?: string }>({
      type: "recorder.start",
      payload: { tabId: active.id, domain, flow: "Recorded Flow" },
    });
    if (res.ok && res.session) {
      setRecorder({
        active: true,
        startedAt: res.session.startedAt,
        domain: res.session.domain,
        sessionId: res.session.sessionId,
      });
      await refreshActiveRecorderSession(res.session.sessionId);
    }
  }

  async function stopRecorder() {
    const result = await sendMessage<{ ok: boolean; session?: UiRecorderSession | null }>({ type: "recorder.stop" });
    setRecorder({ active: false });
    setActiveRecorderSession(null);
    await refreshRecorderSessions();
    if (result.ok && result.session) {
      setSessionsSurface("recorder");
      setTab("sessions");
      setSelectedRecorderSession(result.session);
      dispatchRecorderNav({ type: "open_domain", domain: result.session.domain });
      dispatchRecorderNav({ type: "open_session", sessionId: result.session.id });
    }
  }

  // Build flat test plan list for cleaner rendering
  const testPlanItems = useMemo(() => {
    if (!analysis) return [];
    return [
      ...analysis.test_plan.unit.map((t) => ({ ...t, type: "unit" as const })),
      ...analysis.test_plan.integration.map((t) => ({ ...t, type: "integration" as const })),
      ...analysis.test_plan.e2e.map((t) => ({ ...t, type: "e2e" as const })),
    ];
  }, [analysis]);

  const scoreClass = analysis ? getRiskClass(analysis.risk_score) : "score-low";
  const scoreLabel = analysis ? getRiskLabel(analysis.risk_score) : "";

  function renderRecorderPanel() {
    return (
      <div className="panel-card">
        <div className="panel-head-row">
          <div>
            <h3 style={{ marginBottom: 4 }}>UI Recorder</h3>
            <div className="sessions-toolbar-meta">
              {recorder.active
                ? "Live action log while recording. Stop to review and generate tests."
                : "Capture clicks, scrolls, typing, and navigation from the active page."}
            </div>
          </div>
          {recorder.active ? (
            <Button variant="secondary" onClick={() => void stopRecorder()}>Stop & Review</Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void startRecorder()}
              disabled={settings.safeMode.enabled}
            >
              Start Recording
            </Button>
          )}
        </div>

        {recorder.active ? (
          <>
            <div className="recorder-live-shell">
              <div className="recorder-live-summary">
                <div className="recorder-live">
                  <div className="recorder-dot" />
                  <span className="recorder-meta">
                    Recording <span className="recorder-time">{recordingTime}</span>
                    {recorder.domain ? ` · ${recorder.domain}` : ""}
                  </span>
                </div>
                <div className="status-chip-row">
                  <span className="chip">{activeRecorderSession?.steps.length ?? 0} events</span>
                  <span className="chip">{activeRecorderSession?.screenshotsCaptured ?? 0} screenshots</span>
                </div>
              </div>

              <div className="recorder-live-log">
                {liveRecorderSteps.length > 0 ? (
                  liveRecorderSteps.map((step) => (
                    <div key={step.id} className="recorder-live-item">
                      <div className="recorder-live-item-top">
                        <span className={`recorder-action-chip recorder-action-${step.action}`}>{formatRecorderAction(step.action)}</span>
                        <span className="recorder-live-time">
                          {new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <div className="recorder-live-title">{step.title}</div>
                      <div className="recorder-live-meta">{formatRecorderStepMeta(step)}</div>
                    </div>
                  ))
                ) : (
                  <div className="sessions-empty recorder-live-empty">
                    <div className="sessions-empty-title">Waiting for actions</div>
                    <div className="sessions-empty-desc">
                      Click, scroll, type, or navigate on the current page and the log will update here.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="recorder-idle-state">
            <div className="sessions-empty-desc">
              After you stop recording, DioTest opens a review screen with the captured page actions and generates manual cases from the kept steps.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="brand-wrap">
          <h1 className="app-title">DioTest</h1>
          <p className="app-subtitle">AI-first PR analysis</p>
        </div>
        <span className="brand-badge">Community</span>
      </header>

      {/* Tabs */}
      <nav className="tab-row" aria-label="DioTest sections">
        <Button
          className="tab-pill"
          variant={tab === "review" ? "default" : "ghost"}
          onClick={() => setTab("review")}
        >
          Review
        </Button>
        <Button
          className="tab-pill"
          variant={tab === "sessions" ? "default" : "ghost"}
          onClick={() => setTab("sessions")}
        >
          Sessions
        </Button>
        <Button
          className="tab-pill"
          variant={tab === "settings" ? "default" : "ghost"}
          onClick={() => setTab("settings")}
        >
          Settings
        </Button>
      </nav>

      {/* Content */}
      <section className="content-scroll">

        {/* ── REVIEW TAB ── */}
        {tab === "review" && (
          <div className="section-stack">

            {/* Analyze bar */}
            <div className="panel-card">
              <div className="analyze-bar">
                <div className="analyze-top-row">
                  <Button
                    className="analyze-btn"
                    onClick={() => void runAnalysis()}
                    disabled={analyzing}
                  >
                    {analyzing ? "Analyzing…" : "Analyze PR / Commit"}
                  </Button>
                  <select
                    className="model-select"
                    value={settings.analysis.model}
                    onChange={(e) => void onChangeModel(e.target.value)}
                  >
                    {MODEL_OPTIONS.map(({ group, options }) => (
                      <optgroup key={group} label={group}>
                        {options.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <label className="deep-scan-row">
                  <Checkbox
                    checked={includeDeepScan}
                    onChange={(e) => setIncludeDeepScan(e.target.checked)}
                  />
                  <span className="deep-scan-label">Include deep scan</span>
                  <span className="deep-scan-hint">+GitHub API context</span>
                </label>
              </div>
            </div>

            {/* Error */}
            {analyzeError && <div className="warning-banner">{analyzeError}</div>}

            {/* Analyzing state */}
            {analyzing && (
              <div className="panel-card">
                <div className="analyzing-state">
                  <div className="spinner" />
                  <span className="analyzing-label">Running analysis…</span>
                </div>
              </div>
            )}

            {/* Results */}
            {analysis && !analyzing && (
              <>
                {/* Status chips */}
                <div className="status-chip-row">
                  <span className="chip">Coverage: {analysis.meta.coverage_level}</span>
                  <span className={`chip quality-${debug?.request_inspector.analysis_quality ?? "full"}`}>
                    Quality: {debug?.request_inspector.analysis_quality ?? "full"}
                  </span>
                  <span className="chip">Files: {debug?.request_inspector.files_sent_to_ai ?? 0}</span>
                  <span className="chip">~{debug?.token_estimate ?? 0} tokens</span>
                </div>

                {/* Risk */}
                <div className="panel-card">
                  <h3>Risk</h3>
                  <div className="risk-score-block">
                    <div className={`risk-score-number ${scoreClass}`}>
                      {analysis.risk_score.toFixed(1)}
                    </div>
                    <div className="risk-score-meta">
                      <span className="risk-score-label">{scoreLabel}</span>
                      <div className="risk-score-bar">
                        <div
                          className={`risk-score-fill ${scoreClass}`}
                          style={{ width: `${(analysis.risk_score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trust signal — AI vs deterministic */}
                  {debug?.risk_formula && (
                    <>
                      <div className="trust-row" onClick={() => setIsTrustExpanded((v) => !v)}>
                        <span className="trust-label">Why this score</span>
                        <span className={`trust-pill trust-ai`}>AI {debug.risk_formula.ai_score.toFixed(1)}</span>
                        <span className="trust-sep">+</span>
                        <span className={`trust-pill trust-det`}>Rules {debug.risk_formula.deterministic_score.toFixed(1)}</span>
                        <span className="trust-arrow">{isTrustExpanded ? "▲" : "▼"}</span>
                      </div>
                      {isTrustExpanded && (
                        <div className="trust-drivers">
                          {debug.risk_formula.drivers.map((d, i) => (
                            <div key={i} className="trust-driver">{d}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="risk-list">
                    {analysis.risk_areas.map((risk, idx) => (
                      <div key={`${risk.area}-${idx}`} className="risk-item">
                        <div className="risk-item-header">
                          <span className={`severity-badge severity-${risk.severity}`}>
                            {risk.severity.toUpperCase()}
                          </span>
                          <span className="risk-area-name">{risk.area}</span>
                        </div>
                        <div className="risk-why">{risk.why}</div>
                        {risk.evidence_files.length > 0 && (
                          <div className="risk-files">{risk.evidence_files.join(", ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test Plan */}
                <div className="panel-card">
                  <h3>Test Plan</h3>
                  <div className="test-plan-list">
                    {testPlanItems.map((item, i) => (
                      <div key={i} className="test-plan-item">
                        <span className={`test-type-tag tag-${item.type}`}>
                          {item.type === "e2e" ? "E2E" : item.type === "unit" ? "Unit" : "Integ."}
                        </span>
                        <span className="test-item-title">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manual Cases */}
                <div className="panel-card">
                  <h3>Manual Cases</h3>
                  <div className="manual-list">
                    {analysis.manual_test_cases.map((tc) => {
                      const why = (tc as { why?: string }).why;
                      const files = (tc as { evidence_files?: string[] }).evidence_files ?? [];
                      const copyContent = [
                        `**${tc.id}: ${tc.title}**`,
                        why && why !== "Suggested from changed-file risk context." ? `Why: ${why}` : "",
                        files.length ? `Evidence: ${files.join(", ")}` : "",
                      ].filter(Boolean).join("\n");

                      return (
                        <div key={tc.id} className="manual-case">
                          <div className="manual-case-header">
                            <span className="manual-case-id">{tc.id}</span>
                            <span className="manual-case-title">{tc.title}</span>
                            <CopyButton text={copyContent} />
                          </div>
                          {why && why !== "Suggested from changed-file risk context." && (
                            <div className="manual-case-why">{why}</div>
                          )}
                          {files.length > 0 && (
                            <div className="manual-case-files">{files.join(", ")}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Debug */}
                <div className="panel-card">
                  <div className="panel-head-row">
                    <h3 style={{ marginBottom: 0 }}>Debug</h3>
                    <Button
                      variant="ghost"
                      aria-expanded={isDebugExpanded}
                      onClick={() => {
                        setIsDebugExpanded((v) => {
                          const next = !v;
                          if (!next) { setIsPromptExpanded(false); setIsContextExpanded(false); }
                          return next;
                        });
                      }}
                    >
                      {isDebugExpanded ? "Collapse" : "Expand"}
                    </Button>
                  </div>

                  {debug && (
                    <div className="debug-grid" style={{ marginTop: 10 }}>
                      <div className="debug-row"><span className="debug-key">Mode</span><span className="debug-val">{debug.request_inspector.mode}</span></div>
                      <div className="debug-row"><span className="debug-key">Source</span><span className="debug-val">{debug.request_inspector.extraction_source}</span></div>
                      <div className="debug-row"><span className="debug-key">Files detected</span><span className="debug-val">{debug.request_inspector.files_detected}</span></div>
                      <div className="debug-row"><span className="debug-key">Files sent</span><span className="debug-val">{debug.request_inspector.files_sent_to_ai}</span></div>
                      <div className="debug-row"><span className="debug-key">Cases kept</span><span className="debug-val">{debug.request_inspector.manual_cases_kept} / {debug.request_inspector.manual_cases_generated}</span></div>
                      <div className="debug-row"><span className="debug-key">Deep scan</span><span className="debug-val">{String(debug.request_inspector.deep_scan_used)}</span></div>
                    </div>
                  )}

                  {debug?.warnings.length ? (
                    <div className="warning-banner" style={{ marginTop: 8 }}>{debug.warnings.join(" | ")}</div>
                  ) : null}

                  {isDebugExpanded && debug && (
                    <div style={{ marginTop: 10 }} ref={debugDetailsRef}>
                      {debug.request_inspector.dropped_files_summary.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div className="debug-key" style={{ marginBottom: 6 }}>Dropped files</div>
                          {debug.request_inspector.dropped_files_summary.map((item, i) => (
                            <div key={i} className="trust-driver">{item.path} — {item.reason}</div>
                          ))}
                        </div>
                      )}
                      {debug.request_inspector.normalization_flags_applied.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div className="debug-key" style={{ marginBottom: 6 }}>Guardrails applied</div>
                          {debug.request_inspector.normalization_flags_applied.map((flag, i) => (
                            <div key={i} className="trust-driver">{flag}</div>
                          ))}
                        </div>
                      )}

                      <div className="panel-head-row">
                        <span className="debug-key">Prompt preview</span>
                        <div className="row-actions">
                          <Button variant="ghost" onClick={() => setIsPromptExpanded((v) => !v)}>
                            {isPromptExpanded ? "Less" : "More"}
                          </Button>
                          <Button variant="secondary" onClick={() => void copyText(debug.request_inspector.prompt_preview)}>
                            Copy
                          </Button>
                        </div>
                      </div>
                      <CodeViewer value={debug.request_inspector.prompt_preview} language="text" expanded={isPromptExpanded} />

                      <div className="panel-head-row" style={{ marginTop: 10 }}>
                        <span className="debug-key">Context summary</span>
                        <div className="row-actions">
                          <Button variant="ghost" onClick={() => setIsContextExpanded((v) => !v)}>
                            {isContextExpanded ? "Less" : "More"}
                          </Button>
                          <Button variant="secondary" onClick={() => void copyText(debug.context_summary)}>
                            Copy
                          </Button>
                        </div>
                      </div>
                      <CodeViewer value={debug.context_summary} language="text" expanded={isContextExpanded} />
                    </div>
                  )}
                </div>

                {renderRecorderPanel()}
              </>
            )}

            {/* Empty state — no analysis yet */}
            {!analysis && !analyzing && !analyzeError && (
              <div className="panel-card">
                <div className="empty-state">
                  <div className="empty-icon">⬡</div>
                  <div className="empty-title">No analysis yet</div>
                  <div className="empty-desc">
                    Open a GitHub PR or commit, then hit Analyze.
                  </div>
                </div>
              </div>
            )}

            {/* UI Recorder — show even before analysis */}
            {!analysis && !analyzing && renderRecorderPanel()}
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === "sessions" && (
          <div className="section-stack">
            <div className="panel-card">
              <div className="sessions-toolbar">
                <div>
                  <h3 style={{ marginBottom: 4 }}>Sessions</h3>
                  <div className="sessions-toolbar-meta">
                    {sessionsSurface === "analysis"
                      ? `${totalSavedRuns} saved analysis run${totalSavedRuns === 1 ? "" : "s"}`
                      : `${recorderGroups.reduce((count, group) => count + group.sessionCount, 0)} recorded session${recorderGroups.reduce((count, group) => count + group.sessionCount, 0) === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="row-actions">
                  <Button
                    className="session-surface-toggle"
                    variant={sessionsSurface === "analysis" ? "secondary" : "ghost"}
                    onClick={() => setSessionsSurface("analysis")}
                  >
                    Analysis
                  </Button>
                  <Button
                    className="session-surface-toggle"
                    variant={sessionsSurface === "recorder" ? "secondary" : "ghost"}
                    onClick={() => setSessionsSurface("recorder")}
                  >
                    Recorder
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void (sessionsSurface === "analysis" ? refreshSessions() : refreshRecorderSessions())}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void (sessionsSurface === "analysis" ? clearAllSessions() : clearAllRecorderSessions())}
                    disabled={sessionsSurface === "analysis" ? !totalSavedRuns : recorderGroups.length === 0}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {sessionsSurface === "analysis" ? (
                <>
                  <div className="sessions-breadcrumb">
                    Sessions
                    {sessionsNav.selectedRepo ? ` / ${sessionsNav.selectedRepo}` : ""}
                    {selectedSession ? ` / ${selectedSession.ref}` : ""}
                  </div>

                  {sessionsError ? <div className="warning-banner">{sessionsError}</div> : null}

                  {!sessionsError && totalSavedRuns === 0 ? (
                    <div className="sessions-empty">
                      <div className="empty-icon">◫</div>
                      <div className="sessions-empty-title">No analysis sessions yet</div>
                      <div className="sessions-empty-desc">
                        Run Analyze in the Review tab and each result will be saved here automatically.
                      </div>
                    </div>
                  ) : null}

                  {!sessionsError && totalSavedRuns > 0 && sessionsNav.mode !== "repos" ? (
                    <div className="sessions-nav-row">
                      <Button variant="ghost" onClick={() => dispatchSessionsNav({ type: "back" })}>Back</Button>
                      {sessionsNav.selectedRepo ? <div className="sessions-nav-chip">{sessionsNav.selectedRepo}</div> : null}
                    </div>
                  ) : null}

                  {!sessionsError && totalSavedRuns > 0 && sessionsNav.mode === "repos" ? (
                    <div className="sessions-list">
                      {repoGroups.map((repo) => (
                        <button
                          key={repo.repo}
                          className="sessions-row"
                          onClick={() => dispatchSessionsNav({ type: "open_repo", repo: repo.repo })}
                        >
                          <div className="sessions-row-top">
                            <div className="sessions-row-title">{repo.repo}</div>
                            <div className="sessions-row-chip">{repo.runCount} run{repo.runCount === 1 ? "" : "s"}</div>
                          </div>
                          <div className="sessions-row-subtle">Last scanned {new Date(repo.lastUpdatedAt).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!sessionsError && totalSavedRuns > 0 && sessionsNav.mode === "runs" ? (
                    <div className="sessions-list">
                      {runsForSelectedRepo.map((run) => (
                        <button key={run.id} className="sessions-row" onClick={() => void openSession(run.id)}>
                          {cleanSessionTitle(run.title) ? <div className="sessions-run-heading">{cleanSessionTitle(run.title)}</div> : null}
                          <div className="sessions-run-line">
                            <div className="sessions-row-title">{run.pageType === "pull_request" ? `PR #${run.ref}` : run.ref.slice(0, 12)}</div>
                            <div className="sessions-row-chip">Score {run.riskScore.toFixed(1)}</div>
                          </div>
                          <div className="sessions-row-subtle">{new Date(run.createdAt).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="sessions-breadcrumb">
                    Recorder
                    {recorderNav.selectedDomain ? ` / ${recorderNav.selectedDomain}` : ""}
                    {selectedRecorderSession ? ` / ${selectedRecorderSession.name}` : ""}
                  </div>

                  {recorderSessionsError ? <div className="warning-banner">{recorderSessionsError}</div> : null}

                  {!recorderSessionsError && recorderGroups.length === 0 ? (
                    <div className="sessions-empty">
                      <div className="empty-icon">◎</div>
                      <div className="sessions-empty-title">No recorder sessions yet</div>
                      <div className="sessions-empty-desc">
                        Start recording from the Review tab, then stop to open the step review flow here.
                      </div>
                    </div>
                  ) : null}

                  {!recorderSessionsError && recorderGroups.length > 0 && recorderNav.mode !== "domains" ? (
                    <div className="sessions-nav-row">
                      <Button variant="ghost" onClick={() => dispatchRecorderNav({ type: "back" })}>Back</Button>
                      {recorderNav.selectedDomain ? <div className="sessions-nav-chip">{recorderNav.selectedDomain}</div> : null}
                    </div>
                  ) : null}

                  {!recorderSessionsError && recorderGroups.length > 0 && recorderNav.mode === "domains" ? (
                    <div className="sessions-list">
                      {recorderGroups.map((group) => (
                        <button
                          key={group.domain}
                          className="sessions-row"
                          onClick={() => dispatchRecorderNav({ type: "open_domain", domain: group.domain })}
                        >
                          <div className="sessions-row-top">
                            <div className="sessions-row-title">{group.domain}</div>
                            <div className="sessions-row-chip">{group.sessionCount} session{group.sessionCount === 1 ? "" : "s"}</div>
                          </div>
                          <div className="sessions-row-subtle">Last recorded {new Date(group.lastUpdatedAt).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!recorderSessionsError && recorderGroups.length > 0 && recorderNav.mode === "sessions" ? (
                    <div className="sessions-list">
                      {recorderSessionsForSelectedDomain.map((session) => (
                        <button key={session.id} className="sessions-row" onClick={() => void openRecorderSession(session.id)}>
                          <div className="sessions-run-heading">{session.name}</div>
                          <div className="sessions-run-line">
                            <div className="sessions-row-title">{formatRecorderStatus(session.status)}</div>
                            <div className="sessions-row-chip">{session.steps.length} step{session.steps.length === 1 ? "" : "s"}</div>
                          </div>
                          <div className="sessions-row-subtle">{new Date(session.startedAt).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {sessionsSurface === "analysis" && !sessionsError && sessionsNav.mode === "detail" && selectedSession ? (
              <div className="panel-card">
                <div className="panel-head-row">
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{cleanSessionTitle(selectedSession.title) ?? "Saved Run"}</h3>
                    <div className="sessions-toolbar-meta">{selectedSession.repo} / {selectedSession.ref}</div>
                  </div>
                  <div className="row-actions">
                    <Button variant="ghost" onClick={() => void deleteRepoThread(selectedSession.repo)}>Delete Repo</Button>
                    <Button variant="ghost" onClick={() => void deleteRun(selectedSession.id)}>Delete Run</Button>
                  </div>
                </div>

                <div className="status-chip-row">
                  <span className="chip">Score: {selectedSession.riskScore.toFixed(1)}</span>
                  <span className={`chip quality-${selectedSession.analysisQuality}`}>Quality: {selectedSession.analysisQuality}</span>
                  <span className="chip">Coverage: {selectedSession.coverageLevel}</span>
                  <span className="chip">{selectedSession.pageType === "pull_request" ? "PR" : "Commit"}</span>
                </div>

                <div className="sessions-detail-meta">Scanned {new Date(selectedSession.createdAt).toLocaleString()}</div>

                <div className="sessions-detail-section">
                  <h4>Risk Areas</h4>
                  <div className="risk-list">
                    {selectedSession.riskAreas.map((risk, index) => (
                      <div key={`${risk.area}-${index}`} className="risk-item">
                        <div className="risk-item-header">
                          <span className={`severity-badge severity-${risk.severity}`}>{risk.severity.toUpperCase()}</span>
                          <span className="risk-area-name">{risk.area}</span>
                        </div>
                        <div className="risk-why">{risk.why}</div>
                        {risk.evidence_files.length > 0 ? <div className="risk-files">{risk.evidence_files.join(", ")}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sessions-detail-section">
                  <h4>Test Plan</h4>
                  <div className="test-plan-list">
                    {selectedSession.testPlan.unit.map((item, index) => (
                      <div key={`session-unit-${index}`} className="test-plan-item">
                        <span className="test-type-tag tag-unit">Unit</span>
                        <span className="test-item-title">{item.title}</span>
                      </div>
                    ))}
                    {selectedSession.testPlan.integration.map((item, index) => (
                      <div key={`session-int-${index}`} className="test-plan-item">
                        <span className="test-type-tag tag-integration">Integ.</span>
                        <span className="test-item-title">{item.title}</span>
                      </div>
                    ))}
                    {selectedSession.testPlan.e2e.map((item, index) => (
                      <div key={`session-e2e-${index}`} className="test-plan-item">
                        <span className="test-type-tag tag-e2e">E2E</span>
                        <span className="test-item-title">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sessions-detail-section">
                  <h4>Manual Cases</h4>
                  <div className="manual-list">
                    {selectedSession.manualTestCases.map((testCase) => (
                      <div key={testCase.id} className="manual-case">
                        <div className="manual-case-header">
                          <span className="manual-case-id">{testCase.id}</span>
                          <span className="manual-case-title">{testCase.title}</span>
                        </div>
                        <div className="manual-case-why">{testCase.why}</div>
                        {testCase.evidence_files.length > 0 ? <div className="manual-case-files">{testCase.evidence_files.join(", ")}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sessions-detail-section">
                  <h4>Debug</h4>
                  <div className="debug-grid">
                    <div className="debug-row"><span className="debug-key">Files detected</span><span className="debug-val">{selectedSession.debug.filesDetected}</span></div>
                    <div className="debug-row"><span className="debug-key">Files sent</span><span className="debug-val">{selectedSession.debug.filesSent}</span></div>
                    <div className="debug-row"><span className="debug-key">Deep scan</span><span className="debug-val">{String(selectedSession.debug.deepScanUsed)}</span></div>
                    <div className="debug-row"><span className="debug-key">Source</span><span className="debug-val">{selectedSession.debug.extractionSource}</span></div>
                  </div>
                  {selectedSession.debug.warnings.length > 0 ? (
                    <div className="warning-banner">{selectedSession.debug.warnings.join(" | ")}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {sessionsSurface === "recorder" && !recorderSessionsError && recorderNav.mode === "detail" && selectedRecorderSession ? (
              <div className="panel-card">
                <div className="recorder-detail-shell">
                  <div className="recorder-detail-header">
                    <div className="recorder-detail-titleblock">
                      <h3 style={{ marginBottom: 4 }}>{selectedRecorderSession.name}</h3>
                      <div className="sessions-toolbar-meta">{selectedRecorderSession.domain}</div>
                    </div>
                    <div className="row-actions recorder-detail-actions">
                      <Button variant="ghost" onClick={() => dispatchRecorderNav({ type: "back" })}>Back</Button>
                      <Button
                        variant="ghost"
                        onClick={() => void saveRecorderReview(true)}
                        disabled={recorderRequestState === "saving_review" || recorderRequestState === "generating"}
                      >
                        {recorderRequestState === "saving_review" ? "Saving…" : "Save Review"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void generateRecorderOutputs()}
                        disabled={selectedRecorderSession.steps.filter((step) => step.kept).length === 0 || recorderRequestState === "saving_review" || recorderRequestState === "generating"}
                      >
                        {getRecorderGenerateLabel(recorderRequestState)}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void deleteRecorderSession(selectedRecorderSession.id)}
                        disabled={recorderRequestState === "saving_review" || recorderRequestState === "generating"}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="status-chip-row">
                    <span className="chip">{formatRecorderStatus(selectedRecorderSession.status)}</span>
                    <span className="chip">{selectedRecorderSession.steps.length} steps</span>
                    <span className="chip">{selectedRecorderSession.steps.filter((step) => step.kept).length} kept</span>
                    <span className="chip">{selectedRecorderSession.screenshotsCaptured} screenshots</span>
                    <span className="chip">{selectedRecorderSession.pageSummaries?.length ?? 0} page summaries</span>
                  </div>

                  <div className="sessions-detail-meta">
                    Started {new Date(selectedRecorderSession.startedAt).toLocaleString()}
                    {selectedRecorderSession.stoppedAt ? ` · Stopped ${new Date(selectedRecorderSession.stoppedAt).toLocaleString()}` : ""}
                  </div>

                  <div className="recorder-detail-tabs">
                    <button
                      className={`recorder-detail-tab${recorderDetailTab === "overview" ? " active" : ""}`}
                      onClick={() => setRecorderDetailTab("overview")}
                    >
                      Overview
                    </button>
                    <button
                      className={`recorder-detail-tab${recorderDetailTab === "steps" ? " active" : ""}`}
                      onClick={() => setRecorderDetailTab("steps")}
                    >
                      Steps
                    </button>
                    <button
                      className={`recorder-detail-tab${recorderDetailTab === "results" ? " active" : ""}`}
                      onClick={() => setRecorderDetailTab("results")}
                    >
                      Results
                    </button>
                  </div>

                  <div className="recorder-generate-controls">
                    <label className="checkbox-field recorder-generate-option">
                      <Checkbox
                        checked={recorderGenerationOptions.includeVision}
                        onChange={(e) => setRecorderGenerationOptions((current) => ({ ...current, includeVision: e.target.checked }))}
                        disabled={recorderRequestState === "saving_review" || recorderRequestState === "generating"}
                      />
                      <div className="checkbox-field-body">
                        <span className="checkbox-field-label">Analyze screenshots</span>
                        <span className="checkbox-field-desc">Use screenshot pixels to understand visible UI state during generation.</span>
                      </div>
                    </label>
                    <label className="checkbox-field recorder-generate-option">
                      <Checkbox
                        checked={recorderGenerationOptions.includePageSummaries}
                        onChange={(e) => setRecorderGenerationOptions((current) => ({ ...current, includePageSummaries: e.target.checked }))}
                        disabled={recorderRequestState === "saving_review" || recorderRequestState === "generating"}
                      />
                      <div className="checkbox-field-body">
                        <span className="checkbox-field-label">Include page summaries</span>
                        <span className="checkbox-field-desc">Pass a lightweight visible-UI summary for each captured page in the flow.</span>
                      </div>
                    </label>
                  </div>

                  {recorderRequestState === "generating" ? (
                    <div className="recorder-request-banner">Generating outputs from reviewed steps, screenshots, and page summaries…</div>
                  ) : null}

                  {recorderDetailTab === "overview" ? (
                    <div className="sessions-detail-section">
                      <div className="recorder-overview-grid">
                        <div className="recorder-overview-metrics">
                          <div className="debug-grid recorder-metric-grid">
                            <div className="debug-row"><span className="debug-key">Status</span><span className="debug-val">{formatRecorderStatus(selectedRecorderSession.status)}</span></div>
                            <div className="debug-row"><span className="debug-key">Steps</span><span className="debug-val">{selectedRecorderSession.steps.length}</span></div>
                            <div className="debug-row"><span className="debug-key">Kept</span><span className="debug-val">{selectedRecorderSession.steps.filter((step) => step.kept).length}</span></div>
                            <div className="debug-row"><span className="debug-key">Screenshots</span><span className="debug-val">{selectedRecorderSession.screenshotsCaptured}</span></div>
                          </div>
                          {selectedRecorderSession.warnings.length > 0 ? (
                            <div className="warning-banner">{selectedRecorderSession.warnings.join(" | ")}</div>
                          ) : null}
                        </div>
                        <div className="recorder-url-stack">
                          <UrlCard label="Start URL" value={selectedRecorderSession.startUrl} />
                          <UrlCard label="Last URL" value={selectedRecorderSession.lastUrl} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {recorderDetailTab === "steps" ? (
                    <div className="sessions-detail-section">
                      <div className="panel-head-row">
                        <h4>Reviewed Steps</h4>
                        <div className="sessions-toolbar-meta">Cleaner labels and reduced noise are already applied here.</div>
                      </div>
                      <div className="recorder-step-list">
                        {selectedRecorderSession.steps.map((step, index) => (
                          <div key={step.id} className={`recorder-step-card${step.kept ? "" : " recorder-step-card-muted"}`}>
                            <div className="recorder-step-top">
                              <span className="recorder-step-index">{index + 1}</span>
                              <label className="recorder-step-keep">
                                <Checkbox
                                  checked={step.kept}
                                  onChange={(e) => {
                                    setSelectedRecorderSession((current) => current ? {
                                      ...current,
                                      steps: current.steps.map((item) => item.id === step.id ? { ...item, kept: e.target.checked } : item),
                                    } : current);
                                  }}
                                />
                                <span>Keep</span>
                              </label>
                            </div>
                            <input
                              className="dt-input"
                              value={step.title}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSelectedRecorderSession((current) => current ? {
                                  ...current,
                                  steps: current.steps.map((item) => item.id === step.id ? { ...item, title: value } : item),
                                } : current);
                              }}
                            />
                            <div className="recorder-step-meta">
                              <span>{formatRecorderAction(step.action)}</span>
                              <span>{new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                              {step.selector ? <span>{step.selector}</span> : null}
                              {step.url ? <span>{getRecorderUrlLabel(step.url)}</span> : null}
                            </div>
                            {step.screenshot ? <img className="recorder-step-image" src={step.screenshot.dataUrl} alt={step.title} /> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {recorderDetailTab === "results" ? (
                    <div className="sessions-detail-section">
                      <div className="recorder-results-summary">
                        <div className="debug-grid recorder-metric-grid">
                          <div className="debug-row"><span className="debug-key">Manual cases</span><span className="debug-val">{selectedRecorderSession.generated?.manual_test_cases.length ?? 0}</span></div>
                          <div className="debug-row"><span className="debug-key">Scenario steps</span><span className="debug-val">{selectedRecorderSession.generated?.playwright_scenario.steps.length ?? 0}</span></div>
                          <div className="debug-row"><span className="debug-key">Flow-derived</span><span className="debug-val">{selectedRecorderSession.generated?.manual_test_cases.filter((testCase) => testCase.source === "flow").length ?? 0}</span></div>
                          <div className="debug-row"><span className="debug-key">Page-derived</span><span className="debug-val">{selectedRecorderSession.generated?.manual_test_cases.filter((testCase) => testCase.source === "page").length ?? 0}</span></div>
                          <div className="debug-row"><span className="debug-key">Vision</span><span className="debug-val">{selectedRecorderSession.lastGenerationOptions?.includeVision ? "on" : "off"}</span></div>
                          <div className="debug-row"><span className="debug-key">Page summaries</span><span className="debug-val">{selectedRecorderSession.lastGenerationOptions?.includePageSummaries !== false ? "on" : "off"}</span></div>
                        </div>
                        <div className="sessions-toolbar-meta">
                          Generated outputs now combine recorded-flow cases with additional visited-page opportunities from page summaries and screenshots.
                        </div>
                      </div>

                      {selectedRecorderSession.generated ? (
                        <>
                          <div className="recorder-generated-block">
                            <h4>Manual Cases</h4>
                            <div className="manual-list">
                              {selectedRecorderSession.generated.manual_test_cases.map((testCase) => (
                                <div key={testCase.id} className="manual-case">
                                  <div className="manual-case-header">
                                    <span className="manual-case-id">{testCase.id}</span>
                                    <span className="manual-case-title">{testCase.title}</span>
                                    {testCase.source ? <span className="sessions-row-chip">{testCase.source}</span> : null}
                                  </div>
                                  <div className="manual-case-why">{testCase.why}</div>
                                  {testCase.evidence_files.length > 0 ? (
                                    <div className="manual-case-files">{testCase.evidence_files.join(", ")}</div>
                                  ) : null}
                                  {testCase.steps.length > 0 ? (
                                    <div className="recorder-generated-list">
                                      {testCase.steps.map((item, index) => (
                                        <div key={`${testCase.id}-step-${index}`} className="trust-driver">{item}</div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="recorder-generated-block">
                            <h4>Playwright Scenario</h4>
                            <div className="recorder-generated-title">{selectedRecorderSession.generated.playwright_scenario.title}</div>
                            <div className="recorder-generated-goal">{selectedRecorderSession.generated.playwright_scenario.goal}</div>
                            <div className="recorder-generated-list">
                              {selectedRecorderSession.generated.playwright_scenario.steps.map((step, index) => (
                                <div key={`${step.action}-${index}`} className="trust-driver">
                                  {[step.action, step.target, step.assertion].filter(Boolean).join(" | ")}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="sessions-empty recorder-results-empty">
                          <div className="sessions-empty-title">No generated outputs yet</div>
                          <div className="sessions-empty-desc">Save your reviewed steps, then generate manual cases and a Playwright scenario from this flow.</div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div className="panel-card">
            <SettingsPanel settings={settings} onSaved={setSettings} />
          </div>
        )}
      </section>
    </main>
  );
}
