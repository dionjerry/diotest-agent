import type { ExtractionContext } from "./types";

type CoverageLevel = "base" | "deep_scan" | "partial";

export interface RiskFormulaBreakdown {
  deterministic_score: number;
  ai_score: number;
  final_score: number;
  drivers: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function changedLinesFromPatch(patch?: string): number {
  if (!patch) return 0;
  return patch
    .split("\n")
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---"))
    .length;
}

function pathMatches(path: string, re: RegExp): boolean {
  return re.test(path.toLowerCase());
}

function isCodeFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx|py|go|java|kt|rs|cs|rb|php|swift|cpp|c|h|m)$/i.test(path);
}

function isTestFile(path: string): boolean {
  return /(^|\/)(__tests__|test|tests|spec)(\/|\.|$)|\.(test|spec)\./i.test(path);
}

export function computeDeterministicRiskScore(
  context: ExtractionContext,
  options: { coverage: CoverageLevel; trimmed: boolean }
): { score: number; drivers: string[] } {
  const fileCount = context.files.length;
  const changedLines = context.files.reduce((acc, file) => acc + changedLinesFromPatch(file.patch), 0);
  const paths = context.files.map((f) => f.path);
  const drivers: string[] = [];

  let score = 0.8; // baseline change risk

  // File volume
  if (fileCount <= 5) score += 0.6;
  else if (fileCount <= 15) score += 1.2;
  else if (fileCount <= 30) score += 1.9;
  else if (fileCount <= 60) score += 2.6;
  else score += 3.2;
  if (fileCount > 0) drivers.push(`File volume: ${fileCount} files`);

  // Diff volume
  if (changedLines <= 100) score += 0.4;
  else if (changedLines <= 400) score += 0.9;
  else if (changedLines <= 1200) score += 1.5;
  else if (changedLines <= 3000) score += 2.1;
  else score += 2.8;
  if (changedLines > 0) drivers.push(`Code churn: ${changedLines} changed lines`);

  // Sensitive surfaces
  let sensitive = 0;
  if (paths.some((p) => pathMatches(p, /(auth|token|session|permission|credential|oauth|acl|rbac|crypto|encryption|security)/i))) {
    sensitive += 1.4;
    drivers.push("Sensitive surface: auth/security paths");
  }
  if (paths.some((p) => pathMatches(p, /(payment|billing|invoice|checkout|wallet)/i))) {
    sensitive += 1.6;
    drivers.push("Sensitive surface: billing/payment paths");
  }
  if (paths.some((p) => pathMatches(p, /(db|database|schema|migration|model|sql|persist|storage)/i))) {
    sensitive += 1.0;
    drivers.push("Sensitive surface: data/schema paths");
  }
  if (paths.some((p) => pathMatches(p, /(background|worker|runtime|manifest|config|settings|gateway|middleware|proxy)/i))) {
    sensitive += 0.9;
    drivers.push("Sensitive surface: runtime/config paths");
  }
  if (paths.some((p) => pathMatches(p, /(api|controller|route|endpoint|handler|service)/i))) {
    sensitive += 1.0;
    drivers.push("Sensitive surface: API/service paths");
  }
  score += clamp(sensitive, 0, 3.2);

  // Test coverage modifier
  const codeFileCount = paths.filter(isCodeFile).length;
  const testFileCount = paths.filter(isTestFile).length;
  if (codeFileCount > 0 && testFileCount === 0) {
    score += 0.6;
    drivers.push("No test files changed with code changes");
  } else if (testFileCount > 0) {
    score -= 0.4;
    drivers.push("Test files updated in same change");
  }

  // Uncertainty and extraction confidence
  if (options.trimmed) {
    score += 0.7;
    drivers.push("Context trimmed by token budget");
  }
  if (options.coverage === "partial") {
    score += 0.5;
    drivers.push("Partial deep-scan coverage");
  }
  if (fileCount === 0) {
    score += 0.8;
    drivers.push("No file context extracted");
  }

  return {
    score: round1(clamp(score, 0, 10)),
    drivers
  };
}

export function blendRiskScores(aiScore: number, deterministicScore: number): number {
  const weighted = aiScore * 0.4 + deterministicScore * 0.6;
  const floorFromDeterministic = deterministicScore - 0.8;
  const final = Math.max(weighted, floorFromDeterministic);
  return round1(clamp(final, 0, 10));
}

