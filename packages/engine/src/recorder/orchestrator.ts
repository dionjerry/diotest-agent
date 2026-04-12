import { generateStructured } from "@diotest/providers/index";
import { assertSettingsForExecution } from "../runtime/gating";
import type { SettingsLatest } from "@diotest/domain/settings/types";
import { ERROR_CODES } from "@diotest/domain/errors/codes";
import type {
  UiRecorderGenerationOptions,
  UiRecorderGenerationResult,
  UiRecorderPageSummary,
  UiRecorderSession,
  UiRecorderStep,
} from "@diotest/domain/recorder/types";
import { isValidUiRecorderGenerationResult, UI_RECORDER_GENERATION_SCHEMA } from "@diotest/domain/recorder/schema";

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 160): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

function summarizeStep(step: UiRecorderStep, index: number): string {
  const parts = [`${index + 1}. ${step.action.toUpperCase()} ${truncate(compactWhitespace(step.title), 140)}`];
  if (step.selector) parts.push(`selector=${truncate(step.selector, 90)}`);
  if (step.value) parts.push(`value=${truncate(step.value, 90)}`);
  if (step.key) parts.push(`key=${step.key}`);
  parts.push(`url=${truncate(step.url, 180)}`);
  if (step.screenshot) parts.push("screenshot=yes");
  return parts.join(" | ");
}

function buildPageTransitions(steps: UiRecorderStep[]): string[] {
  const transitions: string[] = [];
  let lastUrl = steps[0]?.url;
  for (const step of steps) {
    if (!lastUrl) {
      lastUrl = step.url;
      continue;
    }
    if (step.url !== lastUrl) {
      transitions.push(`${truncate(lastUrl, 120)} -> ${truncate(step.url, 120)}`);
      lastUrl = step.url;
    }
  }
  return [...new Set(transitions)].slice(0, 8);
}

function buildFallbackPageSummaries(steps: UiRecorderStep[]): string[] {
  const byUrl = new Map<string, string[]>();
  for (const step of steps) {
    const list = byUrl.get(step.url) ?? [];
    if (["click", "input", "change", "select", "submit", "navigation"].includes(step.action)) {
      list.push(truncate(step.title, 90));
      byUrl.set(step.url, list);
    } else if (step.screenshot && list.length === 0) {
      list.push(truncate(step.title, 90));
      byUrl.set(step.url, list);
    }
  }

  return Array.from(byUrl.entries()).slice(0, 8).map(([url, titles], index) => {
    const highlights = [...new Set(titles)].slice(0, 4).join("; ");
    return `${index + 1}. ${truncate(url, 120)} | highlights=${highlights || "page transition recorded"}`;
  });
}

function buildStoredPageSummaries(pageSummaries: UiRecorderPageSummary[] | undefined): string[] {
  return (pageSummaries ?? []).slice(-8).map((item, index) => {
    const headings = item.headings.slice(0, 4).join("; ") || "none";
    const actions = item.actions.slice(0, 4).join("; ") || "none";
    const fields = item.fields.slice(0, 4).join("; ") || "none";
    const sections = item.sections.slice(0, 4).join("; ") || "none";
    return `${index + 1}. ${truncate(item.url, 120)} | title=${truncate(item.title, 80)} | summary=${truncate(item.summary, 220)} | headings=${headings} | actions=${actions} | fields=${fields} | sections=${sections}`;
  });
}

function buildOpportunityHints(pageSummaries: UiRecorderPageSummary[] | undefined): string[] {
  return (pageSummaries ?? []).slice(-8).flatMap((item, index) => {
    const hints: string[] = [];
    if (item.actions.length > 0) hints.push(`${index + 1}. ${truncate(item.url, 120)} | navigation/cta opportunities: ${item.actions.slice(0, 6).join("; ")}`);
    if (item.fields.length > 0) hints.push(`${index + 1}. ${truncate(item.url, 120)} | form/validation opportunities: ${item.fields.slice(0, 6).join("; ")}`);
    if (item.sections.length > 0) hints.push(`${index + 1}. ${truncate(item.url, 120)} | section opportunities: ${item.sections.slice(0, 6).join("; ")}`);
    return hints;
  }).slice(0, 12);
}

