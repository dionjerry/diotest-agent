import type { PrContext, RawPrContext } from "./types";

export function isPrUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}

export function isCommitUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[a-f0-9]{7,40}/i.test(url);
}

export function isSupportedGithubReviewUrl(url: string): boolean {
  return isPrUrl(url) || isCommitUrl(url);
}

export function parseRepoAndPrNumber(url: string): { repo: string; prNumber: number } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repoName, prNumberRaw] = match;
  const prNumber = Number(prNumberRaw);
  if (!Number.isFinite(prNumber)) return null;
  return { repo: `${owner}/${repoName}`, prNumber };
}

export function parseRepoAndCommitSha(url: string): { repo: string; commitSha: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})/i);
  if (!match) return null;
  const [, owner, repoName, commitSha] = match;
  return { repo: `${owner}/${repoName}`, commitSha };
}

export function normalizePrContext(raw: RawPrContext): PrContext {
  const url = (raw.url ?? "").trim();
  const parsed = parseRepoAndPrNumber(url);
  const parsedCommit = parseRepoAndCommitSha(url);
  const fallbackRepo = (raw.repo ?? "unknown/unknown").trim();
  const fallbackPr = Number(raw.prNumber ?? 0);
  const fallbackCommit = (raw.commitSha ?? "").trim();
  const pageType = raw.pageType ?? (parsedCommit ? "commit" : "pull_request");

  const changedFiles = Array.from(
    new Set((raw.changedFiles ?? []).map((f) => f.trim()).filter(Boolean))
  );

  return {
    pageType,
    repo: parsed?.repo ?? fallbackRepo,
    prNumber: parsed?.prNumber ?? (Number.isFinite(fallbackPr) && fallbackPr > 0 ? fallbackPr : undefined),
    commitSha: parsedCommit?.commitSha ?? (fallbackCommit || undefined),
    title: (raw.title ?? (pageType === "commit" ? "Untitled Commit" : "Untitled PR")).trim(),
    description: (raw.description ?? "").trim(),
    changedFiles,
    url,
    extractionSource: raw.extractionSource ?? "dom"
  };
}
