import React, { useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "../../engine/settings/defaults";
import { SETTING_RANGES } from "../../engine/settings/ranges";
import type { SettingsLatest, SettingsValidationResult } from "../../engine/settings/types";
import { validateSettings } from "../../engine/settings/validation";
import { sendMessage } from "../lib/messages";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

interface Props {
  settings: SettingsLatest;
  onSaved: (settings: SettingsLatest) => void;
}

function NumberField(props: {
  label: string;
  hint: string;
  value: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div>{props.label}</div>
      <Input type="number" value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
      <small style={{ display: "block" }}>{props.hint}</small>
      {props.error ? <small style={{ color: "#ff6b6b" }}>{props.error}</small> : null}
    </label>
  );
}

export function SettingsPanel({ settings, onSaved }: Props) {
  const [draft, setDraft] = useState<SettingsLatest>(settings);
  const [saveError, setSaveError] = useState<string | null>(null);
  const validation = useMemo(() => validateSettings(draft), [draft]);

  function set(path: string, value: number | boolean | string) {
    const next = structuredClone(draft);
    const [a, b] = path.split(".");
    (next as any)[a][b] = value;
    setDraft(next);
  }

  async function save() {
    const result = await sendMessage<{ ok: boolean; settings?: SettingsLatest; errors?: SettingsValidationResult["errors"] }>({
      type: "settings.save",
      payload: draft
    });

    if (!result.ok || !result.settings) {
      setSaveError("Unable to save settings. Fix validation errors.");
      return;
    }
    setSaveError(null);
    onSaved(result.settings);
    setDraft(result.settings);
  }

  const prMaxFilesRange = SETTING_RANGES["pr.maxFiles"];
  const prMaxDiffRange = SETTING_RANGES["pr.maxDiffLines"];
  const prTopRiskRange = SETTING_RANGES["pr.largePrTopRiskFiles"];
  const uiShotsRange = SETTING_RANGES["ui.maxScreenshotsPerSession"];
  const uiStoreRange = SETTING_RANGES["ui.maxSessionStorageMB"];
  const uiThrottleRange = SETTING_RANGES["ui.eventThrottlePerSecond"];
  const uiDelayRange = SETTING_RANGES["ui.screenshotDelayMs"];

  return (
    <div>
      <h3>Settings</h3>
      <p>DioTest accesses only the active tab when you explicitly start UI recording.</p>

      <h4>AI</h4>
      <label style={{ display: "block", marginBottom: 10 }}>
        OpenAI API key
        <Input
          type="password"
          value={draft.auth.openaiApiKey}
          onChange={(e) => set("auth.openaiApiKey", e.target.value)}
          placeholder="sk-..."
        />
      </label>
      <label style={{ display: "block", marginBottom: 10 }}>
        OpenAI model
        <select
          className="dt-input"
          value={draft.analysis.model}
          onChange={(e) => set("analysis.model", e.target.value)}
        >
          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          <option value="gpt-4.1">gpt-4.1</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 10 }}>
        GitHub token (optional, deep scan)
        <Input
          type="password"
          value={draft.auth.githubToken}
          onChange={(e) => set("auth.githubToken", e.target.value)}
          placeholder="ghp_..."
        />
      </label>
      <label style={{ display: "block", marginBottom: 10 }}>
        <Checkbox checked={draft.analysis.deepScanDefault} onChange={(e) => set("analysis.deepScanDefault", e.target.checked)} /> Enable deep scan by default
      </label>

      <h4>PR Mode</h4>
      <NumberField
        label="Max files"
        value={draft.pr.maxFiles}
        onChange={(v) => set("pr.maxFiles", v)}
        hint={`Range ${prMaxFilesRange.min}-${prMaxFilesRange.max} (default ${DEFAULT_SETTINGS.pr.maxFiles})`}
        error={validation.errors["pr.maxFiles"]}
      />
      <NumberField
        label="Max diff lines"
        value={draft.pr.maxDiffLines}
        onChange={(v) => set("pr.maxDiffLines", v)}
        hint={`Range ${prMaxDiffRange.min}-${prMaxDiffRange.max} (default ${DEFAULT_SETTINGS.pr.maxDiffLines})`}
        error={validation.errors["pr.maxDiffLines"]}
      />
      <NumberField
        label="Large PR top-risk files"
        value={draft.pr.largePrTopRiskFiles}
        onChange={(v) => set("pr.largePrTopRiskFiles", v)}
        hint={`Range ${prTopRiskRange.min}-${prTopRiskRange.max} (default ${DEFAULT_SETTINGS.pr.largePrTopRiskFiles})`}
        error={validation.errors["pr.largePrTopRiskFiles"]}
      />
      <label style={{ display: "block", marginBottom: 10 }}>
        <Checkbox checked={draft.pr.enableApiFallback} onChange={(e) => set("pr.enableApiFallback", e.target.checked)} /> Enable GitHub API fallback
      </label>

      <h4>UI Recorder</h4>
      <NumberField
        label="Max screenshots/session"
        value={draft.ui.maxScreenshotsPerSession}
        onChange={(v) => set("ui.maxScreenshotsPerSession", v)}
        hint={`Range ${uiShotsRange.min}-${uiShotsRange.max} (default ${DEFAULT_SETTINGS.ui.maxScreenshotsPerSession})`}
        error={validation.errors["ui.maxScreenshotsPerSession"]}
      />
      <NumberField
        label="Max session storage (MB)"
        value={draft.ui.maxSessionStorageMB}
        onChange={(v) => set("ui.maxSessionStorageMB", v)}
        hint={`Range ${uiStoreRange.min}-${uiStoreRange.max} (default ${DEFAULT_SETTINGS.ui.maxSessionStorageMB})`}
        error={validation.errors["ui.maxSessionStorageMB"]}
      />
      <NumberField
        label="Event throttle/sec"
        value={draft.ui.eventThrottlePerSecond}
        onChange={(v) => set("ui.eventThrottlePerSecond", v)}
        hint={`Range ${uiThrottleRange.min}-${uiThrottleRange.max} (default ${DEFAULT_SETTINGS.ui.eventThrottlePerSecond})`}
        error={validation.errors["ui.eventThrottlePerSecond"]}
      />
      <NumberField
        label="Screenshot delay (ms)"
        value={draft.ui.screenshotDelayMs}
        onChange={(v) => set("ui.screenshotDelayMs", v)}
        hint={`Range ${uiDelayRange.min}-${uiDelayRange.max} (default ${DEFAULT_SETTINGS.ui.screenshotDelayMs})`}
        error={validation.errors["ui.screenshotDelayMs"]}
      />
      <label style={{ display: "block", marginBottom: 10 }}>
        <Checkbox checked={draft.ui.recordScreenshots} onChange={(e) => set("ui.recordScreenshots", e.target.checked)} /> Record screenshots
      </label>

      <h4>Advanced</h4>
      <label style={{ display: "block", marginBottom: 10 }}>
        <Checkbox checked={draft.telemetry.localEnabled} onChange={(e) => set("telemetry.localEnabled", e.target.checked)} /> Local telemetry
      </label>
      <label style={{ display: "block", marginBottom: 10 }}>
        <Checkbox checked={draft.safeMode.enabled} onChange={(e) => set("safeMode.enabled", e.target.checked)} /> Safe mode (disable AI analysis, UI recording, API fallback, telemetry)
      </label>

      {validation.errors.global ? <p style={{ color: "#ff6b6b" }}>{validation.errors.global}</p> : null}
      {saveError ? <p style={{ color: "#ff6b6b" }}>{saveError}</p> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Button disabled={!validation.valid} onClick={() => void save()}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => setDraft({ ...draft, pr: { ...DEFAULT_SETTINGS.pr } })}>
          Reset PR section
        </Button>
        <Button variant="secondary" onClick={() => setDraft({ ...draft, ui: { ...DEFAULT_SETTINGS.ui } })}>
          Reset UI section
        </Button>
        <Button variant="secondary" onClick={() => setDraft(structuredClone(DEFAULT_SETTINGS))}>
          Reset all to defaults
        </Button>
      </div>
    </div>
  );
}
