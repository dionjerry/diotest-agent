import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type {
  AiProviderConfig,
  GoogleSheetsIntegrationConfig,
  GoogleSheetsIntegrationSecret,
  IntegrationHealthState,
  IntegrationType,
  JiraIntegrationConfig,
  JiraIntegrationSecret,
  OAuthProviderConfig,
  TrelloIntegrationConfig,
  TrelloIntegrationSecret,
} from '@diotest/domain/platform/types';

import { env } from '../env.js';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(env.SETTINGS_ENCRYPTION_KEY).digest();
}

export function encryptPayload(value: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    algorithm: ALGORITHM,
  };
}

export function decryptPayload<T>(record: { cipherText: string; iv: string; tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.cipherText, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function maskSecret(value?: string) {
  if (!value) return null;
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function toOAuthSettingsView(config?: OAuthProviderConfig | null) {
  if (!config) {
    return {
      enabled: false,
      provider: 'google' as const,
      clientId: '',
      clientSecretPreview: null,
      authUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      hasStoredSecret: false,
    };
  }

  return {
    enabled: config.enabled,
    provider: config.provider,
    clientId: config.clientId,
    clientSecretPreview: maskSecret(config.clientSecret),
    authUrl: config.authUrl ?? '',
    tokenUrl: config.tokenUrl ?? '',
    userInfoUrl: config.userInfoUrl ?? '',
    hasStoredSecret: Boolean(config.clientSecret),
  };
}

export function toAiSettingsView(config?: AiProviderConfig | null) {
  if (!config) {
    return {
      preferredProvider: 'openai' as const,
      model: '',
      openaiApiKeyPreview: null,
      openrouterApiKeyPreview: null,
      hasOpenAiKey: false,
      hasOpenRouterKey: false,
    };
  }

  return {
    preferredProvider: config.preferredProvider,
    model: config.model,
    openaiApiKeyPreview: maskSecret(config.openaiApiKey),
    openrouterApiKeyPreview: maskSecret(config.openrouterApiKey),
    hasOpenAiKey: Boolean(config.openaiApiKey),
    hasOpenRouterKey: Boolean(config.openrouterApiKey),
  };
}

export function toIntegrationSecretPreview(type: IntegrationType, configJson: Record<string, unknown>, secret?: Record<string, unknown> | null) {
  const health = getIntegrationHealth(type, configJson, secret);

  if (!secret) {
    return {
      hasStoredSecret: false,
      secretPreview: [] as string[],
      health,
    };
  }

  const preview = Object.entries(secret).map(([key, value]) => `${key}:${maskSecret(typeof value === 'string' ? value : JSON.stringify(value))}`);

  return {
    hasStoredSecret: true,
    secretPreview: preview,
    health,
  };
}

export function getIntegrationHealth(
  type: IntegrationType,
  configJson: Record<string, unknown>,
  secret?: Record<string, unknown> | null,
): IntegrationHealthState {
  const missing: string[] = [];

  if (type === 'JIRA') {
    const config = configJson as Partial<JiraIntegrationConfig>;
    const credentials = (secret ?? {}) as Partial<JiraIntegrationSecret>;

    if (!config.baseUrl) missing.push('baseUrl');
    if (!config.projectKey) missing.push('projectKey');
    if (!credentials.email) missing.push('email');
    if (!credentials.apiToken) missing.push('apiToken');
  }

  if (type === 'TRELLO') {
    const config = configJson as Partial<TrelloIntegrationConfig>;
    const credentials = (secret ?? {}) as Partial<TrelloIntegrationSecret>;

    if (!config.boardId) missing.push('boardId');
    if (!credentials.apiKey) missing.push('apiKey');
    if (!credentials.token) missing.push('token');
  }

  if (type === 'GOOGLE_SHEETS') {
    const config = configJson as Partial<GoogleSheetsIntegrationConfig>;
    const credentials = (secret ?? {}) as Partial<GoogleSheetsIntegrationSecret>;

    if (!config.spreadsheetId) missing.push('spreadsheetId');
    if (!config.sheetName) missing.push('sheetName');
    if (!credentials.serviceAccountJson) missing.push('serviceAccountJson');
  }

  return {
    isConfigured: missing.length === 0,
    missing,
  };
}
