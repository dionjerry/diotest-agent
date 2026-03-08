import React, { useEffect, useMemo, useState } from "react";
import type { SettingsLatest } from "../../engine/settings/types";
import { DEFAULT_SETTINGS } from "../../engine/settings/defaults";
import { SettingsPanel } from "./components/SettingsPanel";
import { sendMessage } from "./lib/messages";
import { Button } from "./components/ui/button";

function formatElapsed(startedAt: string): string {
  const delta = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const s = Math.floor(delta / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function App() {
  const [settings, setSettings] = useState<SettingsLatest>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"review" | "sessions" | "settings">("review");
  const [recorder, setRecorder] = useState<{ active: boolean; startedAt?: string; domain?: string }>({ active: false });

  useEffect(() => {
    void (async () => {
      const loaded = await sendMessage<{ ok: boolean; settings: SettingsLatest }>({ type: "settings.load" });
      if (loaded.ok) {
        setSettings(loaded.settings);
      }
      const status = await sendMessage<{ ok: boolean; state: { active: boolean; startedAt: string; domain: string } | null }>({ type: "recorder.status" });
      if (status.ok && status.state) {
        setRecorder({ active: status.state.active, startedAt: status.state.startedAt, domain: status.state.domain });
      }
    })();
  }, []);

  useEffect(() => {
    if (!recorder.active) return;
    const t = setInterval(() => setRecorder((r) => ({ ...r })), 1000);
    return () => clearInterval(t);
  }, [recorder.active]);

  const recordingTime = useMemo(() => (recorder.startedAt ? formatElapsed(recorder.startedAt) : "00:00"), [recorder]);

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
    <main style={{ padding: 12, fontFamily: "ui-sans-serif, system-ui", color: "#f8fafc", background: "#0f172a", minHeight: "100vh" }}>
      <h2>DioTest</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={() => setTab("review")}>Review</Button>
        <Button variant="secondary" onClick={() => setTab("sessions")}>Sessions</Button>
        <Button variant="secondary" onClick={() => setTab("settings")}>Settings</Button>
      </div>

      {tab === "review" ? (
        <section>
          <h3>PR Review + UI Recorder</h3>
          <p>Non-goals: no repo-wide scan, no CI integration, no cloud sync, no auto test execution.</p>
          {recorder.active ? (
            <div>
              <p>
                ● Recording {recordingTime} {recorder.domain ? `(${recorder.domain})` : ""}
              </p>
              <Button onClick={() => void stopRecorder()}>Stop Recording</Button>
            </div>
          ) : (
            <Button onClick={() => void startRecorder()} disabled={settings.safeMode.enabled}>
              Start UI Recording
            </Button>
          )}
        </section>
      ) : null}

      {tab === "sessions" ? (
        <section>
          <h3>Sessions</h3>
          <p>Session listing scaffold. Supports open/export/delete in next increment.</p>
        </section>
      ) : null}

      {tab === "settings" ? <SettingsPanel settings={settings} onSaved={setSettings} /> : null}
    </main>
  );
}
