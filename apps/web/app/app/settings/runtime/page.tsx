import { AiSettingsCard, OAuthSettingsCard, RuntimeOperationsCard } from '@/components/settings/settings-panels';
import { ExtensionConnectionCard } from '@/components/settings/extension-connection-card';
import { SettingsPageFrame } from '@/components/settings/settings-page-frame';
import { getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';
import { getOrCreateExtensionApiKey } from '@/lib/extension-key';

export default async function RuntimeSettingsPage() {
  const { bootstrap } = await requireOnboardedUser();
  if (!bootstrap) return null;
  const canManageSettings = bootstrap.organization?.currentUserRole === 'owner' || bootstrap.organization?.currentUserRole === 'admin';

  const [settings, extensionApiKey] = await Promise.all([
    getSettings({
      organizationId: bootstrap.organization?.id,
      projectId: bootstrap.project?.id,
    }),
    bootstrap.project ? getOrCreateExtensionApiKey(bootstrap.project.id) : Promise.resolve(''),
  ]);

  const apiBaseUrl = bootstrap.organization && bootstrap.project
    ? `${process.env.NEXTAUTH_URL ?? ''}/${bootstrap.organization.slug}/${bootstrap.project.id}`
    : '';

  return (
    <SettingsPageFrame
      eyebrow="Settings / Runtime"
      title="Runtime & Auth"
      description="Control AI runtime configuration, OAuth provider settings, exports, and the operational actions that support this project."
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <AiSettingsCard organizationId={bootstrap.organization?.id} projectId={bootstrap.project?.id} ai={settings.ai} canManage={canManageSettings} />
        <OAuthSettingsCard organizationId={bootstrap.organization?.id} oauth={settings.oauth} canManage={canManageSettings} />
      </div>

      {bootstrap.project ? (
        <ExtensionConnectionCard
          apiKey={extensionApiKey}
          apiBaseUrl={apiBaseUrl}
          extensionConnectedAt={
            typeof settings.projectSettings['extension.connectedAt'] === 'string'
              ? String(settings.projectSettings['extension.connectedAt'])
              : null
          }
        />
      ) : null}

      {bootstrap.project ? (
        <RuntimeOperationsCard
          organizationId={bootstrap.organization?.id}
          project={bootstrap.project}
          repositoryConnection={settings.repositoryConnection}
          projectSettings={settings.projectSettings}
          canManage={canManageSettings}
        />
      ) : null}
    </SettingsPageFrame>
  );
}
