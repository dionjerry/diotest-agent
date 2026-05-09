import { IntegrationHealthCards, IntegrationSecretsCard } from '@/components/settings/settings-panels';
import { SettingsPageFrame } from '@/components/settings/settings-page-frame';
import { getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

export default async function IntegrationsSettingsPage() {
  const { bootstrap } = await requireOnboardedUser();
  if (!bootstrap) return null;
  const canManageSettings = bootstrap.organization?.currentUserRole === 'owner' || bootstrap.organization?.currentUserRole === 'admin';

  const settings = await getSettings({
    organizationId: bootstrap.organization?.id,
    projectId: bootstrap.project?.id,
  });

  return (
    <SettingsPageFrame
      eyebrow="Settings / Integrations"
      title="Active Integrations"
      description="Review readiness, repair incomplete connections, and manage the real credentials and configuration stored for each project integration."
    >
      {bootstrap.project ? <IntegrationHealthCards projectId={bootstrap.project.id} integrations={settings.integrations} /> : null}
      {bootstrap.project ? <IntegrationSecretsCard projectId={bootstrap.project.id} integrations={settings.integrations} canManage={canManageSettings} /> : null}
    </SettingsPageFrame>
  );
}
