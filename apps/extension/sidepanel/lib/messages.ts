import type { BackgroundMessage } from "@diotest/domain/contracts/messages";

export async function sendMessage<T>(msg: BackgroundMessage): Promise<T> {
  try {
    return await chrome.runtime.sendMessage(msg) as T;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Message dispatch failed."
    } as T;
  }
}
