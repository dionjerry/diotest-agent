import {
  DEFAULT_MAX_UI_RECORDER_SESSIONS,
  type RecorderPageSummaryPayload,
  UI_RECORDER_SESSIONS_KEY,
  type RawRecorderEvent,
  type RecorderActiveState,
  type UiRecorderGenerationOptions,
  type UiRecorderScreenshotRef,
  type UiRecorderPageSummary,
  type UiRecorderSession,
  type UiRecorderSessionGroup,
} from "@diotest/domain/recorder/types";
import { mergeRecorderEvent } from "@diotest/engine/recorder/normalize";

function parseStoredSessions(value: unknown): UiRecorderSession[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => !!item && typeof item === "object") as UiRecorderSession[];
}

function byNewestStartedAt(a: UiRecorderSession, b: UiRecorderSession): number {
  return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
}

function estimateSizeMb(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size / (1024 * 1024);
}

function withStorageBudget(session: UiRecorderSession, maxMb: number): UiRecorderSession {
  if (estimateSizeMb(session) <= maxMb) return session;
  const screenshotsRemoved = session.steps.some((step) => !!step.screenshot);
  const stripped = {
    ...session,
    steps: session.steps.map((step) => ({ ...step, screenshot: undefined })),
    screenshotsCaptured: 0,
    storageTrimmed: session.storageTrimmed || screenshotsRemoved,
    warnings: screenshotsRemoved
      ? [...new Set([...session.warnings, "Storage budget reached; screenshots were dropped from this session."])]
      : session.warnings,
  };
  return stripped;
}

function enforceRecorderRetention(sessions: UiRecorderSession[], maxSessions = DEFAULT_MAX_UI_RECORDER_SESSIONS): UiRecorderSession[] {
  return [...sessions].sort(byNewestStartedAt).slice(0, maxSessions);
}

function mergePageSummary(existing: UiRecorderPageSummary[] | undefined, next: RecorderPageSummaryPayload): UiRecorderPageSummary[] {
  const current = existing ?? [];
  const summary: UiRecorderPageSummary = {
    id: crypto.randomUUID(),
    url: next.url,
    title: next.title,
    capturedAt: new Date().toISOString(),
    summary: next.summary,
    headings: next.headings,
    actions: next.actions,
    fields: next.fields,
    sections: next.sections,
  };
  const filtered = current.filter((item) => item.url !== next.url);
  return [...filtered, summary].slice(-12);
}

async function writeSessions(sessions: UiRecorderSession[]): Promise<void> {
  await chrome.storage.local.set({ [UI_RECORDER_SESSIONS_KEY]: sessions });
}

export async function listUiRecorderSessions(): Promise<UiRecorderSessionGroup[]> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]).sort(byNewestStartedAt);
  const byDomain = new Map<string, UiRecorderSession[]>();
  for (const session of sessions) {
    const list = byDomain.get(session.domain) ?? [];
    list.push(session);
    byDomain.set(session.domain, list);
  }
  return Array.from(byDomain.entries())
    .map(([domain, domainSessions]) => ({
      domain,
      sessionCount: domainSessions.length,
      lastUpdatedAt: domainSessions[0]?.stoppedAt ?? domainSessions[0]?.startedAt ?? new Date(0).toISOString(),
      sessions: domainSessions,
    }))
    .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
}

export async function getUiRecorderSession(sessionId: string): Promise<UiRecorderSession | null> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function createUiRecorderSession(active: RecorderActiveState, name: string, startUrl: string): Promise<UiRecorderSession> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const existing = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  const session: UiRecorderSession = {
    id: active.sessionId,
    name,
    domain: active.domain,
    startUrl,
    lastUrl: startUrl,
    startedAt: active.startedAt,
    status: "recording",
    steps: [],
    pageSummaries: [],
    warnings: [],
    screenshotsCaptured: 0,
    storageTrimmed: false,
  };
  await writeSessions(enforceRecorderRetention([session, ...existing]));
  return session;
}

export async function appendUiRecorderEvent(
  active: RecorderActiveState,
  event: RawRecorderEvent,
  screenshot?: UiRecorderScreenshotRef,
  pageSummary?: RecorderPageSummaryPayload
): Promise<UiRecorderSession | null> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  const target = sessions.find((session) => session.id === active.sessionId);
  if (!target) return null;

  const throttled = Math.round(1000 / Math.max(1, active.eventThrottlePerSecond));
  const merged = mergeRecorderEvent(target.steps, event, throttled);
  let steps = merged.steps;
  if (screenshot && steps.length > 0) {
    const last = steps[steps.length - 1];
    steps = [...steps.slice(0, -1), { ...last, screenshot }];
  }

  let updated: UiRecorderSession = {
    ...target,
    lastUrl: event.url,
    steps,
    pageSummaries: pageSummary ? mergePageSummary(target.pageSummaries, pageSummary) : target.pageSummaries ?? [],
    screenshotsCaptured: steps.filter((step) => !!step.screenshot).length,
  };
  updated = withStorageBudget(updated, active.maxSessionStorageMB);

  const nextSessions = sessions.map((session) => (session.id === updated.id ? updated : session));
  await writeSessions(nextSessions);
  return updated;
}

export async function finalizeUiRecorderSession(sessionId: string): Promise<UiRecorderSession | null> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  const current = sessions.find((session) => session.id === sessionId);
  if (!current) return null;
  const updated: UiRecorderSession = {
    ...current,
    stoppedAt: new Date().toISOString(),
    status: "review",
  };
  await writeSessions(sessions.map((session) => (session.id === sessionId ? updated : session)));
  return updated;
}

export async function updateUiRecorderSession(sessionId: string, updater: (session: UiRecorderSession) => UiRecorderSession): Promise<UiRecorderSession | null> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  const current = sessions.find((session) => session.id === sessionId);
  if (!current) return null;
  const updated = updater(current);
  await writeSessions(sessions.map((session) => (session.id === sessionId ? updated : session)));
  return updated;
}

export async function setUiRecorderGenerationOptions(
  sessionId: string,
  options: UiRecorderGenerationOptions
): Promise<UiRecorderSession | null> {
  return updateUiRecorderSession(sessionId, (current) => ({
    ...current,
    lastGenerationOptions: {
      ...options,
      generatedAt: new Date().toISOString(),
    },
  }));
}

export async function deleteUiRecorderSession(sessionId: string): Promise<{ removed: boolean }> {
  const stored = await chrome.storage.local.get(UI_RECORDER_SESSIONS_KEY);
  const sessions = parseStoredSessions(stored[UI_RECORDER_SESSIONS_KEY]);
  const filtered = sessions.filter((session) => session.id !== sessionId);
  if (filtered.length === sessions.length) {
    return { removed: false };
  }
  await writeSessions(filtered);
  return { removed: true };
}

export async function clearAllUiRecorderSessions(): Promise<void> {
  await chrome.storage.local.remove(UI_RECORDER_SESSIONS_KEY);
}
