import type { ExtractionContext } from "@diotest/domain/analysis/types";

export function estimateTokens(input: string): number {
  return Math.ceil(input.length / 4);
}

export function summarizeContext(context: ExtractionContext, maxDiffLines: number, maxFiles: number): {
  summary: string;
  tokenEstimate: number;
  trimmed: boolean;
} {
  const fileLimit = Math.max(1, maxFiles);
  const selected = context.files.slice(0, fileLimit);

  let lineBudget = Math.max(50, maxDiffLines);
  const lines: string[] = [];
  for (const file of selected) {
    lines.push(`FILE: ${file.path}`);
    if (file.patch) {
      const patchLines = file.patch.split("\n").slice(0, Math.min(120, lineBudget));
      lineBudget -= patchLines.length;
      lines.push(...patchLines);
      if (lineBudget <= 0) break;
    }
    if (lineBudget <= 0) break;
  }

  const header = [
    `PAGE_TYPE: ${context.pageType}`,
    `REPO: ${context.repo}`,
    `REF: ${context.prNumber ?? context.commitSha ?? "unknown"}`,
    `TITLE: ${context.title}`,
    `DESCRIPTION: ${context.description || "(none)"}`,
    `FILES_COUNT: ${context.files.length}`
  ];

  const summary = [...header, ...lines].join("\n");
  return {
    summary,
    tokenEstimate: estimateTokens(summary),
    trimmed: context.files.length > fileLimit || lineBudget <= 0
  };
}
