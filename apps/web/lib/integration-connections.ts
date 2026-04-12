import { prisma } from '@/lib/prisma';
import { saveIntegration, saveIntegrationSecret } from '@/lib/api';
import { decryptPayload } from '@/lib/encryption';

export type IntegrationType = 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';

export type IntegrationConfigMap = {
  JIRA: { baseUrl: string; projectKey: string; issueType?: string };
  TRELLO: { boardId: string; defaultListId?: string };
  GOOGLE_SHEETS: { spreadsheetId: string; sheetName: string };
};

export type IntegrationSecretMap = {
  JIRA: { email: string; apiToken: string };
  TRELLO: { apiKey: string; token: string };
  GOOGLE_SHEETS: { serviceAccountJson: string };
};

const INTEGRATION_NAMES: Record<IntegrationType, string> = {
  JIRA: 'Jira',
  TRELLO: 'Trello',
  GOOGLE_SHEETS: 'Google Sheets',
};

export function getIntegrationName(type: IntegrationType) {
  return INTEGRATION_NAMES[type];
}

function isPresent(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateIntegrationPayload(type: IntegrationType, config: Record<string, string>, secret: Record<string, string>) {
  if (type === 'JIRA') {
    if (!isPresent(config.baseUrl) || !isPresent(config.projectKey)) {
      return { ok: false, message: 'Jira requires a base URL and project key.' } as const;
    }
    if (!isPresent(secret.email) || !isPresent(secret.apiToken)) {
      return { ok: false, message: 'Jira requires an Atlassian account email and API token.' } as const;
    }
  }

  if (type === 'TRELLO') {
    if (!isPresent(config.boardId)) {
      return { ok: false, message: 'Trello requires a board ID.' } as const;
    }
    if (!isPresent(secret.apiKey) || !isPresent(secret.token)) {
      return { ok: false, message: 'Trello requires an API key and token.' } as const;
    }
  }

  if (type === 'GOOGLE_SHEETS') {
    if (!isPresent(config.spreadsheetId) || !isPresent(config.sheetName)) {
      return { ok: false, message: 'Google Sheets requires a spreadsheet ID and sheet name.' } as const;
    }
    if (!isPresent(secret.serviceAccountJson)) {
      return { ok: false, message: 'Google Sheets requires service account JSON.' } as const;
    }
    try {
      JSON.parse(secret.serviceAccountJson);
    } catch {
      return { ok: false, message: 'Google Sheets service account JSON must be valid JSON.' } as const;
    }
  }

  return { ok: true } as const;
}

export async function persistIntegrationConnection(
  projectId: string,
  type: IntegrationType,
  config: Record<string, string>,
  secret: Record<string, string>,
) {
  const validation = validateIntegrationPayload(type, config, secret);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const integration = await saveIntegration({
    projectId,
    type,
    name: getIntegrationName(type),
    configJson: config,
  });

  await saveIntegrationSecret({
    projectId,
    type,
    secretJson: secret,
  });

  return integration;
}

export async function getPersistedIntegrationState(projectId: string, type: IntegrationType) {
  const integration = await prisma.integrationConnection.findFirst({
    where: { projectId, type },
  });

  if (!integration) {
    return {
      exists: false,
      isConfigured: false,
      message: `${getIntegrationName(type)} is not configured yet.`,
    };
  }

  const secretRecord = await prisma.encryptedSecret.findFirst({
    where: {
      scope: 'PROJECT',
      projectId,
      organizationId: null,
      key: `integration.${type.toLowerCase()}`,
    },
  });

  if (!secretRecord) {
    return {
      exists: true,
      isConfigured: false,
      message: `${getIntegrationName(type)} credentials are not configured yet.`,
    };
  }

  const config = (integration.configJson ?? {}) as Record<string, string>;
  const secret = decryptPayload<Record<string, string>>(secretRecord);
  const validation = validateIntegrationPayload(type, config, secret);

  return {
    exists: true,
    isConfigured: validation.ok,
    message: validation.ok ? '' : validation.message,
    integration,
    config,
  };
}
