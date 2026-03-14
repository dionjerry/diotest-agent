import type { SettingsLatest, SettingsValidationResult } from "@diotest/domain/settings/types";
import type { RecorderActiveState, UiRecorderGenerationOptions, UiRecorderSession, UiRecorderSessionGroup, RawRecorderEvent, RecorderPageSummaryPayload, UiRecorderScreenshotRef } from "@diotest/domain/recorder/types";
import type { AnalysisSessionRun, SessionListResponse, SaveAnalysisSessionInput } from "@diotest/domain/sessions/types";

export interface SettingsRepository {
  loadSettings(): Promise<SettingsLatest>;
  saveSettingsAtomically(input: unknown): Promise<SettingsValidationResult>;
}

export interface AnalysisSessionRepository {
  listAnalysisSessions(): Promise<SessionListResponse>;
  getAnalysisSession(sessionId: string): Promise<AnalysisSessionRun | null>;
  saveAnalysisSession(input: SaveAnalysisSessionInput): Promise<{ sessionId: string; trimmedCount: number }>;
  deleteAnalysisSessionRun(sessionId: string): Promise<{ removed: boolean }>;
  deleteAnalysisSessionThread(threadId: string): Promise<{ removed: number }>;
  clearAllAnalysisSessions(): Promise<void>;
}

export interface RecorderSessionRepository {
  listUiRecorderSessions(): Promise<UiRecorderSessionGroup[]>;
  getUiRecorderSession(sessionId: string): Promise<UiRecorderSession | null>;
  createUiRecorderSession(active: RecorderActiveState, name: string, startUrl: string): Promise<UiRecorderSession>;
  appendUiRecorderEvent(active: RecorderActiveState, event: RawRecorderEvent, screenshot?: UiRecorderScreenshotRef, pageSummary?: RecorderPageSummaryPayload): Promise<UiRecorderSession | null>;
  finalizeUiRecorderSession(sessionId: string): Promise<UiRecorderSession | null>;
  updateUiRecorderSession(sessionId: string, updater: (session: UiRecorderSession) => UiRecorderSession): Promise<UiRecorderSession | null>;
  setUiRecorderGenerationOptions(sessionId: string, options: UiRecorderGenerationOptions): Promise<UiRecorderSession | null>;
  deleteUiRecorderSession(sessionId: string): Promise<{ removed: boolean }>;
  clearAllUiRecorderSessions(): Promise<void>;
}

export interface RecorderStateRepository {
  persistRecorderState(state: RecorderActiveState): Promise<void>;
  restoreRecorderState(): Promise<{ state: RecorderActiveState | null }>;
  clearRecorderState(): Promise<void>;
}
