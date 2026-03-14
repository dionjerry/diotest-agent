import type { UiRecorderSession, UiRecorderSessionGroup } from "../../engine/recorder/types";

export type RecorderViewMode = "domains" | "sessions" | "detail";

export interface RecorderNavState {
  mode: RecorderViewMode;
  selectedDomain: string | null;
  selectedSessionId: string | null;
}

export type RecorderNavAction =
  | { type: "open_domain"; domain: string }
  | { type: "open_session"; sessionId: string }
  | { type: "back" }
  | { type: "reset" };

export function recorderNavReducer(state: RecorderNavState, action: RecorderNavAction): RecorderNavState {
  switch (action.type) {
    case "open_domain":
      return { mode: "sessions", selectedDomain: action.domain, selectedSessionId: null };
    case "open_session":
      return { ...state, mode: "detail", selectedSessionId: action.sessionId };
    case "back":
      if (state.mode === "detail") return { ...state, mode: "sessions", selectedSessionId: null };
      if (state.mode === "sessions") return { mode: "domains", selectedDomain: null, selectedSessionId: null };
      return state;
    case "reset":
      return { mode: "domains", selectedDomain: null, selectedSessionId: null };
    default:
      return state;
  }
}

export function sessionsForDomain(groups: UiRecorderSessionGroup[], domain: string | null): UiRecorderSession[] {
  if (!domain) return [];
  return groups.find((group) => group.domain === domain)?.sessions ?? [];
}

