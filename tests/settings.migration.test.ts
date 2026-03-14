import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@diotest/domain/settings/defaults";
import { migrateSettings } from "@diotest/domain/settings/migration";

describe("settings migration", () => {
  it("fills defaults and preserves existing values", () => {
    const migrated = migrateSettings({
      pr: {
        maxFiles: 90
      },
      safeMode: {
        enabled: true
      }
    });

    expect(migrated.pr.maxFiles).toBe(90);
    expect(migrated.pr.maxDiffLines).toBe(DEFAULT_SETTINGS.pr.maxDiffLines);
    expect(migrated.safeMode.enabled).toBe(true);
    expect(migrated.version).toBe(1);
  });
});
