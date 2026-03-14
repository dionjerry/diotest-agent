import type { AiAnalysisResultV1, ExtractionContext, ManualTestCase, RiskArea, SuggestedTest } from "@diotest/domain/analysis/types";

function hasTestFiles(context: ExtractionContext): boolean {
  return context.files.some((f) => /(^|\/)(__tests__|test|tests|spec)(\/|\.|$)|\.(test|spec)\./i.test(f.path));
}

function mentionsNoTests(text: string): boolean {
  return /(no test files|absence of test|without test|missing tests?)/i.test(text);
}

function mentionsUncertainty(text: string): boolean {
  return /(token budget|trimmed context|partial (scan|coverage)|truncat(ed|ion)|insufficient context)/i.test(text);
}

function areaMentionsNoTests(area: RiskArea): boolean {
  return [area.area, area.why, ...area.evidence_files].some((part) => mentionsNoTests(part));
}

function testMentionsNoTests(test: SuggestedTest): boolean {
  return [test.title, test.notes ?? "", ...test.evidence_files].some((part) => mentionsNoTests(part));
}

function areaMentionsUncertainty(area: RiskArea): boolean {
  return [area.area, area.why, ...area.evidence_files].some((part) => mentionsUncertainty(part));
}

function testMentionsUncertainty(test: SuggestedTest): boolean {
  return [test.title, test.notes ?? "", ...test.evidence_files].some((part) => mentionsUncertainty(part));
}

function conciseTitle(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim().replace(/[.:\-]+$/g, "");
  if (!normalized) return "Uncategorized Risk";
  return normalized.length <= 90 ? normalized : `${normalized.slice(0, 87).trim()}...`;
}

