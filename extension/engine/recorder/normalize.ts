import type { RawRecorderEvent, UiRecorderStep } from "./types";

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 120): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

function sanitizeLabel(value: string | undefined, fallback: string): string {
  const compact = compactWhitespace(value ?? "");
  if (!compact) return fallback;
  if (/^window\./i.test(compact)) return fallback;
  if (compact.includes("{") && compact.includes("}")) return fallback;
  if (/function\s*\(|=>|var\s+|const\s+|let\s+/i.test(compact)) return fallback;
  return truncate(compact, 90);
}

function parseScrollPosition(value?: string): { x: number; y: number } | null {
  if (!value) return null;
  const [rawX, rawY] = value.split(",");
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function scrollDistance(a?: string, b?: string): number | null {
  const first = parseScrollPosition(a);
  const second = parseScrollPosition(b);
  if (!first || !second) return null;
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function buildTitle(event: RawRecorderEvent): string {
  const fallback = event.action === "scroll" ? "page" : event.selector || event.action;
  const label = sanitizeLabel(event.title || event.selector || event.action, fallback);
  switch (event.action) {
    case "click":
      return truncate(`Click ${label}`);
    case "input":
    case "change":
      return truncate(`Enter ${event.value ? `"${compactWhitespace(event.value)}"` : "value"} in ${label}`);
    case "select":
      return truncate(`Select ${event.value ? `"${compactWhitespace(event.value)}"` : "option"} in ${label}`);
    case "submit":
      return truncate(`Submit ${label}`);
    case "scroll":
      return truncate(`Scroll ${label}`);
    case "focus":
      return truncate(`Focus ${label}`);
    case "blur":
      return truncate(`Blur ${label}`);
    case "navigation":
      return truncate(`Navigate to ${label}`);
    case "keydown":
      return truncate(`Press ${event.key ?? "key"} on ${label}`);
    default:
      return truncate(label);
  }
}

function normalizeValue(action: RawRecorderEvent["action"], value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = compactWhitespace(value);
  if (!normalized) return undefined;
  if (action === "input" || action === "change" || action === "select" || action === "scroll") {
    return truncate(normalized, 100);
  }
  return undefined;
}

function sameLogicalTarget(a: UiRecorderStep, b: RawRecorderEvent): boolean {
  return a.action === b.action && a.selector === b.selector && a.url === b.url;
}

function sameTargetIgnoringAction(a: UiRecorderStep, b: RawRecorderEvent): boolean {
  return a.selector === b.selector && a.url === b.url;
}

export function normalizeRecorderEvent(event: RawRecorderEvent): UiRecorderStep {
  return {
    id: crypto.randomUUID(),
    timestamp: event.timestamp,
    action: event.action,
    title: buildTitle(event),
    selector: event.selector,
    url: event.url,
    value: normalizeValue(event.action, event.value),
    key: event.key,
    kept: true,
  };
}

export function mergeRecorderEvent(
  existing: UiRecorderStep[],
  next: RawRecorderEvent,
  throttleMs: number
): { steps: UiRecorderStep[]; merged: boolean } {
  const normalized = normalizeRecorderEvent(next);
  const last = existing[existing.length - 1];
  if (!last) {
    return { steps: [normalized], merged: false };
  }

  const deltaMs = new Date(normalized.timestamp).getTime() - new Date(last.timestamp).getTime();
  const withinThrottle = deltaMs <= throttleMs;
  const withinReviewWindow = deltaMs <= Math.max(throttleMs * 3, 1500);

  if (
    withinThrottle &&
    sameLogicalTarget(last, next) &&
    (next.action === "input" || next.action === "change" || next.action === "select")
  ) {
    const updated = [...existing];
    updated[updated.length - 1] = {
      ...last,
      timestamp: normalized.timestamp,
      title: normalized.title,
      value: normalized.value ?? last.value,
      url: normalized.url,
    };
    return { steps: updated, merged: true };
  }

  if (
    next.action === "scroll" &&
    last.action === "scroll" &&
    last.url === next.url &&
    withinReviewWindow
  ) {
    const distance = scrollDistance(last.value, next.value);
    if (distance === null || distance < 1600) {
      const updated = [...existing];
      updated[updated.length - 1] = {
        ...last,
        timestamp: normalized.timestamp,
        title: normalized.title,
        value: normalized.value ?? last.value,
      };
      return { steps: updated, merged: true };
    }
  }

  if (
    next.action === "click" &&
    last.action === "focus" &&
    sameTargetIgnoringAction(last, next) &&
    withinReviewWindow
  ) {
    return {
      steps: [...existing.slice(0, -1), normalized],
      merged: true,
    };
  }

  if (
    next.action === "blur" &&
    ["input", "change", "select", "click", "submit"].includes(last.action) &&
    sameTargetIgnoringAction(last, next) &&
    withinReviewWindow
  ) {
    return { steps: existing, merged: true };
  }

  return { steps: [...existing, normalized], merged: false };
}
