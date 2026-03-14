export {};

type RecorderAction =
  | "click"
  | "input"
  | "change"
  | "select"
  | "submit"
  | "focus"
  | "blur"
  | "scroll"
  | "keydown"
  | "navigation";

interface RecorderRuntimeState {
  active: boolean;
  sessionId: string;
  throttleMs: number;
}

declare global {
  interface Window {
    __diotestRecorderInstalled?: boolean;
    __diotestRecorderState?: RecorderRuntimeState;
  }
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const compact = (value ?? "").replace(/\s+/g, " ").trim();
  return compact || fallback;
}

function sanitizeLabelText(value: string | null | undefined, fallback: string): string {
  const compact = normalizeText(value, fallback);
  if (!compact) return fallback;
  if (/^window\./i.test(compact)) return fallback;
  if (compact.includes("{") && compact.includes("}")) return fallback;
  if (/function\s*\(|=>|var\s+|const\s+|let\s+/i.test(compact)) return fallback;
  if (compact.length > 120) return `${compact.slice(0, 117)}...`;
  return compact;
}

function buildSelector(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (element instanceof HTMLElement && element.dataset.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }
  if (element instanceof HTMLElement && element.id) {
    return `#${element.id}`;
  }
  const tag = element.tagName.toLowerCase();
  const name = element instanceof HTMLElement ? element.getAttribute("name") : null;
  if (name) return `${tag}[name="${name}"]`;
  const role = element instanceof HTMLElement ? element.getAttribute("role") : null;
  if (role) return `${tag}[role="${role}"]`;
  return tag;
}

function buildLabel(element: Element | null, action: RecorderAction): string {
  if (action === "navigation") {
    return sanitizeLabelText(document.title, location.hostname);
  }
  if (action === "scroll") {
    return "page";
  }
  if (!element) {
    return "page";
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return sanitizeLabelText(element.getAttribute("aria-label") || element.name || element.placeholder, element.tagName.toLowerCase());
  }
  if (element instanceof HTMLSelectElement) {
    return sanitizeLabelText(element.getAttribute("aria-label") || element.name, element.tagName.toLowerCase());
  }
  return sanitizeLabelText(
    (element as HTMLElement).getAttribute?.("aria-label") || element.textContent,
    element.tagName.toLowerCase()
  );
}

function shouldCaptureKey(event: KeyboardEvent): boolean {
  return ["Enter", "Escape", "Tab"].includes(event.key);
}

function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function uniqueTexts(elements: Element[], fallbackPrefix: string, maxItems: number): string[] {
  const values: string[] = [];
  for (const element of elements) {
    if (!isVisible(element)) continue;
    const text = sanitizeLabelText(
      (element as HTMLElement).getAttribute("aria-label") ||
      (element as HTMLInputElement).placeholder ||
      element.textContent,
      `${fallbackPrefix} ${values.length + 1}`
    );
    if (!text || values.includes(text)) continue;
    values.push(text);
    if (values.length >= maxItems) break;
  }
  return values;
}

function buildPageSummary(): {
  url: string;
  title: string;
  summary: string;
  headings: string[];
  actions: string[];
  fields: string[];
  sections: string[];
} {
  const headings = uniqueTexts(Array.from(document.querySelectorAll("h1, h2, h3")), "heading", 6);
  const actions = uniqueTexts(Array.from(document.querySelectorAll("button, a, [role='button']")), "action", 8);
  const fields = uniqueTexts(Array.from(document.querySelectorAll("input, textarea, select")), "field", 8);
  const sections = uniqueTexts(Array.from(document.querySelectorAll("main, section, article, nav, aside")), "section", 6);
  const faqs = uniqueTexts(Array.from(document.querySelectorAll("summary, details, [aria-expanded], [role='tab']")), "faq", 6);
  const plans = uniqueTexts(Array.from(document.querySelectorAll("[data-testid*='plan'], [class*='plan'], [id*='plan'], [id*='checkout'], [class*='checkout']")), "plan", 6);
  const dialogs = uniqueTexts(Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true'], .modal, [id*='popup']")), "dialog", 6);
  const navigation = uniqueTexts(Array.from(document.querySelectorAll("header a, nav a, footer a")), "navigation", 8);
  const parts = [
    headings.length > 0 ? `Headings: ${headings.join("; ")}` : "",
    fields.length > 0 ? `Fields: ${fields.join("; ")}` : "",
    actions.length > 0 ? `Actions: ${actions.join("; ")}` : "",
    sections.length > 0 ? `Sections: ${sections.join("; ")}` : "",
    faqs.length > 0 ? `FAQs: ${faqs.join("; ")}` : "",
    plans.length > 0 ? `Plans: ${plans.join("; ")}` : "",
    dialogs.length > 0 ? `Dialogs: ${dialogs.join("; ")}` : "",
    navigation.length > 0 ? `Navigation: ${navigation.join("; ")}` : "",
  ].filter(Boolean);

  return {
    url: location.href,
    title: sanitizeLabelText(document.title, location.hostname),
    summary: parts.join(" | ") || "Visible UI state captured with limited detail.",
    headings,
    actions: [...actions, ...navigation].slice(0, 12),
    fields,
    sections: [...sections, ...plans, ...dialogs, ...faqs].slice(0, 12),
  };
}

function currentState(): RecorderRuntimeState | null {
  return window.__diotestRecorderState?.active ? window.__diotestRecorderState : null;
}

async function emit(action: RecorderAction, target: EventTarget | null, extra?: { value?: string; key?: string }): Promise<void> {
  const state = currentState();
  if (!state) return;
  const element = target instanceof Element ? target : document.activeElement;
  await chrome.runtime.sendMessage({
    type: "recorder.event",
    payload: {
      sessionId: state.sessionId,
      timestamp: new Date().toISOString(),
      action,
      url: location.href,
      title: buildLabel(element, action),
      selector: buildSelector(element),
      value: extra?.value,
      key: extra?.key,
    },
  });
}

function installRecorderListeners(): void {
  if (window.__diotestRecorderInstalled) return;
  window.__diotestRecorderInstalled = true;

  let lastScrollAt = 0;

  document.addEventListener("click", (event) => {
    void emit("click", event.target);
  }, true);

  document.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    void emit("input", event.target, { value: target?.value });
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    const action: RecorderAction = target instanceof HTMLSelectElement ? "select" : "change";
    void emit(action, event.target, { value: target?.value });
  }, true);

  document.addEventListener("submit", (event) => {
    void emit("submit", event.target);
  }, true);

  document.addEventListener("focusin", (event) => {
    void emit("focus", event.target);
  }, true);

  document.addEventListener("focusout", (event) => {
    void emit("blur", event.target);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!shouldCaptureKey(event)) return;
    void emit("keydown", event.target, { key: event.key });
  }, true);

  window.addEventListener("scroll", () => {
    const state = currentState();
    if (!state) return;
    const now = Date.now();
    if (now - lastScrollAt < state.throttleMs) return;
    lastScrollAt = now;
    void emit("scroll", document.documentElement, { value: `${window.scrollX},${window.scrollY}` });
  }, true);

  window.addEventListener("hashchange", () => {
    void emit("navigation", document.body);
  });

  window.addEventListener("popstate", () => {
    void emit("navigation", document.body);
  });
}

installRecorderListeners();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "recorder.control") return;
  if (message.payload?.action === "start") {
    window.__diotestRecorderState = {
      active: true,
      sessionId: String(message.payload.sessionId),
      throttleMs: Number(message.payload.throttleMs ?? 500),
    };
    sendResponse({ ok: true });
    return true;
  }

  if (message.payload?.action === "stop") {
    window.__diotestRecorderState = undefined;
    sendResponse({ ok: true });
    return true;
  }

  if (message.payload?.action === "summarize_page") {
    sendResponse({ ok: true, summary: buildPageSummary() });
    return true;
  }

  return undefined;
});
