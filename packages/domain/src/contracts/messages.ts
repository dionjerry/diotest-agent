import type { PrExtractResult } from "@diotest/domain/pr/types";
import type { AnalysisMode } from "@diotest/domain/analysis/types";
import type { RawRecorderEvent, RecorderPageSummaryPayload, UiRecorderGenerationOptions } from "@diotest/domain/recorder/types";

export type PrContractMessage =
  | { type: "pr.extract" }
  | { type: "pr.extract.result"; payload: PrExtractResult };

export type BackgroundMessage =
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
  | { type: "recorder.pageSummary"; payload: RecorderPageSummaryPayload }
  | { type: "recorder.stop" }
  | { type: "recorder.status" }
  | { type: "recorder.session.list" }
  | { type: "recorder.session.get"; payload: { sessionId: string } }
  | { type: "recorder.session.update"; payload: { sessionId: string; steps: Array<{ id: string; title: string; kept: boolean }> } }
  | { type: "recorder.session.generate"; payload: { sessionId: string } & Partial<UiRecorderGenerationOptions> }
  | { type: "recorder.session.delete"; payload: { sessionId: string } }
  | { type: "recorder.session.clearAll" }
  | { type: "export.filename"; payload: { mode: "pr" | "ui"; repo?: string; prNumber?: number; domain?: string; ext: "json" | "md" } };
