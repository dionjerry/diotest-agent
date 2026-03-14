import {
  isSupportedGithubReviewUrl,
  normalizePrContext,
  parseRepoAndCommitSha,
  parseRepoAndPrNumber
} from "@diotest/engine/pr/parser";
import type { PrContractMessage } from "@diotest/domain/contracts/messages";
import type { PrExtractResult } from "@diotest/domain/pr/types";

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
  const add = (value: string | null | undefined) => {
    const path = value?.trim();
    if (!path) return;
    if (!path.includes("/") && !path.includes(".")) return;
    paths.add(path.replace(/\s+/g, " "));
  };

  document.querySelectorAll<HTMLElement>("[data-path]").forEach((el) => {
    add(el.getAttribute("data-path"));
  });

  document.querySelectorAll<HTMLElement>("[data-tagsearch-path]").forEach((el) => {
    add(el.getAttribute("data-tagsearch-path"));
  });

  document.querySelectorAll<HTMLElement>(".file-info a.Link--primary, .file-header a.Link--primary").forEach((el) => {
    add(el.getAttribute("title"));
    add(el.textContent);
  });

  document.querySelectorAll<HTMLElement>("[data-testid='diff-file-name']").forEach((el) => {
    add(el.textContent);
  });

  document.querySelectorAll<HTMLAnchorElement>("a[href*='/files#diff-']").forEach((el) => {
    add(el.textContent);
    add(el.getAttribute("title"));
  });

  document.querySelectorAll<HTMLAnchorElement>("a[href*='#diff-']").forEach((el) => {
    add(el.textContent);
    add(el.getAttribute("title"));
  });

  document.querySelectorAll<HTMLElement>("[title][data-hovercard-type='blob']").forEach((el) => {
    add(el.getAttribute("title"));
  });

  return Array.from(paths);
}

function getPageTitleFallback(parsedCommit: boolean): string {
  const raw = document.title?.trim() ?? "";
  if (!raw) return parsedCommit ? "Untitled Commit" : "Untitled PR";
  // PR page titles commonly include " by " and repo suffix.
  const withoutRepo = raw.split(" by ")[0]?.trim() || raw;
  return withoutRepo.replace(/\s*·\s*[^·]+$/g, "").trim();
}

function extractPrContext(): PrExtractResult {
  const url = window.location.href;
  if (!isSupportedGithubReviewUrl(url)) {
    return { ok: false, error: "Not a supported GitHub PR or commit URL." };
  }

  const parsed = parseRepoAndPrNumber(url);
  const parsedCommit = parseRepoAndCommitSha(url);
  if (!parsed && !parsedCommit) {
    return { ok: false, error: "Unable to parse repository and PR/commit reference from URL." };
  }

  const title = textFromSelectors([
    "span.js-issue-title",
    "bdi.js-issue-title",
    "h1.gh-header-title",
    "[data-testid='issue-title']",
    "h1"
  ]) || getPageTitleFallback(!!parsedCommit);
  const description = textFromSelectors(["#issue-body", "td.comment-body", "div.comment-body"]) || "";

  const normalized = normalizePrContext({
    pageType: parsedCommit ? "commit" : "pull_request",
    repo: parsed?.repo ?? parsedCommit?.repo,
    prNumber: parsed?.prNumber,
    commitSha: parsedCommit?.commitSha,
    title,
    description,
    changedFiles: getChangedFiles(),
    url,
    extractionSource: "dom"
  });

  return { ok: true, context: normalized };
}

function notifyPrState(): void {
  const onPr = isSupportedGithubReviewUrl(window.location.href);
  void chrome.runtime.sendMessage({ type: "pr.pageState", payload: { onPr, url: window.location.href } });
}

chrome.runtime.onMessage.addListener((message: PrContractMessage, _sender, sendResponse) => {
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
