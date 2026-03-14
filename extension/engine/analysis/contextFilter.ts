import type { ExtractionContext, ExtractionFile } from "./types";

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/");
}

function isGeneratedBuildArtifact(path: string): boolean {
  const p = path.toLowerCase();

  if (p.endsWith(".map") || p.endsWith(".min.js") || p.endsWith(".min.css") || p.endsWith(".lock")) {
    return true;
  }
  if (p.includes("/dist/") || p.includes("/build/") || p.includes("/vendor/") || p.includes("/coverage/")) {
    return true;
  }

  // Extension build outputs that duplicate TS/CSS sources in this repo.
  const knownCompiled = new Set([
    "extension/background/index.js",
    "extension/content/pr-observer.js",
    "extension/sidepanel/main.js",
    "extension/sidepanel/main.css",
    "extension/popup/main.js"
  ]);
  return knownCompiled.has(path);
}

function relevanceScore(file: ExtractionFile): number {
  const path = file.path.toLowerCase();
  let score = 0;

  if (file.patch) score += 3;
  if (/(auth|token|session|security|permission|credential|oauth)/.test(path)) score += 6;
  if (/(api|route|controller|handler|service|gateway|proxy|runtime|config|settings)/.test(path)) score += 5;
  if (/(db|database|schema|migration|model|sql|storage)/.test(path)) score += 5;
  if (/(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(path)) score += 4;
  if (/(readme|changelog|license|docs\/)/.test(path)) score -= 3;
  if (/\.(png|jpg|jpeg|gif|svg|ico|md)$/.test(path)) score -= 2;

  return score;
}

export function filterContextFiles(context: ExtractionContext): {
  context: ExtractionContext;
  removedCount: number;
  droppedFilesSummary: Array<{ path: string; reason: string }>;
} {
  const deduped = new Map<string, ExtractionFile>();
  for (const file of context.files) {
    const path = normalizePath(file.path);
    const existing = deduped.get(path);
    deduped.set(path, {
      ...file,
      path,
      patch: file.patch ?? existing?.patch
    });
  }

  const filteredFiles: ExtractionFile[] = [];
  const droppedFilesSummary: Array<{ path: string; reason: string }> = [];
  let removedCount = 0;

  for (const file of deduped.values()) {
    if (isGeneratedBuildArtifact(file.path)) {
      removedCount += 1;
      droppedFilesSummary.push({ path: file.path, reason: "generated_or_low_signal_artifact" });
      continue;
    }
    filteredFiles.push(file);
  }

  filteredFiles.sort((a, b) => relevanceScore(b) - relevanceScore(a));

  return {
    context: { ...context, files: filteredFiles },
    removedCount,
    droppedFilesSummary
  };
}
