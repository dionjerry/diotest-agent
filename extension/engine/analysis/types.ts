import type { PrContext } from "../pr/types";

export type AnalysisMode = "pr_commit" | "pr_commit_deep_scan";

export interface ExtractionFile {
  path: string;
  patch?: string;
  source: "dom" | "github_api" | "inferred";
}

export interface ExtractionContext {
  pageType: PrContext["pageType"];
  repo: string;
  prNumber?: number;
  commitSha?: string;
  title: string;
  description: string;
  files: ExtractionFile[];
  url: string;
}

export interface RiskArea {
  area: string;
  severity: "low" | "medium" | "high";
  evidence_files: string[];
  why: string;
}

export interface SuggestedTest {
  title: string;
  evidence_files: string[];
  notes?: string;
}

export interface ManualTestCase {
  id: string;
  title: string;
  preconditions: string[];
  steps: string[];
  expected: string[];
}

export interface AiAnalysisResultV1 {
  meta: {
    schema_version: "1.0.0";
    engine_version: string;
    prompt_version: string;
    analysis_mode: AnalysisMode;
    coverage_level: "base" | "deep_scan" | "partial";
  };
  risk_score: number;
  risk_areas: RiskArea[];
  test_plan: {
    unit: SuggestedTest[];
    integration: SuggestedTest[];
    e2e: SuggestedTest[];
  };
  manual_test_cases: ManualTestCase[];
}

export interface AnalyzeDebug {
  token_estimate: number;
  warnings: string[];
  context_summary: string;
  raw_context: ExtractionContext;
  risk_formula?: {
    deterministic_score: number;
    ai_score: number;
    final_score: number;
    drivers: string[];
  };
  request_inspector: {
    mode: AnalysisMode;
    page_type: ExtractionContext["pageType"];
    repo: string;
    ref: string;
    files_detected: number;
    files_sent_to_ai: number;
    deep_scan_requested: boolean;
    deep_scan_used: boolean;
    screenshots_sent: boolean;
    prompt_preview: string;
  };
}

export interface AnalyzeSuccess {
  ok: true;
  result: AiAnalysisResultV1;
  debug: AnalyzeDebug;
}

export interface AnalyzeFailure {
  ok: false;
  error: string;
  code?: string;
}

export type AnalyzeResult = AnalyzeSuccess | AnalyzeFailure;
