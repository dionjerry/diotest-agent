import type { ProviderContentPart, ProviderRequest, ProviderResponse } from "@diotest/domain/contracts/services";

function parseJsonContent(content: unknown): unknown {
  if (typeof content !== "string") return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function generateStructuredWithOpenRouter(request: ProviderRequest): Promise<ProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 45000);

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          {
            role: "user",
            content: request.userContent?.length
              ? request.userContent.map((part: ProviderContentPart) => (
                part.type === "text"
                  ? { type: "text", text: part.text }
                  : { type: "image_url", image_url: { url: part.dataUrl, detail: part.detail ?? "low" } }
              ))
              : request.userPrompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "diotest_ai_analysis",
            strict: true,
            schema: request.schema,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `OpenRouter API error ${resp.status}: ${text}` };
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    const parsed = parseJsonContent(content);
    if (!parsed) {
      return { ok: false, error: "Model returned non-JSON content." };
    }

    return { ok: true, data: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "OpenRouter request failed." };
  } finally {
    clearTimeout(timeout);
  }
}
