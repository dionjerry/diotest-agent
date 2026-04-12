import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { decryptPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logServerDebug, logServerError, logServerEvent } from '@/lib/server-logger';

type IntegrationType = 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';

type TestConnectionBody = {
  type: IntegrationType;
  createSample?: boolean;
  config?: Record<string, string>;
  secret?: Record<string, string>;
  projectId?: string;
};

type ParsedProviderBody = {
  text?: string;
  json?: unknown;
};

function isSafeProviderText(value: string | null | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return !/(token|authorization|bearer|password|secret|apikey|api key|private[_ -]?key|cipher)/i.test(trimmed);
}

function cleanProviderText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return isSafeProviderText(normalized) ? normalized : null;
}

async function parseProviderBody(response: Response): Promise<ParsedProviderBody> {
  const rawText = await response.text().catch(() => '');
  const text = cleanProviderText(rawText) ?? undefined;

  if (!rawText) {
    return { text: undefined, json: undefined };
  }

  try {
    return { text, json: JSON.parse(rawText) as unknown };
  } catch {
    return { text, json: undefined };
  }
}

function describeObjectKeys(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];
}

function getJiraProviderMessage(status: number, parsed: ParsedProviderBody, context: 'profile' | 'project' | 'issue') {
  if (status === 401) return 'Invalid Jira credentials. Check your email and API token.';
  if (status === 403) return 'Jira access denied. Ensure the API token has site access.';

  const payload = parsed.json as { errorMessages?: string[]; errors?: Record<string, string> } | undefined;
  const errorMessage = cleanProviderText(payload?.errorMessages?.find(Boolean));
  const fieldMessage = cleanProviderText(Object.values(payload?.errors ?? {}).find(Boolean));
  const providerMessage = errorMessage ?? fieldMessage ?? parsed.text ?? null;

  if (providerMessage) {
    if (/project/i.test(providerMessage) || context === 'project') {
      return `Jira rejected the project key. ${providerMessage}`;
    }
    if (context === 'issue') {
      return `Jira could not create the sample issue. ${providerMessage}`;
    }
    return `Jira rejected the request. ${providerMessage}`;
  }

  return `Jira returned status ${status}.`;
}

function getTrelloProviderMessage(status: number, parsed: ParsedProviderBody, context: 'board' | 'card' | 'list') {
  if (status === 401) return 'Invalid Trello API key or token.';
  if (status === 404) {
    if (context === 'card') return 'Trello could not create the sample card. Check the selected list ID.';
    if (context === 'list') return 'Trello could not create the default list on this board.';
    return 'Trello board not found. Check the Board ID.';
  }

  const providerMessage = parsed.text ?? null;
  if (providerMessage) {
    if (/invalid id/i.test(providerMessage)) {
      if (context === 'card') return 'Trello rejected the list ID. Check the default list ID or let DioTest create one automatically.';
      return 'Trello rejected the Board ID. Check the value copied from the board URL.';
    }
    if (context === 'card') return `Trello could not create the sample card. ${providerMessage}`;
    if (context === 'list') return `Trello could not create the default list. ${providerMessage}`;
    return `Trello rejected the request. ${providerMessage}`;
  }

  return `Trello returned status ${status}.`;
}

function getGoogleProviderMessage(status: number, parsed: ParsedProviderBody, context: 'oauth' | 'spreadsheet' | 'append') {
  const payload = parsed.json as Record<string, unknown> | undefined;
  const oauthMessage = cleanProviderText(typeof payload?.error_description === 'string' ? payload.error_description : null);
  const errorValue = payload?.error;
  const apiMessage =
    errorValue && typeof errorValue === 'object'
      ? cleanProviderText(typeof (errorValue as { message?: unknown }).message === 'string' ? String((errorValue as { message?: unknown }).message) : null)
      : null;
  const providerMessage = oauthMessage ?? apiMessage ?? parsed.text ?? null;

  if (context === 'oauth') {
    if (providerMessage) return `Google OAuth rejected the service account credentials. ${providerMessage}`;
    return 'Google OAuth rejected the service account credentials.';
  }

  if (status === 403) {
    if (context === 'append') return 'Permission denied while writing to the sheet. Share the spreadsheet with the service account and confirm the tab name.';
    return 'Permission denied. Share the spreadsheet with the service account email.';
  }
  if (status === 404) {
    if (context === 'append') return 'Google Sheets could not find the target tab. Check the sheet name.';
    return 'Spreadsheet not found. Check the spreadsheet ID.';
  }

  if (providerMessage) {
    if (context === 'append') return `Google Sheets could not add the sample row. ${providerMessage}`;
    return `Google Sheets rejected the request. ${providerMessage}`;
  }

  return `Google Sheets returned status ${status}.`;
}