function selectVisionSteps(steps: UiRecorderStep[]): UiRecorderStep[] {
  const priority = ["navigation", "submit", "select", "change", "click"];
  const scored = steps
    .filter((step) => step.screenshot?.dataUrl)
    .map((step, index) => ({
      step,
      score: Math.max(0, priority.length - priority.indexOf(step.action)) + (step.selector ? 1 : 0),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const unique = new Map<string, UiRecorderStep>();
  for (const item of scored) {
    const key = `${item.step.url}::${item.step.action}`;
    if (!unique.has(key)) unique.set(key, item.step);
    if (unique.size >= 6) break;
  }

  return Array.from(unique.values());
}

function buildVisionContent(session: UiRecorderSession, options: UiRecorderGenerationOptions): { userPrompt: string; userContent?: Array<{ type: "text"; text: string } | { type: "image"; dataUrl: string; detail?: "low" }> } {
  const keptSteps = session.steps.filter((step) => step.kept);
  const lines = keptSteps.map((step, index) => summarizeStep(step, index));
  const transitions = buildPageTransitions(keptSteps);
  const pageSummaries = options.includePageSummaries
    ? (buildStoredPageSummaries(session.pageSummaries).length > 0 ? buildStoredPageSummaries(session.pageSummaries) : buildFallbackPageSummaries(keptSteps))
    : [];
  const opportunityHints = options.includePageSummaries ? buildOpportunityHints(session.pageSummaries) : [];
  const promptText = [
    `SESSION_NAME: ${session.name}`,
    `DOMAIN: ${session.domain}`,
    `START_URL: ${session.startUrl}`,
    `LAST_URL: ${session.lastUrl}`,
    `TOTAL_KEPT_STEPS: ${keptSteps.length}`,
    `SCREENSHOT_BACKED_STEPS: ${keptSteps.filter((step) => step.screenshot).length}`,
    `VISION_ENABLED: ${String(options.includeVision)}`,
    `PAGE_SUMMARIES_ENABLED: ${String(options.includePageSummaries)}`,
    "PAGE_TRANSITIONS:",
    ...(transitions.length > 0 ? transitions : ["none"]),
    "PAGE_SUMMARIES:",
    ...(options.includePageSummaries ? (pageSummaries.length > 0 ? pageSummaries : ["none"]) : ["disabled"]),
    "PAGE_OPPORTUNITY_HINTS:",
    ...(options.includePageSummaries ? (opportunityHints.length > 0 ? opportunityHints : ["none"]) : ["disabled"]),
    "REVIEWED_STEPS:",
    ...lines,
    "",
    "Generate 3-6 manual test cases and one Playwright scenario spec.",
    "Use evidence_files to reference reviewed step titles or selectors, not source files.",
    "Keep outputs specific to the user flow, page states, and expected outcomes.",
    "Manual cases must combine flow-derived cases from reviewed kept steps and page-derived opportunity cases from visited pages.",
    "Include at least one source='flow' manual case and at least one source='page' manual case when the visited pages expose distinct visible opportunities.",
    "Page-derived cases may cover high-confidence visible CTAs, forms, FAQs, modal interactions, plan cards, navigation paths, validation points, and checkout entry points even if not every one was individually clicked.",
    "Manual cases should cover the broader journey when the reviewed flow spans multiple pages or product areas.",
    "Playwright steps should prioritize meaningful actions and assertions over low-signal intermediary events.",
    "Keep the Playwright scenario focused on the main recorded happy path, not every page-derived opportunity.",
  ].join("\n");

  if (!options.includeVision) {
    return { userPrompt: promptText };
  }

  const visionSteps = selectVisionSteps(keptSteps);
  if (visionSteps.length === 0) {
    return { userPrompt: promptText };
  }

  const userContent: Array<{ type: "text"; text: string } | { type: "image"; dataUrl: string; detail?: "low" }> = [
    { type: "text", text: promptText },
    { type: "text", text: "VISION_CONTEXT: Use these screenshots to understand visible page structure, visible forms, buttons, headings, and state transitions. Treat screenshots as supporting evidence, not replacements for the reviewed kept steps." },
  ];

  for (const [index, step] of visionSteps.entries()) {
    userContent.push({
      type: "text",
      text: `SCREENSHOT_${index + 1}: ${truncate(step.title, 120)} | action=${step.action} | url=${truncate(step.url, 120)} | selector=${step.selector ?? "none"}`,
    });
    userContent.push({
      type: "image",
      dataUrl: step.screenshot!.dataUrl,
      detail: "low",
    });
  }

  return { userPrompt: promptText, userContent };
}

function buildSystemPrompt(options: UiRecorderGenerationOptions): string {
  return [
    "You generate testing artifacts from reviewed browser interaction recordings.",
    "Return only JSON matching the requested schema.",
    "Write concise, concrete manual cases and a Playwright scenario spec.",
    "Only use the reviewed kept steps as primary evidence.",
    options.includePageSummaries
      ? "Use provided page summaries to understand each page's visible structure, CTAs, forms, FAQs, plan options, modal interactions, and page purpose."
      : "Do not invent page summaries beyond the reviewed steps and transitions.",
    options.includeVision
      ? "Use screenshots to infer visible UI state, headings, forms, buttons, and confirmation cues."
      : "Do not rely on screenshots; use text evidence only.",
    "Do not overfit to raw click-by-click output when the flow implies broader user intent.",
    "Manual cases should not collapse all visited-page opportunities into a single generic case when the page clearly exposes multiple distinct behaviors.",
  ].join("\n");
}

export async function generateUiRecorderArtifacts(
  rawSettings: unknown,
  session: UiRecorderSession,
  options: UiRecorderGenerationOptions
): Promise<{ ok: true; result: UiRecorderGenerationResult } | { ok: false; error: string; code?: string }> {
  const gate = assertSettingsForExecution(rawSettings);
  if (!gate.ok || !gate.settings) {
    return { ok: false, error: "Settings are invalid.", code: ERROR_CODES.SETTINGS_VALIDATION_FAILED };
  }

  const settings = gate.settings as SettingsLatest;
  if (settings.safeMode.enabled) {
    return { ok: false, error: "Safe mode blocks UI recorder generation.", code: ERROR_CODES.SETTINGS_VALIDATION_FAILED };
  }
  const providerApiKey = settings.analysis.provider === "openrouter"
    ? settings.auth.openrouterApiKey.trim()
    : settings.auth.openaiApiKey.trim();
  const providerName = settings.analysis.provider === "openrouter" ? "OpenRouter" : "OpenAI";

  if (!providerApiKey) {
    return { ok: false, error: `${providerName} API key is missing. Add it in Settings.` };
  }

  const keptCount = session.steps.filter((step) => step.kept).length;
  if (keptCount === 0) {
    return { ok: false, error: "Keep at least one recorded step before generating outputs." };
  }

  const request = buildVisionContent(session, options);
  const performGeneration = async (includeVision: boolean) => generateStructured({
    provider: settings.analysis.provider,
    apiKey: providerApiKey,
    model: settings.analysis.model,
    systemPrompt: buildSystemPrompt({ ...options, includeVision }),
    userPrompt: request.userPrompt,
    userContent: includeVision ? request.userContent : undefined,
    schema: UI_RECORDER_GENERATION_SCHEMA,
  });

  const first = await performGeneration(options.includeVision);
  const fallback = options.includeVision && !first.ok ? await performGeneration(false) : first;

  if (!fallback.ok) {
    return { ok: false, error: fallback.error ?? "Model request failed.", code: ERROR_CODES.MODEL_TIMEOUT };
  }
  if (!isValidUiRecorderGenerationResult(fallback.data)) {
    return { ok: false, error: "Model output failed schema validation.", code: ERROR_CODES.INVALID_MODEL_OUTPUT };
  }

  return { ok: true, result: fallback.data };
}
