import type { ProviderRequest, ProviderResponse } from "@diotest/domain/contracts/services";
import { generateStructured as generateStructuredWithOpenAi } from "./openai";
import { generateStructuredWithOpenRouter } from "./openrouter";

export async function generateStructured(request: ProviderRequest): Promise<ProviderResponse> {
  if (request.provider === "openrouter") {
    return generateStructuredWithOpenRouter(request);
  }

  return generateStructuredWithOpenAi(request);
}