function logProviderDebug(event: string, meta: Record<string, unknown>) {
  logServerDebug(event, meta);
}

async function getDbConfig(projectId: string, type: IntegrationType) {
  const record = await prisma.integrationConnection.findFirst({ where: { projectId, type } });
  return record ? (record.configJson as Record<string, string>) : null;
}

async function getDbSecret(projectId: string, type: IntegrationType) {
  const record = await prisma.encryptedSecret.findFirst({
    where: {
      scope: 'PROJECT',
      projectId,
      organizationId: null,
      key: `integration.${type.toLowerCase()}`,
    },
  });

  return record ? decryptPayload<Record<string, string>>(record) : null;
}

type JiraPreview = { accountId: string; displayName: string; projectName?: string; sampleIssueKey?: string; sampleIssueUrl?: string };

async function testJira(
  config: Record<string, string>,
  secret: Record<string, string>,
  createSample: boolean,
): Promise<{ ok: boolean; message: string; preview?: JiraPreview; providerMessage?: string }> {
  const { baseUrl, projectKey } = config;
  const { email, apiToken } = secret;

  if (!baseUrl || !email || !apiToken) {
    return { ok: false, message: 'Jira connection is not fully configured.' };
  }

  const base = baseUrl.replace(/\/$/, '');
  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const headers = { Authorization: `Basic ${authHeader}`, Accept: 'application/json', 'Content-Type': 'application/json' };

  try {
    logProviderDebug('integration.provider.request.debug', {
      integrationType: 'JIRA',
      operation: 'profile',
      baseUrl: base,
      projectKey,
      createSample,
      configKeys: Object.keys(config).sort(),
      secretKeys: Object.keys(secret).sort(),
    });
    const meRes = await fetch(`${base}/rest/api/3/myself`, { headers });
    if (!meRes.ok) {
      const parsed = await parseProviderBody(meRes);
      return { ok: false, message: getJiraProviderMessage(meRes.status, parsed, 'profile'), providerMessage: parsed.text };
    }

    const me = (await meRes.json()) as { accountId: string; displayName: string };
    const preview: JiraPreview = { accountId: me.accountId, displayName: me.displayName };

    if (projectKey) {
      const projRes = await fetch(`${base}/rest/api/3/project/${projectKey}`, { headers }).catch(() => null);
      if (projRes?.ok) {
        const proj = (await projRes.json()) as { name?: string };
        preview.projectName = proj.name;
      } else if (projRes) {
        const parsed = await parseProviderBody(projRes);
        return { ok: false, message: getJiraProviderMessage(projRes.status, parsed, 'project'), providerMessage: parsed.text };
      }
    }

    if (createSample && projectKey) {
      const issueRes = await fetch(`${base}/rest/api/3/issue`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: 'DioTest Connection Verified ✓',
            description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This test issue was created automatically by DioTest during setup verification. Safe to delete.' }] }] },
            issuetype: { name: config.issueType || 'Task' },
          },
        }),
      }).catch(() => null);

      if (issueRes?.ok) {
        const issue = (await issueRes.json()) as { key: string };
        preview.sampleIssueKey = issue.key;
        preview.sampleIssueUrl = `${base}/browse/${issue.key}`;
      } else if (issueRes) {
        const parsed = await parseProviderBody(issueRes);
        return { ok: false, message: getJiraProviderMessage(issueRes.status, parsed, 'issue'), preview, providerMessage: parsed.text };
      }
    }

    return {
      ok: true,
      message: createSample && preview.sampleIssueKey
        ? `Connected as ${preview.displayName}. Sample issue ${preview.sampleIssueKey} created.`
        : `Connected as ${preview.displayName}.`,
      preview,
    };
  } catch {
    return { ok: false, message: 'Could not reach the Jira API. Check the base URL.' };
  }
}

type TrelloPreview = { boardName: string; lists: Array<{ id: string; name: string }>; sampleCardUrl?: string; sampleCardId?: string; sampleCardError?: string };

