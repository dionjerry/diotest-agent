import type { ManualTestCase } from "../analysis/types";

export const UI_RECORDER_SESSIONS_KEY = "diotest.uiRecorder.sessions.v1";
export const DEFAULT_MAX_UI_RECORDER_SESSIONS = 100;

export type UiRecorderStepAction =
  | "click"
  | "input"
  | "change"
  | "select"
  | "submit"
  | "focus"
  | "blur"
  | "scroll"
  | "keydown"
  | "navigation";

export interface UiRecorderScreenshotRef {
  id: string;
  capturedAt: string;
  dataUrl: string;
}

export interface UiRecorderPageSummary {
  id: string;
  url: string;
  title: string;
  capturedAt: string;
  summary: string;
  headings: string[];
  actions: string[];
  fields: string[];
  sections: string[];
}

export interface UiRecorderGenerationOptions {
  includeVision: boolean;
  includePageSummaries: boolean;
}

export interface UiRecorderStep {
  id: string;
  timestamp: string;
  action: UiRecorderStepAction;
  title: string;
  selector?: string;
  url: string;
  value?: string;
  key?: string;
  kept: boolean;
  screenshot?: UiRecorderScreenshotRef;
}

export interface UiRecorderPlaywrightStep {
  action: string;
  target: string | null;
  assertion: string | null;
}

export interface UiRecorderPlaywrightScenario {
  title: string;
  goal: string;
  steps: UiRecorderPlaywrightStep[];
  notes: string[];
}

export interface UiRecorderGenerationResult {
  manual_test_cases: ManualTestCase[];
  playwright_scenario: UiRecorderPlaywrightScenario;
}

export interface UiRecorderSession {
  id: string;
  name: string;
  domain: string;
  startUrl: string;
  lastUrl: string;
  startedAt: string;
  stoppedAt?: string;
  status: "recording" | "review" | "generated";
  steps: UiRecorderStep[];
  pageSummaries?: UiRecorderPageSummary[];
  warnings: string[];
  screenshotsCaptured: number;
  storageTrimmed: boolean;
  lastGenerationOptions?: UiRecorderGenerationOptions & { generatedAt: string };
  generated?: UiRecorderGenerationResult;
}

export interface UiRecorderSessionGroup {
  domain: string;
  sessionCount: number;
  lastUpdatedAt: string;
  sessions: UiRecorderSession[];
}

export interface RecorderCaptureConfig {
  eventThrottlePerSecond: number;
  screenshotDelayMs: number;
  recordScreenshots: boolean;
  maxScreenshotsPerSession: number;
  maxSessionStorageMB: number;
}

export interface RecorderActiveState extends RecorderCaptureConfig {
  active: boolean;
  startedAt: string;
  sessionId: string;
  tabId: number;
  domain: string;
}

export interface RawRecorderEvent {
  sessionId: string;
  timestamp: string;
  action: UiRecorderStepAction;
  url: string;
  title: string;
  selector?: string;
  value?: string;
  key?: string;
}

export interface RecorderPageSummaryPayload {
  url: string;
  title: string;
  summary: string;
  headings: string[];
  actions: string[];
  fields: string[];
  sections: string[];
}
