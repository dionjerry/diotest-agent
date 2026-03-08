import type { ExtractionContext, ExtractionFile } from "./types";

function isGeneratedBuildArtifact(path: string): boolean {
  const p = path.toLowerCase();

  if (p.endsWith(".map") || p.endsWith(".min.js") || p.endsWith(".min.css")) {
    return true;
  }
  if (p.includes("/dist/") || p.includes("/build/")) {
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

export function filterContextFiles(context: ExtractionContext): {
  context: ExtractionContext;
  removedCount: number;
} {
  const filteredFiles: ExtractionFile[] = [];
  let removedCount = 0;

  for (const file of context.files) {
    if (isGeneratedBuildArtifact(file.path)) {
      removedCount += 1;
      continue;
    }
    filteredFiles.push(file);
  }

  return {
    context: { ...context, files: filteredFiles },
    removedCount
  };
}