async function testTrello(
  config: Record<string, string>,
  secret: Record<string, string>,
  createSample: boolean,
): Promise<{ ok: boolean; message: string; preview?: TrelloPreview; providerMessage?: string }> {
  const { boardId, defaultListId } = config;
  const { apiKey, token } = secret;

  if (!boardId || !apiKey || !token) {
    return { ok: false, message: 'Trello connection is not fully configured.' };
  }

  const qs = `key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;

  try {
    logProviderDebug('integration.provider.request.debug', {
      integrationType: 'TRELLO',
      operation: 'board',
      boardId,
      defaultListId,
      createSample,
      configKeys: Object.keys(config).sort(),
      secretKeys: Object.keys(secret).sort(),
    });
    const boardRes = await fetch(`https://api.trello.com/1/boards/${boardId}?${qs}&fields=name`);
    if (!boardRes.ok) {
      const parsed = await parseProviderBody(boardRes);
      return { ok: false, message: getTrelloProviderMessage(boardRes.status, parsed, 'board'), providerMessage: parsed.text };
    }
    const board = (await boardRes.json()) as { name: string };

    const listsRes = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?${qs}&filter=open&fields=id,name`);
    const lists: Array<{ id: string; name: string }> = listsRes.ok ? ((await listsRes.json()) as Array<{ id: string; name: string }>) : [];

    const preview: TrelloPreview = { boardName: board.name, lists };

    if (createSample) {
      let targetList = defaultListId || lists[0]?.id;

      if (!targetList) {
        const createListParams = new URLSearchParams({ key: apiKey, token, idBoard: boardId, name: 'Incoming Tickets' });
        const newListRes = await fetch(`https://api.trello.com/1/lists?${createListParams.toString()}`, { method: 'POST' }).catch(() => null);
        if (newListRes?.ok) {
          const newList = (await newListRes.json()) as { id: string; name: string };
          targetList = newList.id;
          preview.lists.push({ id: newList.id, name: newList.name });
        } else if (newListRes) {
          const parsed = await parseProviderBody(newListRes);
          return { ok: false, message: getTrelloProviderMessage(newListRes.status, parsed, 'list'), preview, providerMessage: parsed.text };
        }
      }

      if (targetList) {
        const cardParams = new URLSearchParams({
          key: apiKey,
          token,
          idList: targetList,
          name: 'DioTest Connection Verified ✓',
          desc: 'This test card was created automatically by DioTest during setup verification. Safe to delete.',
        });
        const cardRes = await fetch(`https://api.trello.com/1/cards?${cardParams.toString()}`, {
          method: 'POST',
        }).catch((error: unknown) => {
          preview.sampleCardError = String(error);
          return null;
        });

        if (cardRes?.ok) {
          const card = (await cardRes.json()) as { id: string; shortUrl: string };
          preview.sampleCardId = card.id;
          preview.sampleCardUrl = card.shortUrl;
        } else if (cardRes && !preview.sampleCardError) {
          const parsed = await parseProviderBody(cardRes);
          const cardMessage = getTrelloProviderMessage(cardRes.status, parsed, 'card');
          preview.sampleCardError = cardMessage;
          return { ok: false, message: cardMessage, preview, providerMessage: parsed.text };
        }
      } else {
        preview.sampleCardError = 'Board has no lists, and we could not auto-create one. Please manually create a list on Trello first.';
        return { ok: false, message: preview.sampleCardError, preview };
      }
    }

    return {
      ok: true,
      message: createSample && preview.sampleCardUrl
        ? `Connected to board "${preview.boardName}". Sample card created.`
        : `Connected to board "${preview.boardName}".`,
      preview,
    };
  } catch {
    return { ok: false, message: 'Could not reach the Trello API.' };
  }
}

type SheetsPreview = { title: string; sheets: string[]; sampleRowAdded?: boolean };

