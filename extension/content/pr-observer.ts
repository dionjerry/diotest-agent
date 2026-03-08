import { isPrUrl, normalizePrContext, parseRepoAndPrNumber } from "../../engine/pr/parser";
import type { PrExtractResult } from "../../engine/pr/types";

function textFromSelectors(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function getChangedFiles(): string[] {
  const paths = new Set<string>();
  document.querySelectorAll<HTMLElement>("[data-path]").forEach((el) => {
    const path = el.getAttribute("data-path")?.trim();
    if (path) paths.add(path);
  });
  return Array.from(paths);
}

function extractPrContext(): PrExtractResult {
  const url = window.location.href;
  if (!isPrUrl(url)) {
    return { ok: false, error: "Not a supported GitHub PR URL." };
  }

  const parsed = parseRepoAndPrNumber(url);
  if (!parsed) {
    return { ok: false, error: "Unable to parse repository or PR number from URL." };
  }

  const title = textFromSelectors(["span.js-issue-title", "bdi.js-issue-title", "h1.gh-header-title"]) || "Untitled PR";
  const description = textFromSelectors(["#issue-body", "td.comment-body", "div.comment-body"]) || "";

  const normalized = normalizePrContext({
    repo: parsed.repo,
    prNumber: parsed.prNumber,
    title,
    description,
    changedFiles: getChangedFiles(),
    url
  });

  return { ok: true, context: normalized };
}

function notifyPrState(): void {
  const onPr = isPrUrl(window.location.href);
  void chrome.runtime.sendMessage({ type: "pr.pageState", payload: { onPr, url: window.location.href } });
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message.type === "pr.extract") {
    const payload = extractPrContext();
    sendResponse({ type: "pr.extract.result", payload });
    return true;
  }
  return false;
});

document.addEventListener("pjax:end", notifyPrState);
window.addEventListener("popstate", notifyPrState);
notifyPrState();
