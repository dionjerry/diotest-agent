import { google } from 'googleapis';

import type {
  GoogleSheetsIntegrationConfig,
  GoogleSheetsIntegrationSecret,
  IntegrationType,
  JiraIntegrationConfig,
  JiraIntegrationSecret,
  TrelloIntegrationConfig,
  TrelloIntegrationSecret,
} from '@diotest/domain/platform/types';

import { prisma } from '../db.js';
import { decryptPayload } from './secrets.js';

type IntegrationBundle = {
  type: IntegrationType;
  configJson: Record<string, unknown>;
  secretJson: Record<string, unknown>;
};

export async function getIntegrationBundle(projectId: string, type: IntegrationType): Promise<IntegrationBundle> {
  const integration = await prisma.integrationConnection.findFirst({
    where: { projectId, type },
  });

  if (!integration) {
    throw new Error(`${type} integration is not configured for this project.`);
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
    throw new Error(`${type} credentials are not configured for this project.`);
  }

  return {
    type,
    configJson: integration.configJson as Record<string, unknown>,
    secretJson: decryptPayload<Record<string, unknown>>(secretRecord),
  };
}

function withJsonHeaders(init?: RequestInit) {
  return {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  } satisfies RequestInit;
}

async function parseProviderResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'errorMessages' in payload
        ? String((payload as { errorMessages?: string[] }).errorMessages?.join(', ') ?? 'Provider request failed')
        : typeof payload === 'object' && payload && 'message' in payload
          ? String((payload as { message?: string }).message ?? 'Provider request failed')
          : `Provider request failed with status ${response.status}.`,
    );
  }

  return payload;
}

export async function createJiraIssue(projectId: string, input: Record<string, unknown>) {
  const bundle = await getIntegrationBundle(projectId, 'JIRA');
  const config = bundle.configJson as unknown as JiraIntegrationConfig;
  const credentials = bundle.secretJson as unknown as JiraIntegrationSecret;
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');

  const response = await fetch(
    `${baseUrl}/rest/api/3/issue`,
    withJsonHeaders({
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: config.projectKey,
          },
          summary: String(input.title ?? 'DioTest issue'),
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: String(input.description ?? ''),
                  },
                ],
              },
            ],
          },
          issuetype: {
            name: config.issueType || 'Task',
          },
          labels: Array.isArray(input.labels) ? input.labels : undefined,
        },
      }),
    }),
  );

  const payload = (await parseProviderResponse(response)) as { key: string; self?: string };

  return {
    issueKey: payload.key,
    issueUrl: `${baseUrl}/browse/${payload.key}`,
    status: 'created',
  };
}

export async function getJiraIssueStatus(projectId: string, input: Record<string, unknown>) {
  const issueKey = String(input.issueKey ?? '').trim();
  if (!issueKey) {
    throw new Error('issueKey is required for Jira status checks.');
  }

  const bundle = await getIntegrationBundle(projectId, 'JIRA');
  const config = bundle.configJson as unknown as JiraIntegrationConfig;
  const credentials = bundle.secretJson as unknown as JiraIntegrationSecret;
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');

  const response = await fetch(
    `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`,
    withJsonHeaders({
      headers: {
        authorization: `Basic ${auth}`,
      },
    }),
  );

  const payload = (await parseProviderResponse(response)) as { key: string; fields?: { status?: { name?: string } } };

  return {
    issueKey: payload.key,
    issueUrl: `${baseUrl}/browse/${payload.key}`,
    status: payload.fields?.status?.name ?? 'Unknown',
  };
}

export async function createTrelloCard(projectId: string, input: Record<string, unknown>) {
  const bundle = await getIntegrationBundle(projectId, 'TRELLO');
  const config = bundle.configJson as unknown as TrelloIntegrationConfig;
  const credentials = bundle.secretJson as unknown as TrelloIntegrationSecret;
  const listId = config.defaultListId || config.boardId;

  if (!listId) {
    throw new Error('Trello boardId or defaultListId is required.');
  }

  const url = new URL('https://api.trello.com/1/cards');
  url.searchParams.set('idList', listId);
  url.searchParams.set('name', String(input.title ?? 'DioTest card'));
  url.searchParams.set('desc', String(input.description ?? ''));
  url.searchParams.set('key', credentials.apiKey);
  url.searchParams.set('token', credentials.token);

  const response = await fetch(url, { method: 'POST' });
  const payload = (await parseProviderResponse(response)) as { id: string; shortUrl?: string; idList?: string };

  return {
    cardId: payload.id,
    cardUrl: payload.shortUrl ?? '',
    listName: payload.idList ?? listId,
    status: 'created',
  };
}

export async function getTrelloCardStatus(projectId: string, input: Record<string, unknown>) {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('cardId is required for Trello status checks.');
  }

  const bundle = await getIntegrationBundle(projectId, 'TRELLO');
  const credentials = bundle.secretJson as unknown as TrelloIntegrationSecret;
  const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}`);
  url.searchParams.set('fields', 'id,name,shortUrl,idList');
  url.searchParams.set('key', credentials.apiKey);
  url.searchParams.set('token', credentials.token);

  const response = await fetch(url);
  const payload = (await parseProviderResponse(response)) as { id: string; shortUrl?: string; idList?: string };

  return {
    cardId: payload.id,
    cardUrl: payload.shortUrl ?? '',
    listName: payload.idList ?? 'Unknown',
    status: 'fetched',
  };
}

export async function exportTicketsTable(projectId: string, input: Record<string, unknown>) {
  const bundle = await getIntegrationBundle(projectId, 'GOOGLE_SHEETS');
  const config = bundle.configJson as unknown as GoogleSheetsIntegrationConfig;
  const credentials = bundle.secretJson as unknown as GoogleSheetsIntegrationSecret;
  const rowsInput = Array.isArray(input.rows) ? input.rows : [];

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials.serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const values = [
    ['Title', 'Type', 'Target', 'Status', 'Summary', 'Completed At'],
    ...rowsInput.map((row) => {
      const item = row as Record<string, unknown>;
      return [
        String(item.title ?? ''),
        String(item.type ?? ''),
        String(item.target ?? ''),
        String(item.status ?? ''),
        String(item.summary ?? ''),
        String(item.completedAt ?? ''),
      ];
    }),
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range: config.sheetName,
  }).catch(() => undefined);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: config.sheetName,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });

  return {
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName,
    rowsWritten: Math.max(values.length - 1, 0),
  };
}