async function testGoogleSheets(
  config: Record<string, string>,
  secret: Record<string, string>,
  createSample: boolean,
): Promise<{ ok: boolean; message: string; preview?: SheetsPreview; providerMessage?: string }> {
  const { spreadsheetId, sheetName } = config;
  const { serviceAccountJson } = secret;

  if (!spreadsheetId || !serviceAccountJson) {
    return { ok: false, message: 'Google Sheets connection is not fully configured.' };
  }

  let serviceAccount: { client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
  } catch {
    return { ok: false, message: 'Service account JSON is not valid JSON.' };
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    return { ok: false, message: 'Service account JSON is missing client_email or private_key.' };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const { createSign } = await import('node:crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    if (!tokenRes.ok) {
      const parsed = await parseProviderBody(tokenRes);
      return { ok: false, message: getGoogleProviderMessage(tokenRes.status, parsed, 'oauth'), providerMessage: parsed.text };
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const authHeader = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      { headers: authHeader },
    );
    if (!metaRes.ok) {
      const parsed = await parseProviderBody(metaRes);
      return { ok: false, message: getGoogleProviderMessage(metaRes.status, parsed, 'spreadsheet'), providerMessage: parsed.text };
    }

    const meta = (await metaRes.json()) as { properties?: { title?: string }; sheets?: Array<{ properties?: { title?: string } }> };
    const preview: SheetsPreview = {
      title: meta.properties?.title ?? 'Spreadsheet',
      sheets: meta.sheets?.map((sheet) => sheet.properties?.title ?? '').filter(Boolean) ?? [],
    };

    if (createSample && sheetName) {
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            values: [['DioTest Connection Verified', new Date().toISOString()]],
          }),
        },
      );
      if (appendRes.ok) {
        preview.sampleRowAdded = true;
      } else {
        const parsed = await parseProviderBody(appendRes);
        return { ok: false, message: getGoogleProviderMessage(appendRes.status, parsed, 'append'), preview, providerMessage: parsed.text };
      }
    }

    return {
      ok: true,
      message: createSample && preview.sampleRowAdded
        ? `Connected to "${preview.title}". Sample row added.`
        : `Connected to "${preview.title}".`,
      preview,
    };
  } catch {
    return { ok: false, message: 'Could not reach the Google Sheets API.' };
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const session = await auth();

  if (!session?.user?.id) {
    logServerError('integration.test.failed', 'auth_error', { status: 'failed' });
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TestConnectionBody;
    const createSample = body.createSample === true;
    let config = body.config ?? null;
    let secret = body.secret ?? null;
    logServerDebug('integration.test.request.debug', {
      userId: session.user.id,
      projectId: body.projectId,
      integrationType: body.type,
      createSample,
      configKeys: describeObjectKeys(body.config),
      secretKeys: describeObjectKeys(body.secret),
      hasInlineConfig: Boolean(body.config),
      hasInlineSecret: Boolean(body.secret),
    });

    if ((!config || !secret) && body.projectId) {
      config = await getDbConfig(body.projectId, body.type);
      secret = await getDbSecret(body.projectId, body.type);
      logServerDebug('integration.test.db-fallback.debug', {
        userId: session.user.id,
        projectId: body.projectId,
        integrationType: body.type,
        hasSavedConfig: Boolean(config),
        hasSavedSecret: Boolean(secret),
        savedConfigKeys: describeObjectKeys(config),
        savedSecretKeys: describeObjectKeys(secret),
      });
    }

    if (!config || !secret) {
      const message = !config
        ? 'Integration settings have not been saved yet. Re-enter the provider details and click Save & Connect before refreshing.'
        : 'Integration credentials have not been saved yet. Re-enter the secret fields and click Save & Connect before refreshing.';
      logServerError('integration.test.failed', 'validation_error', {
        status: 'failed',
        userId: session.user.id,
        projectId: body.projectId,
        integrationType: body.type,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }

    const result = body.type === 'JIRA'
      ? await testJira(config, secret, createSample)
      : body.type === 'TRELLO'
        ? await testTrello(config, secret, createSample)
        : await testGoogleSheets(config, secret, createSample);

    if (result.ok) {
      logServerEvent(createSample ? 'integration.sample.created' : 'integration.tested', {
        status: 'success',
        userId: session.user.id,
        projectId: body.projectId,
        integrationType: body.type,
        durationMs: Date.now() - startedAt,
      });
      logServerDebug(createSample ? 'integration.sample.created.debug' : 'integration.tested.debug', {
        status: 'success',
        userId: session.user.id,
        projectId: body.projectId,
        integrationType: body.type,
        createSample,
        configKeys: describeObjectKeys(config),
        secretKeys: describeObjectKeys(secret),
        previewKeys: result.preview ? Object.keys(result.preview).sort() : [],
        durationMs: Date.now() - startedAt,
      });
    } else {
      logServerError(createSample ? 'integration.sample.failed' : 'integration.test.failed', 'provider_error', {
        status: 'failed',
        userId: session.user.id,
        projectId: body.projectId,
        integrationType: body.type,
        providerMessage: result.providerMessage,
        configKeys: describeObjectKeys(config),
        secretKeys: describeObjectKeys(secret),
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logServerError('integration.test.failed', 'internal_error', {
      status: 'failed',
      userId: session?.user?.id,
      durationMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ ok: false, message: 'Could not verify the integration right now.' }, { status: 500 });
  }
}
