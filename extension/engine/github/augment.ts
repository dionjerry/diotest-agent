import type { ExtractionContext, ExtractionFile } from "../analysis/types";

function mergeFiles(base: ExtractionFile[], incoming: ExtractionFile[]): ExtractionFile[] {
  const map = new Map<string, ExtractionFile>();
  for (const item of base) map.set(item.path, item);
  for (const item of incoming) {
    const current = map.get(item.path);
    map.set(item.path, {
      path: item.path,
      patch: item.patch ?? current?.patch,
      source: item.source
    });
  }
  return Array.from(map.values());
}

export async function augmentWithGithubApi(context: ExtractionContext, token: string): Promise<{ context: ExtractionContext; warning?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    if (context.pageType === "pull_request" && context.prNumber) {
      const url = `https://api.github.com/repos/${context.repo}/pulls/${context.prNumber}/files?per_page=100`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        return { context, warning: `GitHub API PR files unavailable (${resp.status}).` };
      }
      const files = (await resp.json()) as Array<{ filename?: string; patch?: string }>;
      const enriched = files
        .filter((f) => !!f.filename)
        .map((f) => ({ path: f.filename as string, patch: f.patch, source: "github_api" as const }));

      return { context: { ...context, files: mergeFiles(context.files, enriched) } };
    }

    if (context.pageType === "commit" && context.commitSha) {
      const url = `https://api.github.com/repos/${context.repo}/commits/${context.commitSha}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        return { context, warning: `GitHub API commit details unavailable (${resp.status}).` };
      }
      const payload = (await resp.json()) as { files?: Array<{ filename?: string; patch?: string }> };
      const enriched = (payload.files ?? [])
        .filter((f) => !!f.filename)
        .map((f) => ({ path: f.filename as string, patch: f.patch, source: "github_api" as const }));

      return { context: { ...context, files: mergeFiles(context.files, enriched) } };
    }

    return { context, warning: "Unsupported context for deep scan." };
  } catch {
    return { context, warning: "GitHub API deep scan request failed." };
  }
}
