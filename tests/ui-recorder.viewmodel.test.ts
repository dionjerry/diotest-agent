import { describe, expect, it } from "vitest";
import { recorderNavReducer, sessionsForDomain, type RecorderNavState } from "../apps/extension/sidepanel/lib/recorderView";
import type { UiRecorderSessionGroup } from "@diotest/domain/recorder/types";

function group(domain: string, sessionIds: string[]): UiRecorderSessionGroup {
  return {
    domain,
    sessionCount: sessionIds.length,
    lastUpdatedAt: "2026-03-14T10:00:00.000Z",
    sessions: sessionIds.map((id, index) => ({
      id,
      name: `Session ${index + 1}`,
      domain,
      startUrl: `https://${domain}/start`,
      lastUrl: `https://${domain}/end`,
      startedAt: `2026-03-14T10:0${index}:00.000Z`,
      stoppedAt: `2026-03-14T10:1${index}:00.000Z`,
      status: "review" as const,
      steps: [],
      warnings: [],
      screenshotsCaptured: 0,
      storageTrimmed: false,
    })),
  };
}

describe("ui recorder view model", () => {
  it("returns sessions for the selected domain", () => {
    const result = sessionsForDomain([group("example.com", ["a", "b"]), group("app.example.com", ["c"])], "example.com");
    expect(result.map((session) => session.id)).toEqual(["a", "b"]);
  });

  it("navigates domains -> sessions -> detail and back safely", () => {
    let state: RecorderNavState = { mode: "domains", selectedDomain: null, selectedSessionId: null };

    state = recorderNavReducer(state, { type: "open_domain", domain: "example.com" });
    expect(state.mode).toBe("sessions");
    expect(state.selectedDomain).toBe("example.com");

    state = recorderNavReducer(state, { type: "open_session", sessionId: "session-1" });
    expect(state.mode).toBe("detail");
    expect(state.selectedSessionId).toBe("session-1");

    state = recorderNavReducer(state, { type: "back" });
    expect(state.mode).toBe("sessions");
    expect(state.selectedSessionId).toBeNull();

    state = recorderNavReducer(state, { type: "back" });
    expect(state.mode).toBe("domains");
    expect(state.selectedDomain).toBeNull();
  });
});
