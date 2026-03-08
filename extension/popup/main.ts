async function getActiveTabId(): Promise<number | null> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active?.id ?? null;
}

function showStatus(message: string): void {
  const el = document.createElement("p");
  el.textContent = message;
  el.style.margin = "0";
  el.style.fontSize = "12px";
  el.style.color = "#94a3b8";
  document.querySelector(".wrap")?.appendChild(el);
}

async function openPanelWithIntent(intent: "review" | "review_analyze" | "settings"): Promise<void> {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      showStatus("No active tab detected.");
      return;
    }

    const res = await chrome.runtime.sendMessage({
      type: "ui.openPanel",
      payload: { tabId, intent }
    }) as { ok?: boolean; mode?: string; error?: string };

    if (!res?.ok) {
      showStatus(res?.error ?? "Unable to open DioTest side panel.");
      return;
    }

    window.close();
  } catch (err) {
    showStatus(`Failed to open workspace: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

document.getElementById("open")?.addEventListener("click", () => {
  void openPanelWithIntent("review");
});

document.getElementById("analyze")?.addEventListener("click", () => {
  void openPanelWithIntent("review_analyze");
});

document.getElementById("settings")?.addEventListener("click", () => {
  void openPanelWithIntent("settings");
});
