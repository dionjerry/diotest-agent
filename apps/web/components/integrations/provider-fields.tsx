import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type SupportedIntegrationType = 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';

export function IntegrationConfigFields({
  type,
  config,
}: {
  type: SupportedIntegrationType;
  config?: Record<string, unknown>;
}) {
  if (type === 'JIRA') {
    return (
      <>
        <div>
          <Label>Base URL</Label>
          <Input name="baseUrl" defaultValue={String(config?.baseUrl ?? '')} placeholder="https://your-team.atlassian.net" />
        </div>
        <div>
          <Label>Project key</Label>
          <Input name="projectKey" defaultValue={String(config?.projectKey ?? '')} placeholder="DIO" />
        </div>
        <div>
          <Label>Issue type</Label>
          <Input name="issueType" defaultValue={String(config?.issueType ?? 'Task')} placeholder="Task" />
        </div>
      </>
    );
  }

  if (type === 'TRELLO') {
    return (
      <>
        <div>
          <Label>Board ID</Label>
          <Input name="boardId" defaultValue={String(config?.boardId ?? '')} placeholder="Trello board id" />
        </div>
        <div>
          <Label>Default list ID</Label>
          <Input name="defaultListId" defaultValue={String(config?.defaultListId ?? '')} placeholder="Optional list id" />
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <Label>Spreadsheet ID</Label>
        <Input name="spreadsheetId" defaultValue={String(config?.spreadsheetId ?? '')} placeholder="Google spreadsheet id" />
      </div>
      <div>
        <Label>Sheet name</Label>
        <Input name="sheetName" defaultValue={String(config?.sheetName ?? '')} placeholder="Tickets" />
      </div>
    </>
  );
}

export function IntegrationSecretFields({
  type,
  hasStoredSecret = false,
  secretPreview = [],
}: {
  type: SupportedIntegrationType;
  hasStoredSecret?: boolean;
  secretPreview?: string[];
}) {
  if (type === 'JIRA') {
    const emailPreview = secretPreview.find((item) => item.startsWith('email:'))?.replace('email:', '').trim();
    return (
      <>
        <div>
          <Label>Jira account email</Label>
          <Input name="email" type="email" placeholder={emailPreview || 'name@company.com'} />
        </div>
        <div>
          <Label>Jira API token</Label>
          <Input
            name="apiToken"
            type="password"
            placeholder={hasStoredSecret ? 'Stored encrypted. Paste a new token to replace it.' : 'Atlassian API token'}
          />
        </div>
      </>
    );
  }

  if (type === 'TRELLO') {
    return (
      <>
        <div>
          <Label>Trello API key</Label>
          <Input
            name="apiKey"
            type="password"
            placeholder={hasStoredSecret ? 'Stored encrypted. Paste a new key to replace it.' : 'Trello API key'}
          />
        </div>
        <div>
          <Label>Trello token</Label>
          <Input
            name="token"
            type="password"
            placeholder={hasStoredSecret ? 'Stored encrypted. Paste a new token to replace it.' : 'Trello token'}
          />
        </div>
      </>
    );
  }

  return (
    <div className="md:col-span-3">
      <Label>Service account JSON</Label>
      <textarea
        name="serviceAccountJson"
        defaultValue=""
        placeholder={hasStoredSecret ? 'Stored encrypted. Paste new service account JSON to replace it.' : '{"type":"service_account", ...}'}
        className="min-h-40 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 py-3 text-sm text-text outline-none transition placeholder:text-soft focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
      />
    </div>
  );
}
