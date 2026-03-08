function stamp(date = new Date()): string {
  return date.toISOString().replace(/[:T]/g, "-").slice(0, 16);
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildPrExportFilename(repo: string, prNumber: number, ext: "json" | "md"): string {
  return `diotest_pr_${sanitize(repo)}_${prNumber}.${ext}`;
}

export function buildUiSessionExportFilename(domain: string, ext: "json" | "md", date = new Date()): string {
  return `diotest_ui_session_${sanitize(domain)}_${stamp(date)}.${ext}`;
}
