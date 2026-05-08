// apps/extension/content/page-bridge.ts
function announce() {
  window.dispatchEvent(
    new CustomEvent("diotest:extension:installed", {
      detail: { version: chrome.runtime.getManifest().version }
    })
  );
}
announce();
window.addEventListener("diotest:page:ready", announce);