function conciseWhy(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Changed files indicate potential regression risk.";
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177).trim()}...`;
}

function normalizeEvidenceFiles(evidence: string[], contextPaths: Set<string>): string[] {
  const deduped: string[] = [];
  for (const path of evidence) {
    const normalized = path.trim();
    if (!normalized || !contextPaths.has(normalized) || deduped.includes(normalized)) continue;
    deduped.push(normalized);
    if (deduped.length >= 5) break;
  }
  return deduped;
}

function normalizeRiskArea(area: RiskArea, contextPaths: Set<string>, fallbackPath: string | undefined): RiskArea {
  const evidence = normalizeEvidenceFiles(area.evidence_files, contextPaths);
  return {
    area: conciseTitle(area.area),
    severity: area.severity,
    why: conciseWhy(area.why),
    evidence_files: evidence.length ? evidence : fallbackPath ? [fallbackPath] : []
  };
}

function normalizeSuggestedTest(test: SuggestedTest, contextPaths: Set<string>, fallbackPath: string | undefined): SuggestedTest {
  const evidence = normalizeEvidenceFiles(test.evidence_files, contextPaths);
  return {
    title: conciseTitle(test.title),
    notes: test.notes ? conciseWhy(test.notes) : test.notes,
    evidence_files: evidence.length ? evidence : fallbackPath ? [fallbackPath] : []
  };
}

function normalizeStringList(values: string[] | undefined, fallback: string): string[] {
  const normalized = (values ?? [])
    .map((v) => v.trim())
    .filter(Boolean);
  return normalized.length ? normalized : [fallback];
}

function isGenericManualTitle(title: string): boolean {
  return /^(verify|check|review|validate)\b/i.test(title) && title.split(/\s+/).length <= 6;
}

function hasBehaviorLink(text: string): boolean {
  return /(should|must|returns?|throws?|fails?|succeeds?|enables?|disables?|captures?|prevents?|privacy|auth|token|trace|request|response|error|state|flow)/i.test(
    text
  );
}

function normalizeManualCase(
  testCase: Partial<ManualTestCase>,
  index: number,
  contextPaths: Set<string>,
  fallbackPath: string | undefined
): ManualTestCase {
  const evidence = normalizeEvidenceFiles(testCase.evidence_files ?? [], contextPaths);
  const id = (testCase.id ?? "").trim() || `MT-${String(index + 1).padStart(3, "0")}`;
  const title = conciseTitle(testCase.title ?? "Manual verification");
  const why = conciseWhy(testCase.why ?? "Suggested from changed files and potential regression impact.");

  return {
    id,
    title,
    why,
    evidence_files: evidence.length ? evidence : fallbackPath ? [fallbackPath] : [],
    preconditions: normalizeStringList(testCase.preconditions, "Relevant runtime/environment is available."),
    steps: normalizeStringList(testCase.steps, "Execute the affected user or API flow."),
    expected: normalizeStringList(testCase.expected, "Observed behavior matches expected post-change outcome.")
  };
}

function isLowSignalManualCase(testCase: ManualTestCase): boolean {
  const combined = `${testCase.title} ${testCase.why} ${testCase.steps.join(" ")} ${testCase.expected.join(" ")}`;
  return isGenericManualTitle(testCase.title) && !hasBehaviorLink(combined);
}

function manualCaseSignature(testCase: ManualTestCase): string {
  return `${testCase.title.toLowerCase()}|${testCase.why.toLowerCase()}|${testCase.evidence_files.join(",")}`;
}

function synthesizeManualCaseFromRisk(
  risk: RiskArea,
  index: number,
  contextPaths: Set<string>,
  fallbackPath: string | undefined
): ManualTestCase {
  const evidence = normalizeEvidenceFiles(risk.evidence_files, contextPaths);
  const evidenceFiles = evidence.length ? evidence : fallbackPath ? [fallbackPath] : [];
  const focus = risk.area.toLowerCase();

  return {
    id: `MT-${String(index + 1).padStart(3, "0")}`,
    title: conciseTitle(`Validate ${risk.area}`),
    why: conciseWhy(`Suggested due to ${risk.why}`),
    evidence_files: evidenceFiles,
    preconditions: ["System is running with the updated change."],
    steps: [`Exercise the flow impacted by ${evidenceFiles[0] ?? "changed files"}.`],
    expected: [`The ${focus} behavior remains correct with no regressions.`]
  };
}

export function sanitizeAiIssuesWithReport(
  payload: Omit<AiAnalysisResultV1, "meta">,
  context: ExtractionContext,
  signals: { trimmed: boolean; coverage: "base" | "deep_scan" | "partial" }
): {
  payload: Omit<AiAnalysisResultV1, "meta">;
  flagsApplied: string[];
  manualCaseQuality: { generated: number; kept: number };
} {
  let risk_areas = payload.risk_areas;
  let unit = payload.test_plan.unit;
  let integration = payload.test_plan.integration;
  let e2e = payload.test_plan.e2e;
  const generatedManualCases = payload.manual_test_cases.length;
  const flagsApplied: string[] = [];

  if (hasTestFiles(context)) {
    const before = risk_areas.length + unit.length + integration.length + e2e.length;
    risk_areas = risk_areas.filter((area) => !areaMentionsNoTests(area));
    unit = unit.filter((test) => !testMentionsNoTests(test));
    integration = integration.filter((test) => !testMentionsNoTests(test));
    e2e = e2e.filter((test) => !testMentionsNoTests(test));
    const after = risk_areas.length + unit.length + integration.length + e2e.length;
    if (after < before) flagsApplied.push("removed_missing_tests_claims");
  }

  const hasUncertaintySignal = signals.trimmed || signals.coverage === "partial";
  if (!hasUncertaintySignal) {
    const before = risk_areas.length + unit.length + integration.length + e2e.length;
    risk_areas = risk_areas.filter((area) => !areaMentionsUncertainty(area));
    unit = unit.filter((test) => !testMentionsUncertainty(test));
    integration = integration.filter((test) => !testMentionsUncertainty(test));
    e2e = e2e.filter((test) => !testMentionsUncertainty(test));
    const after = risk_areas.length + unit.length + integration.length + e2e.length;
    if (after < before) flagsApplied.push("removed_unsubstantiated_uncertainty_claims");
  }

  const contextPaths = new Set(context.files.map((file) => file.path));
  const fallbackPath = context.files[0]?.path;

  risk_areas = risk_areas.map((area) => normalizeRiskArea(area, contextPaths, fallbackPath));
  unit = unit.map((test) => normalizeSuggestedTest(test, contextPaths, fallbackPath));
  integration = integration.map((test) => normalizeSuggestedTest(test, contextPaths, fallbackPath));
  e2e = e2e.map((test) => normalizeSuggestedTest(test, contextPaths, fallbackPath));
  flagsApplied.push("normalized_titles_why_and_evidence");

  let manualCases = payload.manual_test_cases.map((testCase, index) =>
    normalizeManualCase(testCase, index, contextPaths, fallbackPath)
  );
  flagsApplied.push("manual_cases_evidence_normalized");

  const dedupedCases: ManualTestCase[] = [];
  const seenManualSignatures = new Set<string>();
  for (const testCase of manualCases) {
    const signature = manualCaseSignature(testCase);
    if (seenManualSignatures.has(signature)) continue;
    seenManualSignatures.add(signature);
    dedupedCases.push(testCase);
  }
  if (dedupedCases.length < manualCases.length) {
    flagsApplied.push("manual_cases_deduped");
  }
  manualCases = dedupedCases;

  const filteredManualCases = manualCases.filter((testCase) => !isLowSignalManualCase(testCase));
  if (filteredManualCases.length < manualCases.length) {
    flagsApplied.push("manual_cases_generic_removed");
  }
  manualCases = filteredManualCases;

  const minimumManualCases = risk_areas.length > 0 ? 2 : 1;
  if (manualCases.length < minimumManualCases) {
    const existingSignatures = new Set(manualCases.map((testCase) => manualCaseSignature(testCase)));
    for (const risk of risk_areas) {
      if (manualCases.length >= minimumManualCases) break;
      const candidate = synthesizeManualCaseFromRisk(risk, manualCases.length, contextPaths, fallbackPath);
      const signature = manualCaseSignature(candidate);
      if (existingSignatures.has(signature)) continue;
      existingSignatures.add(signature);
      manualCases.push(candidate);
    }

    if (manualCases.length < minimumManualCases && fallbackPath) {
      manualCases.push({
        id: `MT-${String(manualCases.length + 1).padStart(3, "0")}`,
        title: "Validate changed behavior on key path",
        why: "Suggested because analysis context was limited and still indicates regression surface.",
        evidence_files: [fallbackPath],
        preconditions: ["Updated change is deployed in a test environment."],
        steps: [`Execute critical flow touching ${fallbackPath}.`],
        expected: ["No functional regression is observed."]
      });
    }
    flagsApplied.push("manual_cases_rewritten_from_risk");
  }

  return {
    payload: {
      ...payload,
      risk_areas,
      test_plan: {
        unit,
        integration,
        e2e
      },
      manual_test_cases: manualCases
    },
    flagsApplied,
    manualCaseQuality: {
      generated: generatedManualCases,
      kept: manualCases.length
    }
  };
}

export function sanitizeAiIssues(
  payload: Omit<AiAnalysisResultV1, "meta">,
  context: ExtractionContext,
  signals: { trimmed: boolean; coverage: "base" | "deep_scan" | "partial" }
): Omit<AiAnalysisResultV1, "meta"> {
  return sanitizeAiIssuesWithReport(payload, context, signals).payload;
}
