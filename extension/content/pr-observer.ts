function isPrUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}

function notifyPrState(): void {
  const onPr = isPrUrl(window.location.href);
  void chrome.runtime.sendMessage({ type: "pr.pageState", payload: { onPr, url: window.location.href } });
}

document.addEventListener("pjax:end", notifyPrState);
window.addEventListener("popstate", notifyPrState);
notifyPrState();
