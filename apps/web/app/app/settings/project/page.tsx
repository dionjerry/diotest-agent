import { EnvironmentSettingsCard, ProjectMetadataCard, ProjectDangerCard, ProjectProfileCard, RepositoryHealthCard } from '@/components/settings/settings-panels';
import { SettingsPageFrame } from '@/components/settings/settings-page-frame';
import { getEnvironmentSettings, getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

export default async function ProjectSettingsPage() {
  const { bootstrap } = await requireOnboardedUser();
  if (!bootstrap) return null;
  const canManageSettings = bootstrap.organization?.currentUserRole === 'owner' || bootstrap.organization?.currentUserRole === 'admin';
  const isOwner = bootstrap.organization?.currentUserRole === 'owner';

  const [settings, environment] = await Promise.all([
    getSettings({
      organizationId: bootstrap.organization?.id,
      projectId: bootstrap.project?.id,
    }),
    getEnvironmentSettings({
      organizationId: bootstrap.organization?.id,
      projectId: bootstrap.project?.id,
    }),
  ]);

  return (
    <SettingsPageFrame
      eyebrow="Settings / Project"
      title="Project Settings"
      description="Keep project identity, repository details, operational settings, and destructive controls aligned with the actual deployment state."
    >
      {bootstrap.project ? <ProjectProfileCard project={bootstrap.project} canManage={canManageSettings} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <RepositoryHealthCard connection={settings.repositoryConnection} />
        {bootstrap.project ? (
          <ProjectMetadataCard
            project={bootstrap.project}
            repositoryConnection={settings.repositoryConnection}
            projectSettings={settings.projectSettings}
          />
        ) : null}
      </div>

      <EnvironmentSettingsCard entries={environment.entries} />

      {bootstrap.project ? <ProjectDangerCard project={bootstrap.project} canManage={isOwner || canManageSettings} /> : null}
    </SettingsPageFrame>
  );
}
