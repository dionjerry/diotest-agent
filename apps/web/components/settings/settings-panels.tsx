'use client';

import { useActionState, useMemo, useState } from 'react';

import type { ActionState } from '@/app/actions';
import {
  saveAiSettingsAction,
  saveIntegrationConfigAction,
  saveIntegrationSecretAction,
  saveOAuthSettingsAction,
} from '@/app/actions';
import {
  IntegrationConfigFields,
  IntegrationSecretFields,
  type SupportedIntegrationType,
} from '@/components/integrations/provider-fields';
import { TestConnectionButton } from '@/components/integrations/test-connection-button';
import type { SettingsResponse } from '@/lib/api';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {};

export function OAuthSettingsCard({
  organizationId,
  oauth,
}: {
  organizationId?: string;
  oauth: SettingsResponse['oauth'];
}) {
  const [state, formAction] = useActionState(saveOAuthSettingsAction, initialState);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-soft">Auth provider config</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Google OAuth</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Editable for testing. Stored encrypted in the database and used before env fallback.
          </p>
        </div>
        <Badge tone={oauth.enabled ? 'success' : 'warn'}>{oauth.enabled ? 'Enabled' : 'Disabled'}</Badge>
      </div>
      <form action={formAction} className="mt-6 space-y-5">
        {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200">
          <input type="checkbox" name="enabled" defaultChecked={oauth.enabled} className="h-4 w-4 accent-emerald-500" />
          Enable Google OAuth sign-in for this deployment
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Client ID</Label>
            <Input name="clientId" defaultValue={oauth.clientId} placeholder="Google OAuth client ID" />
          </div>
          <div>
            <Label>Client secret</Label>
            <Input name="clientSecret" type="password" placeholder={oauth.clientSecretPreview ?? 'Paste a new secret'} />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <Label>Authorization URL</Label>
            <Input name="authUrl" defaultValue={oauth.authUrl} placeholder="Optional custom auth URL" />
          </div>
          <div>
            <Label>Token URL</Label>
            <Input name="tokenUrl" defaultValue={oauth.tokenUrl} placeholder="Optional custom token URL" />
          </div>
          <div>
            <Label>User info URL</Label>
            <Input name="userInfoUrl" defaultValue={oauth.userInfoUrl} placeholder="Optional custom user info URL" />
          </div>
        </div>
        <FormMessage tone="muted">
          `NEXTAUTH_SECRET` stays env-only. This form only controls the provider credentials and endpoints.
        </FormMessage>
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        <SubmitButton idleLabel="Save OAuth config" pendingLabel="Saving OAuth config..." />
      </form>
    </Card>
  );
}

export function AiSettingsCard({
  organizationId,
  projectId,
  ai,
}: {
  organizationId?: string;
  projectId?: string;
  ai: SettingsResponse['ai'];
}) {
  const [state, formAction] = useActionState(saveAiSettingsAction, initialState);

  return (
    <Card className="p-6">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-soft">AI provider config</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Runtime provider settings</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Product-level AI provider preferences belong in the database so self-hosted setups can change them without redeploying.
        </p>
      </div>
      <form action={formAction} className="mt-6 space-y-5">
        {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
        {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Preferred provider</Label>
            <select
              name="preferredProvider"
              defaultValue={ai.preferredProvider}
              className="h-11 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div>
            <Label>Model</Label>
            <Input name="model" defaultValue={ai.model} placeholder="gpt-4.1-mini or openrouter/free" />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>OpenAI API key</Label>
            <Input name="openaiApiKey" type="password" placeholder={ai.openaiApiKeyPreview ?? 'Stored encrypted if provided'} />
          </div>
          <div>
            <Label>OpenRouter API key</Label>
            <Input name="openrouterApiKey" type="password" placeholder={ai.openrouterApiKeyPreview ?? 'Stored encrypted if provided'} />
          </div>
        </div>
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        <SubmitButton idleLabel="Save AI settings" pendingLabel="Saving AI settings..." />
      </form>
    </Card>
  );
}

export function IntegrationSecretsCard({
  projectId,
  integrations,
}: {
  projectId: string;
  integrations: SettingsResponse['integrations'];
}) {
  const [configState, configAction] = useActionState(saveIntegrationConfigAction, initialState);
  const [secretState, secretAction] = useActionState(saveIntegrationSecretAction, initialState);
  const [selectedType, setSelectedType] = useState<SupportedIntegrationType>('JIRA');
  const integrationsByType = useMemo(
    () => Object.fromEntries(integrations.map((integration) => [integration.type, integration])),
    [integrations],
  ) as Record<string, SettingsResponse['integrations'][number] | undefined>;
  const selectedIntegration = integrationsByType[selectedType];
  const configJson = selectedIntegration?.configJson ?? {};

  return (
    <Card className="p-6">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-soft">Integration secrets</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Credential storage</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Integration labels and metadata stay in structured settings. Tokens and credentials are stored encrypted per project.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {integrations.length > 0 ? (
          integrations.map((integration) => (
            <div key={integration.id} className="rounded-3xl border border-line bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-text">{integration.type}</div>
                  <div className="text-xs text-soft">{integration.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={integration.health.isConfigured ? 'success' : integration.hasStoredSecret ? 'warn' : 'neutral'}>
                    {integration.health.isConfigured
                      ? 'Ready'
                      : integration.health.missing.length > 0
                        ? `Missing: ${integration.health.missing.join(', ')}`
                        : integration.hasStoredSecret
                          ? 'Partial'
                          : 'Not configured'}
                  </Badge>
                  {integration.health.isConfigured ? (
                    <TestConnectionButton
                      projectId={projectId}
                      type={integration.type as SupportedIntegrationType}
                    />
                  ) : null}
                </div>
              </div>
              {integration.secretPreview.length > 0 ? (
                <div className="mt-3 text-xs text-soft">{integration.secretPreview.join(' · ')}</div>
              ) : null}
            </div>
          ))
      ) : (
          <div className="rounded-3xl border border-dashed border-line bg-zinc-950/30 px-4 py-6 text-sm text-muted">
            No project integrations are connected yet.
          </div>
        )}
      </div>
      <div className="mt-6">
        <Label>Integration</Label>
        <select
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as SupportedIntegrationType)}
          className="mt-2 h-11 w-full max-w-sm rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
        >
          <option value="JIRA">Jira</option>
          <option value="TRELLO">Trello</option>
          <option value="GOOGLE_SHEETS">Google Sheets</option>
        </select>
      </div>

      <form key={`${selectedType}-config`} action={configAction} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="type" value={selectedType} />
        <div className="grid gap-5 md:grid-cols-3">
          <IntegrationConfigFields type={selectedType} config={configJson} />
        </div>
        <FormMessage tone="success">{configState.success}</FormMessage>
        <FormMessage>{configState.error}</FormMessage>
        <SubmitButton idleLabel="Save integration config" pendingLabel="Saving config..." />
      </form>

      <form key={`${selectedType}-secret`} action={secretAction} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="type" value={selectedType} />
        <div className="grid gap-5 md:grid-cols-3">
          <IntegrationSecretFields
            type={selectedType}
            hasStoredSecret={selectedIntegration?.hasStoredSecret}
            secretPreview={selectedIntegration?.secretPreview}
          />
        </div>
        <FormMessage tone="success">{secretState.success}</FormMessage>
        <FormMessage>{secretState.error}</FormMessage>
        <SubmitButton idleLabel="Save integration credentials" pendingLabel="Saving credentials..." />
      </form>
    </Card>
  );
}
