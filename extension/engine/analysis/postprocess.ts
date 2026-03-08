import type { AiAnalysisResultV1, ExtractionContext, RiskArea, SuggestedTest } from "./types";

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

export function sanitizeAiIssues(
  payload: Omit<AiAnalysisResultV1, "meta">,
  context: ExtractionContext,
  signals: { trimmed: boolean; coverage: "base" | "deep_scan" | "partial" }
): Omit<AiAnalysisResultV1, "meta"> {
  let risk_areas = payload.risk_areas;
  let unit = payload.test_plan.unit;
  let integration = payload.test_plan.integration;
  let e2e = payload.test_plan.e2e;

  if (hasTestFiles(context)) {
    risk_areas = risk_areas.filter((area) => !areaMentionsNoTests(area));
    unit = unit.filter((test) => !testMentionsNoTests(test));
    integration = integration.filter((test) => !testMentionsNoTests(test));
    e2e = e2e.filter((test) => !testMentionsNoTests(test));
  }

  const hasUncertaintySignal = signals.trimmed || signals.coverage === "partial";
  if (!hasUncertaintySignal) {
    risk_areas = risk_areas.filter((area) => !areaMentionsUncertainty(area));
    unit = unit.filter((test) => !testMentionsUncertainty(test));
    integration = integration.filter((test) => !testMentionsUncertainty(test));
    e2e = e2e.filter((test) => !testMentionsUncertainty(test));
  }

  return {
    ...payload,
    risk_areas,
    test_plan: {
      unit,
      integration,
      e2e
    }
  };
}
