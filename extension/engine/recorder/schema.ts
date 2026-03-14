import type { UiRecorderGenerationResult } from "./types";

export const UI_RECORDER_GENERATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["manual_test_cases", "playwright_scenario"],
  properties: {
    manual_test_cases: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "why", "evidence_files", "preconditions", "steps", "expected", "source"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          why: { type: "string" },
          evidence_files: { type: "array", items: { type: "string" } },
          preconditions: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
          expected: { type: "array", items: { type: "string" } },
          source: { type: ["string", "null"], enum: ["flow", "page", null] },
        },
      },
    },
    playwright_scenario: {
      type: "object",
      additionalProperties: false,
      required: ["title", "goal", "steps", "notes"],
      properties: {
        title: { type: "string" },
        goal: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
        steps: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "target", "assertion"],
            properties: {
              action: { type: "string" },
              target: { type: ["string", "null"] },
              assertion: { type: ["string", "null"] },
            },
          },
        },
      },
    },
  },
} as const;

export function isValidUiRecorderGenerationResult(value: unknown): value is UiRecorderGenerationResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as UiRecorderGenerationResult;
  return Array.isArray(candidate.manual_test_cases) && !!candidate.playwright_scenario && Array.isArray(candidate.playwright_scenario.steps);
}
