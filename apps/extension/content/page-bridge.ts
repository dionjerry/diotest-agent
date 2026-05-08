// Announce extension presence to the page
function announce() {
  window.dispatchEvent(
    new CustomEvent('diotest:extension:installed', {
      detail: { version: chrome.runtime.getManifest().version },
    }),
  );
}

// Fire immediately on script load
announce();

// Re-fire if the page re-requests it (handles hard refresh race condition)
window.addEventListener('diotest:page:ready', announce);
