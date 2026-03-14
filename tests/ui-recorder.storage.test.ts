import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendUiRecorderEvent,
  clearAllUiRecorderSessions,
  createUiRecorderSession,
  deleteUiRecorderSession,
  finalizeUiRecorderSession,
  getUiRecorderSession,
  listUiRecorderSessions,
  updateUiRecorderSession,
} from "../extension/engine/recorder/storage";
import { UI_RECORDER_SESSIONS_KEY, type RawRecorderEvent, type RecorderActiveState } from "../extension/engine/recorder/types";

function activeState(overrides: Partial<RecorderActiveState> = {}): RecorderActiveState {
  return {
    active: true,
    startedAt: "2026-03-14T10:00:00.000Z",
    sessionId: "session-1",
    tabId: 7,
    domain: "example.com",
    eventThrottlePerSecond: 2,
    screenshotDelayMs: 0,
    recordScreenshots: true,
    maxScreenshotsPerSession: 4,
    maxSessionStorageMB: 0.001,
    ...overrides,
  };
}

function event(overrides: Partial<RawRecorderEvent> = {}): RawRecorderEvent {
  return {
    sessionId: "session-1",
    timestamp: "2026-03-14T10:00:00.000Z",
    action: "click",
    url: "https://example.com/page",
    title: "Open dialog",
    selector: "button[data-testid=open]",
    ...overrides,
  };
}

describe("ui recorder session storage", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];

    Object.assign(globalThis, {
      chrome: {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: store[key] })),
            set: vi.fn(async (value: Record<string, unknown>) => Object.assign(store, value)),
            remove: vi.fn(async (key: string) => {
              delete store[key];
            }),
          },
        },
      },
    });

    vi.restoreAllMocks();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222")
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333");
  });

  it("creates, updates, finalizes, lists, and deletes recorder sessions", async () => {
    await createUiRecorderSession(activeState(), "Checkout flow", "https://example.com/page");

    await appendUiRecorderEvent(activeState(), event(), {
      id: "shot-1",
      capturedAt: "2026-03-14T10:00:01.000Z",
      dataUrl: `data:image/jpeg;base64,${"a".repeat(20_000)}`,
    }, {
      url: "https://example.com/page",
      title: "Example page",
      summary: "Headings: Welcome | Fields: Email address | Actions: Continue",
      headings: ["Welcome"],
      actions: ["Continue"],
      fields: ["Email address"],
      sections: ["Hero"],
    });

    const reviewed = await updateUiRecorderSession("session-1", (session) => ({
      ...session,
      steps: session.steps.map((step) => ({ ...step, kept: false })),
      warnings: [...session.warnings, "reviewed"],
    }));

    expect(reviewed?.steps[0]?.kept).toBe(false);

    const finalized = await finalizeUiRecorderSession("session-1");
    expect(finalized?.status).toBe("review");

    const fetched = await getUiRecorderSession("session-1");
    expect(fetched?.screenshotsCaptured).toBe(0);
    expect(fetched?.storageTrimmed).toBe(true);
    expect(fetched?.pageSummaries?.[0]?.title).toBe("Example page");

    const groups = await listUiRecorderSessions();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.domain).toBe("example.com");
    expect(groups[0]?.sessionCount).toBe(1);

    const removed = await deleteUiRecorderSession("session-1");
    expect(removed.removed).toBe(true);

    await clearAllUiRecorderSessions();
    expect(store[UI_RECORDER_SESSIONS_KEY]).toBeUndefined();
  });

  it("keeps newest sessions first in grouped listing", async () => {
    await createUiRecorderSession(activeState({ sessionId: "session-1", startedAt: "2026-03-14T09:00:00.000Z" }), "Morning flow", "https://example.com");
    await createUiRecorderSession(activeState({ sessionId: "session-2", startedAt: "2026-03-14T11:00:00.000Z", domain: "app.example.com" }), "Latest flow", "https://app.example.com");

    const groups = await listUiRecorderSessions();

    expect(groups[0]?.domain).toBe("app.example.com");
    expect(groups[1]?.domain).toBe("example.com");
  });
});
