import { ERROR_CODES } from "../errors/codes";

const RECORDER_STATE_KEY = "diotest.recorder.state";

export interface RecorderState {
  active: boolean;
  startedAt: string;
  sessionId: string;
  tabId: number;
  domain: string;
}

export async function persistRecorderState(state: RecorderState): Promise<void> {
  await chrome.storage.local.set({ [RECORDER_STATE_KEY]: state });
}

export async function restoreRecorderState(): Promise<{ state: RecorderState | null; errorCode?: string }> {
  try {
    const stored = await chrome.storage.local.get(RECORDER_STATE_KEY);
    const state = stored[RECORDER_STATE_KEY] as RecorderState | undefined;
    return { state: state ?? null };
  } catch {
    return { state: null, errorCode: ERROR_CODES.WORKER_STATE_RESTORE_FAILED };
  }
}

export async function clearRecorderState(): Promise<void> {
  await chrome.storage.local.remove(RECORDER_STATE_KEY);
}
