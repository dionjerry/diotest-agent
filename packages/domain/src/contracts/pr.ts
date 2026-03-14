import type { PrExtractResult } from "@diotest/domain/pr/types";

export type PrContractMessage =
  | { type: "pr.extract" }
  | { type: "pr.extract.result"; payload: PrExtractResult };
