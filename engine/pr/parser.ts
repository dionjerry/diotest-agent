import type { PrContext, RawPrContext } from "./types";

export function isPrUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}

export function parseRepoAndPrNumber(url: string): { repo: string; prNumber: number } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repoName, prNumberRaw] = match;
  const prNumber = Number(prNumberRaw);
  if (!Number.isFinite(prNumber)) return null;
  return { repo: `${owner}/${repoName}`, prNumber };
}

export function normalizePrContext(raw: RawPrContext): PrContext {
  const url = (raw.url ?? "").trim();
  const parsed = parseRepoAndPrNumber(url);
  const fallbackRepo = (raw.repo ?? "unknown/unknown").trim();
  const fallbackPr = Number(raw.prNumber ?? 0);

  const changedFiles = Array.from(
    new Set((raw.changedFiles ?? []).map((f) => f.trim()).filter(Boolean))
  );

  return {
    repo: parsed?.repo ?? fallbackRepo,
    prNumber: parsed?.prNumber ?? (Number.isFinite(fallbackPr) ? fallbackPr : 0),
    title: (raw.title ?? "Untitled PR").trim(),
    description: (raw.description ?? "").trim(),
    changedFiles,
    url
  };
}
