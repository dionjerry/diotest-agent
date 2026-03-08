import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SettingsLatest } from "../engine/settings/types";
import { DEFAULT_SETTINGS } from "../engine/settings/defaults";
import { SettingsPanel } from "./components/SettingsPanel";
import { sendMessage } from "./lib/messages";
import { Button } from "./components/ui/button";
import type { AiAnalysisResultV1, AnalyzeDebug, AnalysisMode } from "../engine/analysis/types";
import { CodeViewer } from "./components/CodeViewer";
import { Checkbox } from "./components/ui/checkbox";

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
      if (tab?.id && tab.url?.startsWith("https://github.com/")) {
        return tab.id;
      }
    } catch {
      // ignore stale tab id
    }
  }

  const githubTabs = await chrome.tabs.query({ currentWindow: true, url: ["https://github.com/*/*/pull/*", "https://github.com/*/*/commit/*"] });
  return githubTabs[0]?.id ?? null;
}

export default function App() {
  const [settings, setSettings] = useState<SettingsLatest>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"review" | "sessions" | "settings">("review");
  const [recorder, setRecorder] = useState<{ active: boolean; startedAt?: string; domain?: string }>({ active: false });
  const [analysis, setAnalysis] = useState<AiAnalysisResultV1 | null>(null);
  const [debug, setDebug] = useState<AnalyzeDebug | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [includeDeepScan, setIncludeDeepScan] = useState(false);
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const debugDetailsRef = useRef<HTMLDivElement | null>(null);

  const modelOptions = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"] as const;

  useEffect(() => {
    void (async () => {
      const loaded = await sendMessage<{ ok: boolean; settings: SettingsLatest }>({ type: "settings.load" });
      if (loaded.ok) {
        setSettings(loaded.settings);
        setIncludeDeepScan(loaded.settings.analysis.deepScanDefault);
      }

      const status = await sendMessage<{ ok: boolean; state: { active: boolean; startedAt: string; domain: string } | null }>({ type: "recorder.status" });
      if (status.ok && status.state) {
        setRecorder({ active: status.state.active, startedAt: status.state.startedAt, domain: status.state.domain });
      }

      const intentData = await chrome.storage.local.get("diotest.ui.intent");
      const intent = intentData["diotest.ui.intent"] as "review" | "review_analyze" | "settings" | undefined;
      if (intent === "settings") {
        setTab("settings");
      } else {
        setTab("review");
      }
      if (intent === "review_analyze") {
        await runAnalysis(loaded.ok ? loaded.settings.analysis.deepScanDefault : false);
      }
      if (intent) {
        await chrome.storage.local.remove("diotest.ui.intent");
      }
    })();
  }, []);

  useEffect(() => {
    if (!recorder.active) return;
    const t = setInterval(() => setRecorder((r) => ({ ...r })), 1000);
    return () => clearInterval(t);
  }, [recorder.active]);

  useEffect(() => {
    if (isDebugExpanded) {
      debugDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isDebugExpanded]);

  const recordingTime = useMemo(() => (recorder.startedAt ? formatElapsed(recorder.startedAt) : "00:00"), [recorder]);

  async function runAnalysis(scanOverride?: boolean) {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setDebug(null);

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
      >({
        type: "analysis.run",
        payload: {
          tabId: targetTabId,
          mode,
          includeDeepScan: deepScan
        }
      });

      if (!result.ok) {
        setAnalyzeError(result.error);
        return;
      }

      setAnalysis(result.result);
      setDebug(result.debug);
    } finally {
      setAnalyzing(false);
    }
  }

  async function onChangeModel(model: string) {
    const next = structuredClone(settings);
    next.analysis.model = model;

    const result = await sendMessage<{ ok: boolean; settings?: SettingsLatest; errors?: Record<string, string> }>({
      type: "settings.save",
      payload: next
    });

    if (result.ok && result.settings) {
      setSettings(result.settings);
      return;
    }

    setAnalyzeError("Could not save model selection. Check Settings.");
  }

  async function startRecorder() {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active?.id || !active.url) return;
    const domain = new URL(active.url).hostname;
    const res = await sendMessage<{ ok: boolean; session?: { startedAt: string; domain: string }; error?: string }>({
      type: "recorder.start",
      payload: { tabId: active.id, domain, flow: "Recorded Flow" }
    });
    if (res.ok && res.session) {
      setRecorder({ active: true, startedAt: res.session.startedAt, domain: res.session.domain });
    }
  }

  async function stopRecorder() {
    await sendMessage({ type: "recorder.stop" });
    setRecorder({ active: false });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-wrap">
          <h1 className="app-title">DioTest</h1>
          <p className="app-subtitle">AI-first analysis for PR/commit context</p>
        </div>
        <span className="brand-badge">Community</span>
      </header>

      <nav className="tab-row" aria-label="DioTest sections">
        <Button className="tab-pill" variant={tab === "review" ? "default" : "secondary"} onClick={() => setTab("review")}>Review</Button>
        <Button className="tab-pill" variant={tab === "sessions" ? "default" : "secondary"} onClick={() => setTab("sessions")}>Sessions</Button>
        <Button className="tab-pill" variant={tab === "settings" ? "default" : "secondary"} onClick={() => setTab("settings")}>Settings</Button>
      </nav>

      <section className="content-scroll">
        {tab === "review" ? (
          <section className="section-stack">
            <div className="control-bar panel-card">
              <label className="toggle-row">
                <Checkbox checked={includeDeepScan} onChange={(e) => setIncludeDeepScan(e.target.checked)} />
                <span>Include Repo Deep Scan (GitHub API)</span>
              </label>
              <label className="model-select-wrap">
                <span>Model</span>
                <select value={settings.analysis.model} onChange={(e) => void onChangeModel(e.target.value)}>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              <Button onClick={() => void runAnalysis()} disabled={analyzing} className="analyze-btn">
                {analyzing ? "Analyzing..." : "Analyze PR/Commit"}
              </Button>
            </div>

            {analyzeError ? <div className="warning-banner">{analyzeError}</div> : null}

            {analysis ? (
              <>
                <div className="status-chip-row">
                  <span className="chip">Coverage: {analysis.meta.coverage_level}</span>
                  <span className="chip">Files sent: {debug?.request_inspector.files_sent_to_ai ?? 0}</span>
                  <span className="chip">Token est: {debug?.token_estimate ?? 0}</span>
                </div>

                <article className="panel-card">
                  <h3>Risk</h3>
                  <p className="metric-line">Score: {analysis.risk_score.toFixed(1)} / 10</p>
                  <ul className="clean-list">
                    {analysis.risk_areas.map((risk, idx) => (
                      <li key={`${risk.area}-${idx}`} className="risk-item">
                        <span className={`severity-badge severity-${risk.severity}`}>{risk.severity.toUpperCase()}</span> {risk.area}
                        <div className="risk-why">{risk.why}</div>
                        <div className="muted-wrap">{risk.evidence_files.join(", ")}</div>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="panel-card">
                  <h3>Test Plan</h3>
                  <div className="plan-grid">
                    <section className="plan-group">
                      <h4>Unit</h4>
                      <ul className="clean-list">{analysis.test_plan.unit.map((t, i) => <li key={`u-${i}`}>{t.title}</li>)}</ul>
                    </section>
                    <section className="plan-group">
                      <h4>Integration</h4>
                      <ul className="clean-list">{analysis.test_plan.integration.map((t, i) => <li key={`i-${i}`}>{t.title}</li>)}</ul>
                    </section>
                    <section className="plan-group">
                      <h4>E2E</h4>
                      <ul className="clean-list">{analysis.test_plan.e2e.map((t, i) => <li key={`e-${i}`}>{t.title}</li>)}</ul>
                    </section>
                  </div>
                </article>

                <article className="panel-card">
                  <h3>Manual Cases</h3>
                  <ul className="clean-list">
                    {analysis.manual_test_cases.map((tc) => (
                      <li key={tc.id}><strong>{tc.id}:</strong> {tc.title}</li>
                    ))}
                  </ul>
                </article>

                <article className="panel-card">
                  <div className="panel-head-row">
                    <h3>Debug</h3>
                    <Button
                      variant="secondary"
                      aria-expanded={isDebugExpanded}
                      onClick={() => {
                        setIsDebugExpanded((v) => {
                          const next = !v;
                          if (!next) {
                            setIsPromptExpanded(false);
                            setIsContextExpanded(false);
                          }
                          return next;
                        });
                      }}
                    >
                      {isDebugExpanded ? "Collapse" : "Expand"}
                    </Button>
                  </div>

                  {debug ? (
                    <div className="debug-grid">
                      <p><strong>Mode:</strong> {debug.request_inspector.mode}</p>
                      <p><strong>Page:</strong> {debug.request_inspector.page_type}</p>
                      <p><strong>Repo:</strong> {debug.request_inspector.repo}</p>
                      <p><strong>Ref:</strong> {debug.request_inspector.ref}</p>
                      <p><strong>Files detected:</strong> {debug.request_inspector.files_detected}</p>
                      <p><strong>Files sent:</strong> {debug.request_inspector.files_sent_to_ai}</p>
                      <p><strong>Deep scan requested:</strong> {String(debug.request_inspector.deep_scan_requested)}</p>
                      <p><strong>Deep scan used:</strong> {String(debug.request_inspector.deep_scan_used)}</p>
                      <p><strong>Screenshots sent:</strong> {String(debug.request_inspector.screenshots_sent)}</p>
                    </div>
                  ) : null}

                  {debug?.warnings.length ? <div className="warning-banner">{debug.warnings.join(" | ")}</div> : null}

                  {debug?.risk_formula ? (
                    <div className="formula-card">
                      <h4>Risk Formula</h4>
                      <p className="muted-wrap">
                        AI {debug.risk_formula.ai_score.toFixed(1)} · Deterministic {debug.risk_formula.deterministic_score.toFixed(1)} · Final {debug.risk_formula.final_score.toFixed(1)}
                      </p>
                      <ul className="clean-list">
                        {debug.risk_formula.drivers.map((driver, index) => (
                          <li key={`${driver}-${index}`}>{driver}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {isDebugExpanded && debug ? (
                    <div className="debug-sections" ref={debugDetailsRef}>
                      <div className="panel-head-row">
                        <h4>Prompt Preview</h4>
                        <div className="row-actions">
                          <Button variant="ghost" onClick={() => setIsPromptExpanded((v) => !v)}>{isPromptExpanded ? "Less" : "More"}</Button>
                          <Button variant="secondary" onClick={() => void copyText(debug.request_inspector.prompt_preview)}>Copy</Button>
                        </div>
                      </div>
                      <CodeViewer
                        value={debug.request_inspector.prompt_preview}
                        language="text"
                        expanded={isPromptExpanded}
                      />

                      <div className="panel-head-row">
                        <h4>Context Summary</h4>
                        <div className="row-actions">
                          <Button variant="ghost" onClick={() => setIsContextExpanded((v) => !v)}>{isContextExpanded ? "Less" : "More"}</Button>
                          <Button variant="secondary" onClick={() => void copyText(debug.context_summary)}>Copy</Button>
                        </div>
                      </div>
                      <CodeViewer
                        value={debug.context_summary}
                        language="text"
                        expanded={isContextExpanded}
                      />
                    </div>
                  ) : null}
                </article>
              </>
            ) : (
              <article className="panel-card">
                <h3>No Analysis Yet</h3>
                <p className="muted-wrap">Run Analyze PR/Commit to generate risk, test plan, and manual test cases.</p>
              </article>
            )}

            <article className="panel-card">
              <h3>UI Recorder</h3>
              {recorder.active ? (
                <div className="row-actions">
                  <p>● Recording {recordingTime} {recorder.domain ? `(${recorder.domain})` : ""}</p>
                  <Button onClick={() => void stopRecorder()}>Stop Recording</Button>
                </div>
              ) : (
                <Button onClick={() => void startRecorder()} disabled={settings.safeMode.enabled}>Start UI Recording</Button>
              )}
            </article>
          </section>
        ) : null}

        {tab === "sessions" ? (
          <article className="panel-card">
            <h3>Sessions</h3>
            <p className="muted-wrap">Session listing scaffold. Supports open/export/delete in next increment.</p>
          </article>
        ) : null}

        {tab === "settings" ? (
          <article className="panel-card">
            <SettingsPanel settings={settings} onSaved={setSettings} />
          </article>
        ) : null}
      </section>
    </main>
  );
}
