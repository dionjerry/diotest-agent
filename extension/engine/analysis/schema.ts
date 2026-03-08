import type { AiAnalysisResultV1 } from "./types";

export const AI_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["risk_score", "risk_areas", "test_plan", "manual_test_cases"],
  properties: {
    risk_score: { type: "number", minimum: 0, maximum: 10 },
    risk_areas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "severity", "evidence_files", "why"],
        properties: {
          area: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          evidence_files: { type: "array", items: { type: "string" } },
          why: { type: "string" }
        }
      }
    },
    test_plan: {
      type: "object",
      additionalProperties: false,
      required: ["unit", "integration", "e2e"],
      properties: {
        unit: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "evidence_files", "notes"],
            properties: {
              title: { type: "string" },
              evidence_files: { type: "array", items: { type: "string" } },
              notes: { type: ["string", "null"] }
            }
          }
        },
        integration: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "evidence_files", "notes"],
            properties: {
              title: { type: "string" },
              evidence_files: { type: "array", items: { type: "string" } },
              notes: { type: ["string", "null"] }
            }
          }
        },
        e2e: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "evidence_files", "notes"],
            properties: {
              title: { type: "string" },
              evidence_files: { type: "array", items: { type: "string" } },
              notes: { type: ["string", "null"] }
            }
          }
        }
      }
    },
    manual_test_cases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "preconditions", "steps", "expected"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          preconditions: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
          expected: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
} as const;

export function isValidAiAnalysisResult(payload: unknown): payload is Omit<AiAnalysisResultV1, "meta"> {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.risk_score !== "number" || p.risk_score < 0 || p.risk_score > 10) return false;
  if (!Array.isArray(p.risk_areas) || !Array.isArray(p.manual_test_cases)) return false;
  if (!p.test_plan || typeof p.test_plan !== "object") return false;

  const testPlan = p.test_plan as Record<string, unknown>;
  if (!Array.isArray(testPlan.unit) || !Array.isArray(testPlan.integration) || !Array.isArray(testPlan.e2e)) {
    return false;
  }

  return true;
}
