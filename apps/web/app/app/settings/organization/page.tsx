import { OrganizationProfileCard, UserProfileCard } from '@/components/settings/settings-panels';
import { SettingsPageFrame } from '@/components/settings/settings-page-frame';
import { getOrganizationInvites, getOrganizationMembers } from '@/lib/api';
import { requireOnboardedUser } from '@/lib/guards';

export default async function OrganizationSettingsPage() {
  const { user, bootstrap } = await requireOnboardedUser();
  if (!bootstrap) return null;

  const [members, invites] = bootstrap.organization
    ? await Promise.all([
        getOrganizationMembers(bootstrap.organization.id).catch(() => ({ members: [] })),
        getOrganizationInvites(bootstrap.organization.id).catch(() => ({ invites: [] })),
      ])
    : [{ members: [] }, { invites: [] }];

  return (
    <SettingsPageFrame
      eyebrow="Settings / Organization"
      title="Organization Settings"
      description="Manage the people, ownership model, invitations, and workspace identity behind this DioTest organization."
    >
      <UserProfileCard user={user} />
      {bootstrap.organization ? (
        <OrganizationProfileCard
          organization={bootstrap.organization}
          members={members.members}
          invites={invites.invites}
          currentUserId={user.id}
        />
      ) : null}
    </SettingsPageFrame>
  );
}
