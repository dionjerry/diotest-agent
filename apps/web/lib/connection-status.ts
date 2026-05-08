import type { BootstrapResponse, SettingsResponse } from '@/lib/api';

export type ConnectionTone = 'neutral' | 'brand' | 'warn' | 'danger' | 'success';

export type ConnectionPresentation = {
  label: string;
  tone: ConnectionTone;
  summary: string;
  recovery?: string;
  advancedLabel?: string;
};

export function getRepositoryConnectionPresentation(
  connection: BootstrapResponse['repositoryConnection'] | SettingsResponse['repositoryConnection'],
): ConnectionPresentation {
  if (!connection) {
    return {
      label: 'Provider not connected',
      tone: 'neutral',
      summary: 'Connect GitHub or GitLab so DioTest can monitor a repository for this project.',
      recovery: 'Authorize a provider first, then select the repository or project DioTest should track.',
    };
  }

  if (connection.webhookStatus === 'configured') {
    return {
      label: 'Webhook configured',
      tone: 'success',
      summary: `${connection.fullName} is connected and DioTest can receive provider events for this project.`,
    };
  }

  return {
    label: 'Webhook needs attention',
    tone: 'warn',
    summary: `${connection.fullName} is connected, but DioTest could not confirm a healthy provider webhook.`,
    recovery:
      'Reconnect the provider or save the repository again after checking the public app URL and provider credentials.',
    advancedLabel: connection.webhookLastError ?? undefined,
  };
}

export function getIntegrationHealthPresentation(
  integration: SettingsResponse['integrations'][number],
): ConnectionPresentation {
  if (integration.health.isConfigured) {
    return {
      label: 'Webhook configured',
      tone: 'success',
      summary: `${integration.name} is ready for project workflows.`,
    };
  }

  return {
    label: 'Credentials missing',
    tone: integration.hasStoredSecret ? 'warn' : 'neutral',
    summary: integration.health.missing.length
      ? `${integration.name} still needs ${integration.health.missing.join(', ')} before DioTest can use it.`
      : `${integration.name} is saved but still needs final configuration.`,
    recovery: 'Open Integrations to complete the required settings and credentials.',
  };
}

export function getExtensionConnectionPresentation({
  detected,
  connected,
}: {
  detected: boolean;
  connected: boolean;
}): ConnectionPresentation {
  if (connected) {
    return {
      label: 'Extension connected',
      tone: 'success',
      summary: 'The recorder has verified itself against this exact DioTest project and Continue is unlocked.',
    };
  }

  if (detected) {
    return {
      label: 'Extension detected',
      tone: 'warn',
      summary: 'The extension is installed, but it has not yet been verified against this project.',
      recovery: 'Copy the URL and key into the extension settings, save them, and click Test Connection.',
    };
  }

  return {
    label: 'Extension not detected',
    tone: 'warn',
    summary: 'Open this page with the recorder installed so DioTest can detect the extension before testing the connection.',
    recovery: 'Install the extension, open or refresh this page, then complete the project connection in the extension.',
  };
}
