import type { AiAnalysisResultV1, AnalysisMode, AnalyzeDebug, ExtractionContext } from "../analysis/types";

export const ANALYSIS_SESSIONS_KEY = "diotest.analysis.sessions.v1";
export const DEFAULT_MAX_ANALYSIS_RUNS = 200;

export interface AnalysisSessionRun {
  id: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
  repo: string;
  ref: string;
  title?: string;
  pageType: ExtractionContext["pageType"];
  url: string;
  mode: AnalysisMode;
  coverageLevel: AiAnalysisResultV1["meta"]["coverage_level"];
  analysisQuality: AnalyzeDebug["request_inspector"]["analysis_quality"];
  riskScore: number;
  riskAreas: AiAnalysisResultV1["risk_areas"];
  testPlan: AiAnalysisResultV1["test_plan"];
  manualTestCases: AiAnalysisResultV1["manual_test_cases"];
  debug: {
    warnings: string[];
    filesDetected: number;
    filesSent: number;
    deepScanUsed: boolean;
    extractionSource: AnalyzeDebug["request_inspector"]["extraction_source"];
    normalizationFlags: string[];
    retentionTrimmed?: boolean;
  };
}

export interface AnalysisSessionThread {
  threadId: string;
  repo: string;
  ref: string;
  pageType: ExtractionContext["pageType"];
  lastUpdatedAt: string;
  runCount: number;
  runs: AnalysisSessionRun[];
}

export interface SessionListResponse {
  threads: AnalysisSessionThread[];
  totalRuns: number;
}

export interface SaveAnalysisSessionInput {
  mode: AnalysisMode;
  result: AiAnalysisResultV1;
  debug: AnalyzeDebug;
}
