import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";
import { toSafeSettingsProfile } from "@diotest/renderers/exports/metadata";

describe("export metadata safety", () => {
  it("contains only non-sensitive settings", () => {
    const profile = toSafeSettingsProfile(DEFAULT_SETTINGS);
    const serialized = JSON.stringify(profile).toLowerCase();

    expect(serialized.includes("apikey")).toBe(false);
    expect(serialized.includes("token")).toBe(false);
    expect(serialized.includes("userid")).toBe(false);
    expect(serialized.includes("domainhistory")).toBe(false);
  });
});
