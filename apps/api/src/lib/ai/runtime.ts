import type { AiProviderConfig } from '@diotest/domain/platform/types';
import type { SettingsLatest } from '@diotest/domain/settings/types';
import { DEFAULT_SETTINGS } from '@diotest/domain/settings/defaults';
import type { ProviderContentPart, ProviderRequest, ProviderResponse } from '@diotest/domain/contracts/services';
import { generateStructured } from '@diotest/providers';

import { decryptPayload } from '../secrets.js';
import { getSecret } from '../settings-store.js';

export type AiRuntimeFeature = 'analysis' | 'recorder' | 'agents';

export type ResolvedAiRuntimeConfig = {
  scope: 'project' | 'organization' | 'system';
  organizationId?: string;
  projectId?: string;
  provider: 'openai' | 'openrouter';
  model: string;
  apiKey: string;
  rawConfig: AiProviderConfig;
};

export type RuntimeGenerateRequest = {
  organizationId?: string;
  projectId?: string;
  feature: AiRuntimeFeature;
  systemPrompt: string;
  userPrompt: string;
  schema: unknown;
  timeoutMs?: number;
  userContent?: ProviderContentPart[];
};

type RuntimeDraftConfig = Partial<Pick<AiProviderConfig, 'preferredProvider' | 'model' | 'openaiApiKey' | 'openrouterApiKey'>>;

function toLegacySettings(config: ResolvedAiRuntimeConfig): SettingsLatest {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    analysis: {
      ...DEFAULT_SETTINGS.analysis,
      provider: config.provider,
      model: config.model,
    },
    auth: {
      ...DEFAULT_SETTINGS.auth,
      openaiApiKey: config.rawConfig.openaiApiKey ?? '',
      openrouterApiKey: config.rawConfig.openrouterApiKey ?? '',
    },
  };
}

export async function resolveAiRuntimeConfig(params: {
  organizationId?: string;
  projectId?: string;
}): Promise<ResolvedAiRuntimeConfig> {
  const candidates: Array<{ scope: 'project' | 'organization' | 'system'; secretScope: 'PROJECT' | 'ORGANIZATION' | 'SYSTEM'; key: string; organizationId?: string; projectId?: string }> = [];
  const issues: string[] = [];

  if (params.projectId) {
    candidates.push({
      scope: 'project',
      secretScope: 'PROJECT',
      key: 'ai.project',
      organizationId: params.organizationId,
      projectId: params.projectId,
    });
  }

  if (params.organizationId) {
    candidates.push({
      scope: 'organization',
      secretScope: 'ORGANIZATION',
      key: 'ai.org',
      organizationId: params.organizationId,
    });
  }

  candidates.push({
    scope: 'system',
    secretScope: 'SYSTEM',
    key: 'ai.org',
  });

  for (const candidate of candidates) {
    const secret = await getSecret(candidate.secretScope, candidate.key, candidate.organizationId, candidate.projectId);
    if (!secret) continue;

    const config = decryptPayload<AiProviderConfig>(secret);
    const apiKey = config.preferredProvider === 'openrouter'
      ? config.openrouterApiKey?.trim() ?? ''
      : config.openaiApiKey?.trim() ?? '';

    if (!config.model?.trim()) {
      issues.push(`AI runtime config for ${candidate.scope} scope is missing a model.`);
      continue;
    }

    if (!apiKey) {
      issues.push(`AI runtime config for ${candidate.scope} scope is missing an API key for ${config.preferredProvider}.`);
      continue;
    }

    return {
      scope: candidate.scope,
      organizationId: candidate.organizationId,
      projectId: candidate.projectId,
      provider: config.preferredProvider,
      model: config.model.trim(),
      apiKey,
      rawConfig: config,
    };
  }

  if (issues.length > 0) {
    throw new Error(issues[0]);
  }

  throw new Error('No AI runtime configuration is available for this scope.');
}

function validateDraftRuntimeConfig(
  config: Partial<AiProviderConfig>,
  scope: 'project' | 'organization' | 'system',
  organizationId?: string,
  projectId?: string,
): ResolvedAiRuntimeConfig {
  const preferredProvider = config.preferredProvider;
  if (preferredProvider !== 'openai' && preferredProvider !== 'openrouter') {
    throw new Error(`AI runtime config for ${scope} scope is missing a valid provider.`);
  }

  const model = config.model?.trim() ?? '';
  if (!model) {
    throw new Error(`AI runtime config for ${scope} scope is missing a model.`);
  }

  const apiKey = preferredProvider === 'openrouter'
    ? config.openrouterApiKey?.trim() ?? ''
    : config.openaiApiKey?.trim() ?? '';

  if (!apiKey) {
    throw new Error(`AI runtime config for ${scope} scope is missing an API key for ${preferredProvider}.`);
  }

  return {
    scope,
    organizationId,
    projectId,
    provider: preferredProvider,
    model,
    apiKey,
    rawConfig: {
      preferredProvider,
      model,
      openaiApiKey: config.openaiApiKey?.trim() ?? '',
      openrouterApiKey: config.openrouterApiKey?.trim() ?? '',
    },
  };
}

export async function resolveAiRuntimeConfigForValidation(params: {
  organizationId?: string;
  projectId?: string;
  draft?: RuntimeDraftConfig;
}): Promise<ResolvedAiRuntimeConfig> {
  const draft = params.draft;
  const hasDraftOverride = Boolean(
    draft
    && (draft.preferredProvider !== undefined
      || draft.model !== undefined
      || draft.openaiApiKey !== undefined
      || draft.openrouterApiKey !== undefined),
  );

  if (!hasDraftOverride) {
    return resolveAiRuntimeConfig({
      organizationId: params.organizationId,
      projectId: params.projectId,
    });
  }

  const scope = params.projectId ? 'project' : params.organizationId ? 'organization' : 'system';
  const secretScope = params.projectId ? 'PROJECT' : params.organizationId ? 'ORGANIZATION' : 'SYSTEM';
  const key = scope === 'system' ? 'ai.org' : scope === 'project' ? 'ai.project' : 'ai.org';
  const existing = await getSecret(secretScope, key, params.organizationId, params.projectId);
  const existingConfig = existing ? decryptPayload<AiProviderConfig>(existing) : undefined;

  return validateDraftRuntimeConfig(
    {
      ...existingConfig,
      ...draft,
    },
    scope,
    params.organizationId,
    params.projectId,
  );
}

export async function getLegacyRuntimeSettings(params: {
  organizationId?: string;
  projectId?: string;
}): Promise<SettingsLatest> {
  const config = await resolveAiRuntimeConfig(params);
  return toLegacySettings(config);
}

export async function generateStructuredWithRuntime(request: RuntimeGenerateRequest): Promise<ProviderResponse> {
  const config = await resolveAiRuntimeConfig({
    organizationId: request.organizationId,
    projectId: request.projectId,
  });

  const providerRequest: ProviderRequest = {
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    schema: request.schema,
    timeoutMs: request.timeoutMs,
    userContent: request.userContent,
  };

  return generateStructured(providerRequest);
}
