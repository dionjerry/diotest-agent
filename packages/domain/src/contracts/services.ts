import type { AnalyzeResult, AnalysisMode, ExtractionContext } from "@diotest/domain/analysis/types";
import type { UiRecorderGenerationOptions, UiRecorderGenerationResult, UiRecorderSession } from "@diotest/domain/recorder/types";

export interface AnalysisRequest {
  rawSettings: unknown;
  mode: AnalysisMode;
  includeDeepScan: boolean;
  extractContext: () => Promise<{ ok: true; context: ExtractionContext } | { ok: false; error: string }>;
}

export interface AnalysisService {
  runAnalyze(request: AnalysisRequest): Promise<AnalyzeResult>;
}

export interface RecorderService {
  generateArtifacts(rawSettings: unknown, session: UiRecorderSession, options: UiRecorderGenerationOptions): Promise<{ ok: true; result: UiRecorderGenerationResult } | { ok: false; error: string; code?: string }>;
}

export interface SessionService {
  getSession(sessionId: string): Promise<unknown>;
  listSessions(): Promise<unknown>;
}

export type ProviderName = "openai" | "openrouter";

export interface ProviderRequest {
  provider: ProviderName;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: unknown;
  timeoutMs?: number;
  userContent?: ProviderContentPart[];
}

export interface ProviderResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type ProviderContentPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string; detail?: "auto" | "low" | "high" };
