// extension/engine/pr/parser.ts
function isPrUrl(url) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}
function isCommitUrl(url) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[a-f0-9]{7,40}/i.test(url);
}
function isSupportedGithubReviewUrl(url) {
  return isPrUrl(url) || isCommitUrl(url);
}
function parseRepoAndPrNumber(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repoName, prNumberRaw] = match;
  const prNumber = Number(prNumberRaw);
  if (!Number.isFinite(prNumber)) return null;
  return { repo: `${owner}/${repoName}`, prNumber };
}
function parseRepoAndCommitSha(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})/i);
  if (!match) return null;
  const [, owner, repoName, commitSha] = match;
  return { repo: `${owner}/${repoName}`, commitSha };
}
function normalizePrContext(raw) {
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
    prNumber: parsed?.prNumber ?? (Number.isFinite(fallbackPr) && fallbackPr > 0 ? fallbackPr : void 0),
    commitSha: parsedCommit?.commitSha ?? (fallbackCommit || void 0),
    title: (raw.title ?? (pageType === "commit" ? "Untitled Commit" : "Untitled PR")).trim(),
    description: (raw.description ?? "").trim(),
    changedFiles,
    url
  };
}

// extension/content/pr-observer.ts
function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}
function getChangedFiles() {
  const paths = /* @__PURE__ */ new Set();
  document.querySelectorAll("[data-path]").forEach((el) => {
    const path = el.getAttribute("data-path")?.trim();
    if (path) paths.add(path);
  });
  document.querySelectorAll("[data-testid='diff-file-name']").forEach((el) => {
    const path = el.textContent?.trim();
    if (path) paths.add(path);
  });
  document.querySelectorAll("a[href*='/files#diff-']").forEach((el) => {
    const path = el.textContent?.trim();
    if (path && path.includes("/")) paths.add(path);
  });
  return Array.from(paths);
}
function getPageTitleFallback(parsedCommit) {
  const raw = document.title?.trim() ?? "";
  if (!raw) return parsedCommit ? "Untitled Commit" : "Untitled PR";
  const withoutRepo = raw.split(" by ")[0]?.trim() || raw;
  return withoutRepo.replace(/\s*·\s*[^·]+$/g, "").trim();
}
function extractPrContext() {
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
    url
  });
  return { ok: true, context: normalized };
}
function notifyPrState() {
  const onPr = isSupportedGithubReviewUrl(window.location.href);
  void chrome.runtime.sendMessage({ type: "pr.pageState", payload: { onPr, url: window.location.href } });
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
