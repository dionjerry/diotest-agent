import type { PrExtractResult } from "../engine/pr/types";

export type PrContractMessage =
  | { type: "pr.extract" }
  | { type: "pr.extract.result"; payload: PrExtractResult };
