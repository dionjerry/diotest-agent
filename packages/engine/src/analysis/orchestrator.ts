import { ERROR_CODES } from "@diotest/domain/errors/codes";
import { augmentWithGithubApi } from "../github/augment";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from "../prompts/v1";
import { assertSettingsForExecution } from "../runtime/gating";
import type { SettingsLatest } from "@diotest/domain/settings/types";
import { generateStructured } from "@diotest/providers/openai";
import { AI_ANALYSIS_SCHEMA, isValidAiAnalysisResult } from "@diotest/domain/analysis/schema";
import { summarizeContext } from "./summarize";
import { blendRiskScores, computeDeterministicRiskScore } from "./risk";
import { filterContextFiles } from "./contextFilter";
import { sanitizeAiIssuesWithReport } from "./postprocess";
import type { AiAnalysisResultV1, AnalysisMode, AnalyzeResult, ExtractionContext } from "@diotest/domain/analysis/types";

export interface AnalyzeRequest {
  rawSettings: unknown;
  mode: AnalysisMode;
  includeDeepScan: boolean;
  extractContext: () => Promise<{ ok: true; context: ExtractionContext } | { ok: false; error: string }>;
}

function buildFailure(error: string, code?: string): AnalyzeResult {
  return { ok: false, error, code };
}

export async function runAiAnalyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
  const gate = assertSettingsForExecution(request.rawSettings);
  if (!gate.ok || !gate.settings) {
    return buildFailure("Settings are invalid.", ERROR_CODES.SETTINGS_VALIDATION_FAILED);
  }

  const settings = gate.settings as SettingsLatest;
  if (settings.safeMode.enabled) {
    return buildFailure("Safe mode blocks AI analysis.", ERROR_CODES.SETTINGS_VALIDATION_FAILED);
  }

  if (!settings.auth.openaiApiKey.trim()) {
    return buildFailure("OpenAI API key is missing. Add it in Settings.");
  }

  const extracted = await request.extractContext();
  if (!extracted.ok) {
    return buildFailure(extracted.error, ERROR_CODES.PR_EXTRACTION_FAILED);
  }

  let workingContext = extracted.context;
  const warnings: string[] = [];
  let coverage: "base" | "deep_scan" | "partial" = "base";
  let extractionSource: "dom" | "api" | "partial" = workingContext.extractionSource ?? "dom";
  const forceFallback = workingContext.files.length === 0;
  const canUseApiFallback = settings.pr.enableApiFallback || request.includeDeepScan;
  if (forceFallback) {
    warnings.push("No files extracted from DOM; trying GitHub API fallback.");
  }

  if (request.includeDeepScan || (forceFallback && canUseApiFallback)) {
    const beforeApiCount = workingContext.files.length;
    const augmented = await augmentWithGithubApi(workingContext, settings.auth.githubToken.trim());
    workingContext = augmented.context;
    if (augmented.warning) {
      warnings.push(augmented.warning);
      coverage = "partial";
    } else {
      coverage = "deep_scan";
      if (workingContext.files.length > beforeApiCount) {
        extractionSource = "api";
      }
    }

    if (forceFallback && workingContext.files.length === 0) {
      extractionSource = "partial";
      coverage = "partial";
      warnings.push("Fallback sequence ended in partial mode; analysis proceeds with limited context.");
    }
  } else if (forceFallback) {
    extractionSource = "partial";
    coverage = "partial";
    warnings.push("GitHub API fallback is disabled; running partial analysis with limited context.");
  }

  const filtering = filterContextFiles(workingContext);
  workingContext = filtering.context;
  const droppedFilesSummary = [...filtering.droppedFilesSummary];
  if (filtering.removedCount > 0) {
    warnings.push(`Ignored ${filtering.removedCount} generated build artifact file(s) in analysis context.`);
  }

  if (workingContext.files.length === 0) {
    extractionSource = "partial";
    coverage = "partial";
  }

  const { summary, tokenEstimate, trimmed } = summarizeContext(
    workingContext,
    settings.pr.maxDiffLines,
    settings.pr.maxFiles
  );
  if (trimmed) {
    warnings.push("Context was token-budget trimmed before AI analysis.");
    coverage = coverage === "deep_scan" ? "partial" : coverage;
    for (const file of workingContext.files.slice(settings.pr.maxFiles, settings.pr.maxFiles + 20)) {
      droppedFilesSummary.push({ path: file.path, reason: "token_budget_file_cap" });
    }
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(request.mode, workingContext, summary);

  const first = await generateStructured({
    apiKey: settings.auth.openaiApiKey,
    model: settings.analysis.model,
    systemPrompt,
    userPrompt,
    schema: AI_ANALYSIS_SCHEMA
  });

  if (!first.ok) {
    return buildFailure(first.error ?? "Model request failed.", ERROR_CODES.MODEL_TIMEOUT);
  }

  let aiPayload: Omit<AiAnalysisResultV1, "meta"> | null = null;
  if (isValidAiAnalysisResult(first.data)) {
    aiPayload = first.data;
  }
  if (!aiPayload) {
    const repair = await generateStructured({
      apiKey: settings.auth.openaiApiKey,
      model: settings.analysis.model,
      systemPrompt,
      userPrompt: buildRepairPrompt(JSON.stringify(first.data)),
      schema: AI_ANALYSIS_SCHEMA
    });

    if (!repair.ok || !isValidAiAnalysisResult(repair.data)) {
      return buildFailure("Model output failed schema validation after repair attempt.", ERROR_CODES.INVALID_MODEL_OUTPUT);
    }

    aiPayload = repair.data;
  }

  const sanitized = sanitizeAiIssuesWithReport(aiPayload, workingContext, { trimmed, coverage });
  aiPayload = sanitized.payload;

  const deterministic = computeDeterministicRiskScore(workingContext, { coverage, trimmed });
  const finalRiskScore = blendRiskScores(aiPayload.risk_score, deterministic.score);
  const analysisQuality: "full" | "partial" | "trimmed" =
    trimmed ? "trimmed" : coverage === "partial" || extractionSource === "partial" ? "partial" : "full";

  return {
    ok: true,
    result: {
      meta: {
        schema_version: "1.0.0",
        engine_version: "0.1.0",
        prompt_version: PROMPT_VERSION,
        analysis_mode: request.mode,
        coverage_level: coverage
      },
      ...aiPayload,
      risk_score: finalRiskScore
    },
    debug: {
      token_estimate: tokenEstimate,
      warnings,
      context_summary: summary,
      raw_context: workingContext,
      risk_formula: {
        deterministic_score: deterministic.score,
        ai_score: aiPayload.risk_score,
        final_score: finalRiskScore,
        drivers: deterministic.drivers,
        categories: deterministic.categories
      },
      request_inspector: {
        mode: request.mode,
        page_type: workingContext.pageType,
        repo: workingContext.repo,
        ref: String(workingContext.prNumber ?? workingContext.commitSha ?? "unknown"),
        files_detected: extracted.context.files.length,
        files_sent_to_ai: workingContext.files.length,
        deep_scan_requested: request.includeDeepScan || (forceFallback && canUseApiFallback),
        deep_scan_used: coverage === "deep_scan",
        extraction_source: extractionSource,
        analysis_quality: analysisQuality,
        dropped_files_summary: droppedFilesSummary,
        normalization_flags_applied: sanitized.flagsApplied,
        manual_cases_generated: sanitized.manualCaseQuality.generated,
        manual_cases_kept: sanitized.manualCaseQuality.kept,
        screenshots_sent: false,
        prompt_preview: userPrompt.slice(0, 2000)
      }
    }
  };
}
