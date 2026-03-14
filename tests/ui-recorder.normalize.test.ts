import { describe, expect, it, vi } from "vitest";
import { mergeRecorderEvent, normalizeRecorderEvent } from "../extension/engine/recorder/normalize";
import type { RawRecorderEvent } from "../extension/engine/recorder/types";

function event(overrides: Partial<RawRecorderEvent> = {}): RawRecorderEvent {
  return {
    sessionId: "session-1",
    timestamp: "2026-03-14T10:00:00.000Z",
    action: "click",
    url: "https://example.com",
    title: "Submit button",
    selector: "button[type=submit]",
    ...overrides,
  };
}

describe("ui recorder normalization", () => {
  it("builds concrete step titles", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

    const step = normalizeRecorderEvent(
      event({
        action: "input",
        title: "Email address",
        selector: "input[name=email]",
        value: " person@example.com ",
      })
    );

    expect(step.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(step.title).toBe('Enter "person@example.com" in Email address');
    expect(step.value).toBe("person@example.com");
  });

  it("merges repeated input events on the same logical target within throttle window", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const first = normalizeRecorderEvent(
      event({
        action: "input",
        title: "Search",
        selector: "input[name=query]",
        value: "di",
        timestamp: "2026-03-14T10:00:00.000Z",
      })
    );

    const merged = mergeRecorderEvent(
      [first],
      event({
        action: "input",
        title: "Search",
        selector: "input[name=query]",
        value: "diotest",
        timestamp: "2026-03-14T10:00:00.300Z",
      }),
      500
    );

    expect(merged.merged).toBe(true);
    expect(merged.steps).toHaveLength(1);
    expect(merged.steps[0]?.value).toBe("diotest");
  });

  it("keeps distinct actions when target or timing differs", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const first = normalizeRecorderEvent(
      event({
        action: "scroll",
        title: "page",
        selector: "html",
        value: "0,300",
        timestamp: "2026-03-14T10:00:00.000Z",
      })
    );

    const result = mergeRecorderEvent(
      [first],
      event({
        action: "scroll",
        title: "page",
        selector: "html",
        value: "0,2500",
        timestamp: "2026-03-14T10:00:01.000Z",
      }),
      500
    );

    expect(result.merged).toBe(false);
    expect(result.steps).toHaveLength(2);
  });

  it("replaces noisy scroll labels with a readable page title", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("33333333-3333-4333-8333-333333333333");

    const step = normalizeRecorderEvent(
      event({
        action: "scroll",
        title: "window.PCM = { config: { domainUUID: '123' } }",
        selector: "html",
        value: "0,320",
      })
    );

    expect(step.title).toBe("Scroll page");
  });

  it("drops focus noise when a click on the same target immediately follows", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444")
      .mockReturnValueOnce("55555555-5555-4555-8555-555555555555");

    const first = normalizeRecorderEvent(
      event({
        action: "focus",
        title: "Search",
        selector: "#search",
        timestamp: "2026-03-14T10:00:00.000Z",
      })
    );

    const merged = mergeRecorderEvent(
      [first],
      event({
        action: "click",
        title: "Search",
        selector: "#search",
        timestamp: "2026-03-14T10:00:00.400Z",
      }),
      500
    );

    expect(merged.merged).toBe(true);
    expect(merged.steps).toHaveLength(1);
    expect(merged.steps[0]?.action).toBe("click");
  });

  it("collapses dense consecutive scroll events on the same page", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("66666666-6666-4666-8666-666666666666")
      .mockReturnValueOnce("77777777-7777-4777-8777-777777777777");

    const first = normalizeRecorderEvent(
      event({
        action: "scroll",
        title: "page",
        selector: "html",
        value: "0,300",
        timestamp: "2026-03-14T10:00:00.000Z",
      })
    );

    const merged = mergeRecorderEvent(
      [first],
      event({
        action: "scroll",
        title: "page",
        selector: "html",
        value: "0,1200",
        timestamp: "2026-03-14T10:00:00.900Z",
      }),
      500
    );

    expect(merged.merged).toBe(true);
    expect(merged.steps).toHaveLength(1);
    expect(merged.steps[0]?.value).toBe("0,1200");
  });
});
