import React, { useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";
import { SETTING_RANGES } from "@diotest/domain/settings/ranges";
import type { SettingsLatest, SettingsValidationResult } from "@diotest/domain/settings/types";
import { validateSettings } from "@diotest/domain/settings/validation";
import { sendMessage } from "../lib/messages";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

interface Props {
  settings: SettingsLatest;
  onSaved: (settings: SettingsLatest) => void;
}

function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{props.label}</label>
      {props.children}
      {props.hint  && <span className="field-hint">{props.hint}</span>}
      {props.error && <span className="field-error">{props.error}</span>}
    </div>
  );
}

function NumberField(props: {
  label: string;
  hint: string;
  value: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={props.label} hint={props.hint} error={props.error}>
      <Input
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </Field>
  );
}

function CheckboxField(props: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-field">
      <Checkbox
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <div className="checkbox-field-body">
        <span className="checkbox-field-label">{props.label}</span>
        {props.desc && <span className="checkbox-field-desc">{props.desc}</span>}
      </div>
    </label>
  );
}

export function SettingsPanel({ settings, onSaved }: Props) {
  const [draft, setDraft]       = useState<SettingsLatest>(settings);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);
  const validation = useMemo(() => validateSettings(draft), [draft]);

  function set(path: string, value: number | boolean | string) {
    const next = structuredClone(draft);
    const [a, b] = path.split(".");
    (next as any)[a][b] = value;
    setDraft(next);
    setSaved(false);
  }

  async function save() {
    setSaveError(null);
    const result = await sendMessage<{
      ok: boolean;
      settings?: SettingsLatest;
      errors?: SettingsValidationResult["errors"];
    }>({ type: "settings.save", payload: draft });

    if (!result.ok || !result.settings) {
      setSaveError("Unable to save. Fix validation errors first.");
      return;
    }
    onSaved(result.settings);
    setDraft(result.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const prMaxFilesRange  = SETTING_RANGES["pr.maxFiles"];
  const prMaxDiffRange   = SETTING_RANGES["pr.maxDiffLines"];
  const prTopRiskRange   = SETTING_RANGES["pr.largePrTopRiskFiles"];
  const uiShotsRange     = SETTING_RANGES["ui.maxScreenshotsPerSession"];
  const uiStoreRange     = SETTING_RANGES["ui.maxSessionStorageMB"];
  const uiThrottleRange  = SETTING_RANGES["ui.eventThrottlePerSecond"];
  const uiDelayRange     = SETTING_RANGES["ui.screenshotDelayMs"];

  return (
    <div className="settings-root">
      {/* AI */}
      <div className="settings-section">
        <div className="settings-section-title">AI</div>

        <Field label="API key">
          <Input
            type="password"
            value={draft.auth.openaiApiKey}
            onChange={(e) => set("auth.openaiApiKey", e.target.value)}
            placeholder="sk-… or sk-ant-…"
          />
          <span className="field-hint">OpenAI (sk-…) or Anthropic (sk-ant-…) key</span>
        </Field>

        <Field label="Model">
          <select
            className="dt-input"
            value={draft.analysis.model}
            onChange={(e) => set("analysis.model", e.target.value)}
          >
            <optgroup label="Anthropic">
              <option value="claude-opus-4-5">claude-opus-4-5</option>
              <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
              <option value="claude-haiku-4-5">claude-haiku-4-5</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              <option value="gpt-4.1">gpt-4.1</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
            </optgroup>
          </select>
        </Field>

        <Field label="GitHub token" hint="Optional — required for deep scan on private repos">
          <Input
            type="password"
            value={draft.auth.githubToken}
            onChange={(e) => set("auth.githubToken", e.target.value)}
            placeholder="ghp_…"
          />
        </Field>

        <CheckboxField
          label="Enable deep scan by default"
          desc="Fetches full file context from GitHub API for better accuracy"
          checked={draft.analysis.deepScanDefault}
          onChange={(v) => set("analysis.deepScanDefault", v)}
        />
      </div>

      {/* PR mode */}
      <div className="settings-section">
        <div className="settings-section-title">PR Mode</div>
        <NumberField
          label="Max files"
          value={draft.pr.maxFiles}
          onChange={(v) => set("pr.maxFiles", v)}
          hint={`${prMaxFilesRange.min}–${prMaxFilesRange.max} (default ${DEFAULT_SETTINGS.pr.maxFiles})`}
          error={validation.errors["pr.maxFiles"]}
        />
        <NumberField
          label="Max diff lines"
          value={draft.pr.maxDiffLines}
          onChange={(v) => set("pr.maxDiffLines", v)}
          hint={`${prMaxDiffRange.min}–${prMaxDiffRange.max} (default ${DEFAULT_SETTINGS.pr.maxDiffLines})`}
          error={validation.errors["pr.maxDiffLines"]}
        />
        <NumberField
          label="Large PR top-risk files"
          value={draft.pr.largePrTopRiskFiles}
          onChange={(v) => set("pr.largePrTopRiskFiles", v)}
          hint={`${prTopRiskRange.min}–${prTopRiskRange.max} (default ${DEFAULT_SETTINGS.pr.largePrTopRiskFiles})`}
          error={validation.errors["pr.largePrTopRiskFiles"]}
        />
        <CheckboxField
          label="Enable GitHub API fallback"
          checked={draft.pr.enableApiFallback}
          onChange={(v) => set("pr.enableApiFallback", v)}
        />
      </div>

      {/* UI Recorder */}
      <div className="settings-section">
        <div className="settings-section-title">UI Recorder</div>
        <NumberField
          label="Max screenshots / session"
          value={draft.ui.maxScreenshotsPerSession}
          onChange={(v) => set("ui.maxScreenshotsPerSession", v)}
          hint={`${uiShotsRange.min}–${uiShotsRange.max} (default ${DEFAULT_SETTINGS.ui.maxScreenshotsPerSession})`}
          error={validation.errors["ui.maxScreenshotsPerSession"]}
        />
        <NumberField
          label="Max session storage (MB)"
          value={draft.ui.maxSessionStorageMB}
          onChange={(v) => set("ui.maxSessionStorageMB", v)}
          hint={`${uiStoreRange.min}–${uiStoreRange.max} (default ${DEFAULT_SETTINGS.ui.maxSessionStorageMB})`}
          error={validation.errors["ui.maxSessionStorageMB"]}
        />
        <NumberField
          label="Event throttle / sec"
          value={draft.ui.eventThrottlePerSecond}
          onChange={(v) => set("ui.eventThrottlePerSecond", v)}
          hint={`${uiThrottleRange.min}–${uiThrottleRange.max} (default ${DEFAULT_SETTINGS.ui.eventThrottlePerSecond})`}
          error={validation.errors["ui.eventThrottlePerSecond"]}
        />
        <NumberField
          label="Screenshot delay (ms)"
          value={draft.ui.screenshotDelayMs}
          onChange={(v) => set("ui.screenshotDelayMs", v)}
          hint={`${uiDelayRange.min}–${uiDelayRange.max} (default ${DEFAULT_SETTINGS.ui.screenshotDelayMs})`}
          error={validation.errors["ui.screenshotDelayMs"]}
        />
        <CheckboxField
          label="Record screenshots"
          checked={draft.ui.recordScreenshots}
          onChange={(v) => set("ui.recordScreenshots", v)}
        />
      </div>

      {/* Advanced */}
      <div className="settings-section">
        <div className="settings-section-title">Advanced</div>
        <CheckboxField
          label="Local telemetry"
          desc="Stores anonymous usage data locally only"
          checked={draft.telemetry.localEnabled}
          onChange={(v) => set("telemetry.localEnabled", v)}
        />
        <CheckboxField
          label="Safe mode"
          desc="Disables AI analysis, UI recording, API fallback, and telemetry"
          checked={draft.safeMode.enabled}
          onChange={(v) => set("safeMode.enabled", v)}
        />
      </div>

      {/* Errors + actions */}
      {validation.errors.global && (
        <div className="warning-banner">{validation.errors.global}</div>
      )}
      {saveError && (
        <div className="warning-banner">{saveError}</div>
      )}

      <div className="settings-actions">
        <Button disabled={!validation.valid} onClick={() => void save()}>
          {saved ? "Saved ✓" : "Save settings"}
        </Button>
        <Button variant="secondary" onClick={() => setDraft({ ...draft, pr: { ...DEFAULT_SETTINGS.pr } })}>
          Reset PR
        </Button>
        <Button variant="secondary" onClick={() => setDraft({ ...draft, ui: { ...DEFAULT_SETTINGS.ui } })}>
          Reset recorder
        </Button>
        <Button variant="ghost" onClick={() => setDraft(structuredClone(DEFAULT_SETTINGS))}>
          Reset all
        </Button>
      </div>
    </div>
  );
}
