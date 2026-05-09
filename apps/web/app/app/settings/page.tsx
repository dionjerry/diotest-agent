import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { SettingsPageFrame } from '@/components/settings/settings-page-frame';
import { SettingsCardLink, SettingsOverviewStrip } from '@/components/settings/settings-route-panels';
import { getOrganizationInvites, getSettings } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

export default async function SettingsOverviewPage() {
  const { bootstrap } = await requireOnboardedUser();

  const settings = await getSettings({
    organizationId: bootstrap?.organization?.id,
    projectId: bootstrap?.project?.id,
  });

  const invites = bootstrap?.organization
    ? await getOrganizationInvites(bootstrap.organization.id).catch(() => ({ invites: [] }))
    : { invites: [] };

  const extensionConnectedAt = typeof settings.projectSettings['extension.connectedAt'] === 'string'
    ? String(settings.projectSettings['extension.connectedAt'])
    : null;
  const connectedCount = settings.integrations.filter((integration) => integration.health.isConfigured).length;

  return (
    <SettingsPageFrame
      eyebrow="Settings / General"
      title="Project Settings"
      description="Manage your agent workflows, connected platforms, runtime preferences, and secure operational settings from one consistent settings surface."
      actions={
        bootstrap?.project ? (
          <>
            <Link href={`/api/settings/export?projectId=${bootstrap.project.id}${bootstrap.organization?.id ? `&organizationId=${bootstrap.organization.id}` : ''}`} className="inline-flex h-12 items-center rounded-md border border-white/10 bg-[#16171b] px-5 text-sm font-medium text-zinc-200 transition-all duration-150 hover:bg-[#1d1f24] active:scale-95">
              Export Settings
            </Link>
            <Link href="/app/settings/project" className="inline-flex h-12 items-center rounded-md bg-[#53dca4] px-5 text-sm font-bold text-[#053524] transition-all duration-150 hover:opacity-90 active:scale-95">
              Review Project
            </Link>
          </>
        ) : null
      }
    >
      <SettingsOverviewStrip
        organizationName={bootstrap?.organization?.name ?? 'Not configured'}
        organizationMeta={`${bootstrap?.organization?.memberCount ?? 0} members`}
        projectName={bootstrap?.project?.name ?? 'Not configured'}
        projectMeta={bootstrap?.project?.slug ?? 'No active project'}
        repositoryName={settings.repositoryConnection?.fullName ?? 'No repository connected'}
        repositoryMeta={settings.repositoryConnection?.webhookStatus ?? 'Pending'}
        integrationsValue={`${connectedCount}/${settings.integrations.length}`}
        integrationsMeta={invites.invites.length > 0 ? `${invites.invites.length} pending invites` : 'No pending invites'}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="settings-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={settings.repositoryConnection ? 'success' : 'warn'}>
              {settings.repositoryConnection ? 'Repository connected' : 'Repository pending'}
            </Badge>
            <Badge tone={connectedCount === settings.integrations.length && settings.integrations.length > 0 ? 'success' : 'warn'}>
              {connectedCount} ready integration{connectedCount === 1 ? '' : 's'}
            </Badge>
            <Badge tone={extensionConnectedAt ? 'success' : 'warn'}>
              {extensionConnectedAt ? 'Extension verified' : 'Extension pending'}
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="settings-card-muted p-4">
              <div className="text-sm font-semibold text-zinc-50">Extension verification</div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">{extensionConnectedAt ?? 'The browser extension has not been verified for this project yet.'}</div>
            </div>
            <div className="settings-card-muted p-4">
              <div className="text-sm font-semibold text-zinc-50">Webhook health</div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                {settings.repositoryConnection?.webhookLastError ?? settings.repositoryConnection?.webhookStatus ?? 'No repository webhook is configured yet.'}
              </div>
            </div>
          </div>
        </div>
        <div className="settings-card p-5">
          <div className="settings-kicker">Current scope</div>
          <div className="mt-3 text-lg font-semibold text-white">{bootstrap?.organization?.name ?? 'Organization pending'}</div>
          <div className="mt-1 text-sm text-zinc-400">{bootstrap?.project?.name ?? 'Project pending'}</div>
          <div className="mt-4 space-y-2 text-sm text-zinc-400">
            <div>Role: <span className="text-zinc-100">{bootstrap?.organization?.currentUserRole ?? 'member'}</span></div>
            <div>Runtime: <span className="text-zinc-100">{settings.ai.preferredProvider} / {settings.ai.model}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCardLink href="/app/settings/organization" title="Organization" body="Manage workspace identity, members, invites, roles, ownership transfer, and deletion controls." />
        <SettingsCardLink href="/app/settings/project" title="Project" body="Review project identity, repository health, extension status, curated environment settings, and project danger controls." />
        <SettingsCardLink href="/app/settings/integrations" title="Integrations" body="Inspect connected providers, manage credentials, and repair incomplete integration setups." />
        <SettingsCardLink href="/app/settings/runtime" title="Runtime" body="Update AI provider preferences, OAuth configuration, exports, and operational actions." />
      </div>
    </SettingsPageFrame>
  );
}
