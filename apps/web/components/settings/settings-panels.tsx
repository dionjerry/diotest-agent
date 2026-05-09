'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';

import type { ActionState } from '@/app/actions';
import {
  deleteProjectAction,
  revokeOrganizationInviteAction,
  queueBrowserChecksAction,
  saveAiSettingsAction,
  saveIntegrationConfigAction,
  saveIntegrationSecretAction,
  saveOAuthSettingsAction,
  saveOrganizationProfileAction,
  saveProjectProfileAction,
  saveUserProfileAction,
  inviteOrganizationMemberAction,
  removeOrganizationMemberAction,
  updateOrganizationMemberRoleAction,
  transferOrganizationOwnershipAction,
  deleteOrganizationAction,
} from '@/app/actions';
import type { EnvironmentSettingEntry, OrgMember, OrgInvite } from '@/lib/api';
import {
  IntegrationConfigFields,
  IntegrationSecretFields,
  type SupportedIntegrationType,
} from '@/components/integrations/provider-fields';
import { TestConnectionButton } from '@/components/integrations/test-connection-button';
import type { SettingsResponse } from '@/lib/api';
import { getIntegrationHealthPresentation, getRepositoryConnectionPresentation } from '@/lib/connection-status';
import { FormMessage } from '@/components/forms/form-message';
import { SettingsIcon } from '@/components/settings/settings-icons';
import { SubmitButton } from '@/components/forms/submit-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const initialState: ActionState = {};

function toneFromLabelTone(tone: 'neutral' | 'brand' | 'warn' | 'danger' | 'success') {
  return tone === 'neutral' ? 'neutral' : tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : tone === 'brand' ? 'brand' : 'success';
}

export function OAuthSettingsCard({
  organizationId,
  canManage = false,
  oauth,
}: {
  organizationId?: string;
  canManage?: boolean;
  oauth: SettingsResponse['oauth'];
}) {
  const [state, formAction] = useActionState(saveOAuthSettingsAction, initialState);

  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Auth provider config</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Google OAuth</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Deployment-wide Google sign-in settings. Stored encrypted in the database and used before env fallback.
          </p>
        </div>
        <Badge tone={oauth.enabled ? 'success' : 'warn'}>{oauth.enabled ? 'Enabled' : 'Disabled'}</Badge>
      </div>
      <form action={formAction} className="mt-6 space-y-5">
        {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
        <label className="flex items-center gap-3 rounded-lg border border-line bg-zinc-800/60/20 px-4 py-3 text-sm text-text">
          <input type="checkbox" name="enabled" defaultChecked={oauth.enabled} disabled={!canManage} className="h-4 w-4 accent-emerald-500" />
          Enable Google OAuth sign-in for this deployment
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Client ID</Label>
            <Input name="clientId" defaultValue={oauth.clientId} placeholder="Google OAuth client ID" disabled={!canManage} />
          </div>
          <div>
            <Label>Client secret</Label>
            <Input name="clientSecret" type="password" placeholder={oauth.clientSecretPreview ?? 'Paste a new secret'} disabled={!canManage} />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <Label>Authorization URL</Label>
            <Input name="authUrl" defaultValue={oauth.authUrl} placeholder="Optional custom auth URL" disabled={!canManage} />
          </div>
          <div>
            <Label>Token URL</Label>
            <Input name="tokenUrl" defaultValue={oauth.tokenUrl} placeholder="Optional custom token URL" disabled={!canManage} />
          </div>
          <div>
            <Label>User info URL</Label>
            <Input name="userInfoUrl" defaultValue={oauth.userInfoUrl} placeholder="Optional custom user info URL" disabled={!canManage} />
          </div>
        </div>
        <FormMessage tone="muted">
          `NEXTAUTH_SECRET` stays env-only. This form only controls the provider credentials and endpoints.
        </FormMessage>
        {!canManage ? <FormMessage tone="muted">Read-only for members. Owners and admins can update runtime auth settings.</FormMessage> : null}
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        {canManage ? <SubmitButton idleLabel="Save OAuth config" pendingLabel="Saving OAuth config..." /> : null}
      </form>
    </div>
  );
}

export function UserProfileCard({
  user,
}: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}) {
  const [state, formAction] = useActionState(saveUserProfileAction, initialState);

  return (
    <div className="settings-card p-6">
      <div>
        <div className="settings-kicker">User profile</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Account identity</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Manage the signed-in identity shown across the DioTest workspace. Email remains read-only in this version.
        </p>
      </div>
      <form action={formAction} className="mt-6 space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Display name</Label>
            <Input name="name" defaultValue={user.name ?? ''} placeholder="Your name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email ?? ''} readOnly disabled className="cursor-not-allowed opacity-80" />
          </div>
        </div>
        <FormMessage tone="muted">
          Need to rotate credentials? Use the password reset flow from the sign-in screens.
        </FormMessage>
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        <SubmitButton idleLabel="Save user profile" pendingLabel="Saving user profile..." />
      </form>
    </div>
  );
}

function getRoleBadgeTone(role: string): 'neutral' | 'brand' | 'warn' | 'danger' | 'success' {
  if (role === 'owner') return 'brand';
  if (role === 'admin') return 'warn';
  return 'neutral';
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Not recorded';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function iconForEnvironmentEntry(entry: EnvironmentSettingEntry) {
  if (entry.isSecret) return 'lock';
  if (entry.scope === 'repository') return entry.key.includes('BRANCH') ? 'branch' : 'code';
  if (entry.scope === 'integration') return 'chat';
  if (entry.scope === 'project') return 'server';
  if (entry.scope === 'organization') return 'organization';
  if (entry.displayType === 'status') return 'status';
  return 'globe';
}

export function OrganizationProfileCard({
  organization,
  members = [],
  invites = [],
  currentUserId = '',
}: {
  organization: {
    id: string;
    name: string;
    slug: string;
    currentUserRole?: string;
    memberCount?: number;
    projectCount?: number;
  };
  currentUserId?: string;
  members?: OrgMember[];
  invites?: OrgInvite[];
}) {
  const [saveState, saveAction] = useActionState(saveOrganizationProfileAction, initialState);
  const [inviteState, inviteAction] = useActionState(inviteOrganizationMemberAction, initialState);
  const [revokeInviteState, revokeInviteAction] = useActionState(revokeOrganizationInviteAction, initialState);
  const [removeState, removeAction] = useActionState(removeOrganizationMemberAction, initialState);
  const [roleState, roleAction] = useActionState(updateOrganizationMemberRoleAction, initialState);
  const [transferState, transferAction] = useActionState(transferOrganizationOwnershipAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteOrganizationAction, initialState);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const isOwner = organization.currentUserRole === 'owner';
  const canManageOrg = isOwner || organization.currentUserRole === 'admin';
  const canInvite = canManageOrg;
  const ownerCount = members.filter((member) => member.role === 'owner').length;

  return (
    <div className="settings-card space-y-0 overflow-hidden">
      <div className="border-b border-line p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="settings-kicker">Organization profile</div>
            <h2 className="mt-3 text-xl font-semibold text-text">Workspace organization</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Control the canonical organization name and slug used throughout onboarding, settings, and repository callback flows.
            </p>
          </div>
          <Badge tone={getRoleBadgeTone(organization.currentUserRole ?? 'member')}>{organization.currentUserRole ?? 'member'}</Badge>
        </div>
        <form action={saveAction} className="mt-6 space-y-5">
          <input type="hidden" name="organizationId" value={organization.id} />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label>Organization name</Label>
              <Input name="name" defaultValue={organization.name} placeholder="DioTest Labs" disabled={!canManageOrg} />
            </div>
            <div>
              <Label>Organization slug</Label>
              <Input name="slug" defaultValue={organization.slug} placeholder="diotest-labs" disabled={!canManageOrg} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-soft">
            <Badge tone="neutral">{organization.memberCount ?? 0} members</Badge>
            <Badge tone="neutral">{organization.projectCount ?? 0} projects</Badge>
          </div>
          {!canManageOrg ? <FormMessage tone="muted">Read-only for members. Owners and admins can update organization details.</FormMessage> : null}
          <FormMessage tone="success">{saveState.success}</FormMessage>
          <FormMessage>{saveState.error}</FormMessage>
          {canManageOrg ? <SubmitButton idleLabel="Save organization profile" pendingLabel="Saving organization..." /> : null}
        </form>
      </div>

      {/* Team Members Section */}
      <div className="border-b border-line p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="settings-kicker text-soft">Team members</h3>
          {canInvite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              {showInviteForm ? 'Cancel' : 'Invite member'}
            </Button>
          )}
        </div>

        {canInvite ? (
          <div
            aria-hidden={!showInviteForm}
            className={`grid overflow-hidden transition-all duration-300 ease-out ${
              showInviteForm ? 'mb-6 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0">
              <form action={inviteAction} className="space-y-5 rounded-lg border border-line bg-zinc-800/60/20 p-6">
                <input type="hidden" name="organizationId" value={organization.id} />
                <div>
                  <label className="block text-sm font-medium text-text">Email address</label>
                  <Input name="email" type="email" placeholder="user@example.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text">Role</label>
                  <select
                    name="role"
                    defaultValue="member"
                    className="h-11 w-full rounded-md border border-line bg-zinc-800/60 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {isOwner ? <option value="owner">Owner</option> : null}
                  </select>
                </div>
                <FormMessage tone="muted">
                  {isOwner
                    ? 'Owners can invite members, admins, or another owner.'
                    : 'Admins can invite members and admins only.'}
                </FormMessage>
                <FormMessage tone="success">{inviteState.success}</FormMessage>
                <FormMessage>{inviteState.error}</FormMessage>
                <SubmitButton idleLabel="Send invitation" pendingLabel="Sending..." />
              </form>
            </div>
          </div>
        ) : null}

        {/* Members List */}
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-zinc-800/60/20 px-4 py-6 text-center text-sm text-muted">
              No members yet
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-zinc-800/60/20 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {getInitials(member.user.name, member.user.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text">{member.user.name || 'Unnamed user'}</div>
                    <div className="text-xs text-muted truncate">{member.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOwner ? (
                    <div className="flex items-center gap-2">
                      <form
                        action={roleAction}
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          const formData = new FormData(e.currentTarget);
                          const entries = Object.fromEntries(formData);
                          if (entries.role === member.role) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="memberId" value={member.id} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          disabled={ownerCount === 1 && member.role === 'owner'}
                          className="h-9 rounded-lg border border-line bg-zinc-800/60 px-3 text-xs text-text outline-none focus:border-brand/70 focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                        <SubmitButton
                          idleLabel="Update"
                          pendingLabel="Saving..."
                          className="h-9 bg-zinc-800/60 px-3 text-xs font-semibold text-text hover:bg-zinc-700"
                        />
                      </form>
                      <div className="flex items-center gap-2">
                        <Badge tone={getRoleBadgeTone(member.role)}>{member.role}</Badge>
                        {member.userId === currentUserId ? <Badge tone="neutral">You</Badge> : null}
                      </div>
                      <form action={removeAction} className="contents">
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="memberId" value={member.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={ownerCount === 1 && member.role === 'owner'}
                          className="text-danger hover:bg-danger/10"
                        >
                          Remove
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge tone={getRoleBadgeTone(member.role)}>{member.role}</Badge>
                      {member.userId === currentUserId ? <Badge tone="neutral">You</Badge> : null}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <FormMessage tone="success">{roleState.success || removeState.success}</FormMessage>
        <FormMessage>{roleState.error || removeState.error}</FormMessage>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-line pt-6">
            <h4 className="settings-kicker text-soft">Pending invitations</h4>
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-zinc-800/60/20 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800/60/30 text-xs font-semibold text-soft">
                    {invite.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text">{invite.email}</div>
                    <div className="text-xs text-muted">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={getRoleBadgeTone(invite.role)}>{invite.role}</Badge>
                  {canInvite ? (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                      >
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            <FormMessage tone="success">{revokeInviteState.success}</FormMessage>
            <FormMessage>{revokeInviteState.error}</FormMessage>
          </div>
        )}
      </div>

      {/* Transfer Ownership Section - Owner only */}
      {isOwner && (
        <div className="border-b border-line p-6">
          <h3 className="settings-kicker mb-6 text-soft">Transfer ownership</h3>
          <form action={transferAction} className="space-y-5">
            <input type="hidden" name="organizationId" value={organization.id} />
            <div>
              <label className="block text-sm font-medium text-text">Select new owner</label>
              <select
                name="newOwnerUserId"
                className="mt-2 h-11 w-full rounded-md border border-line bg-zinc-800/60 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
                required
              >
                <option value="">Choose a member...</option>
                {members
                  .filter((m) => m.userId !== currentUserId)
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.name || member.user.email}
                    </option>
                  ))}
              </select>
            </div>
            <FormMessage tone="muted">
              You will become a regular member after transferring ownership.
            </FormMessage>
            <FormMessage tone="success">{transferState.success}</FormMessage>
            <FormMessage>{transferState.error}</FormMessage>
            <SubmitButton idleLabel="Transfer ownership" pendingLabel="Transferring..." />
          </form>
        </div>
      )}

      {/* Danger Zone - Owner only */}
      {isOwner && (
        <div className="border-t border-danger/30 bg-danger/5 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-danger">Danger zone</h3>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Permanently delete this organization. This action cannot be undone. All projects, integrations, and data will be lost.
            </p>
            {members.length === 1 ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text">
                    To confirm deletion, type the organization slug: <strong className="text-text">{organization.slug}</strong>
                  </label>
                  <Input
                    placeholder={organization.slug}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                </div>
                <form action={deleteAction} className="space-y-5">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="confirmation" value={deleteConfirmation} />
                  {deleteConfirmation && deleteConfirmation !== organization.slug && (
                    <FormMessage>Slug does not match</FormMessage>
                  )}
                  <FormMessage tone="success">{deleteState.success}</FormMessage>
                  <FormMessage>{deleteState.error}</FormMessage>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={deleteConfirmation !== organization.slug}
                  >
                    Delete organization
                  </Button>
                </form>
              </div>
            ) : (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-4">
                <p className="text-sm text-danger">
                  Organization must have only one member to delete. Remove other members first.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectProfileCard({
  project,
  canManage = false,
}: {
  project: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
  };
  canManage?: boolean;
}) {
  const [state, formAction] = useActionState(saveProjectProfileAction, initialState);

  return (
    <div className="settings-card p-6">
      <div>
        <div className="settings-kicker">Project profile</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Current project</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Keep the project name, slug, and description accurate so onboarding, repositories, and extension flows stay in sync.
        </p>
      </div>
      <form action={formAction} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={project.id} />
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Project name</Label>
            <Input name="name" defaultValue={project.name} placeholder="Alpha Core" disabled={!canManage} />
          </div>
          <div>
            <Label>Project slug</Label>
            <Input name="slug" defaultValue={project.slug} placeholder="alpha-core" disabled={!canManage} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea name="description" defaultValue={project.description ?? ''} placeholder="Short internal description for this project." className="min-h-24" disabled={!canManage} />
        </div>
        {!canManage ? <FormMessage tone="muted">Read-only for members. Owners and admins can update project identity.</FormMessage> : null}
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        {canManage ? <SubmitButton idleLabel="Save project profile" pendingLabel="Saving project..." /> : null}
      </form>
    </div>
  );
}

export function AiSettingsCard({
  organizationId,
  projectId,
  canManage = false,
  ai,
}: {
  organizationId?: string;
  projectId?: string;
  canManage?: boolean;
  ai: SettingsResponse['ai'];
}) {
  const [state, formAction] = useActionState(saveAiSettingsAction, initialState);

  return (
    <div className="settings-card p-6">
      <div>
        <div className="settings-kicker">AI provider config</div>
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
              disabled={!canManage}
              className="h-11 w-full rounded-md border border-line bg-zinc-800/60 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div>
            <Label>Model</Label>
            <Input name="model" defaultValue={ai.model} placeholder="gpt-4.1-mini or openrouter/free" disabled={!canManage} />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>OpenAI API key</Label>
            <Input name="openaiApiKey" type="password" placeholder={ai.openaiApiKeyPreview ?? 'Stored encrypted if provided'} disabled={!canManage} />
          </div>
          <div>
            <Label>OpenRouter API key</Label>
            <Input name="openrouterApiKey" type="password" placeholder={ai.openrouterApiKeyPreview ?? 'Stored encrypted if provided'} disabled={!canManage} />
          </div>
        </div>
        {!canManage ? <FormMessage tone="muted">Read-only for members. Owners and admins can update AI runtime settings.</FormMessage> : null}
        <FormMessage tone="success">{state.success}</FormMessage>
        <FormMessage>{state.error}</FormMessage>
        {canManage ? <SubmitButton idleLabel="Save AI settings" pendingLabel="Saving AI settings..." /> : null}
      </form>
    </div>
  );
}

export function IntegrationSecretsCard({
  projectId,
  canManage = false,
  integrations,
}: {
  projectId: string;
  canManage?: boolean;
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
    <div className="settings-card p-6">
      <div>
        <div className="settings-kicker">Integration secrets</div>
        <h2 className="mt-3 text-xl font-semibold text-text">Credential storage</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Integration labels and metadata stay in structured settings. Tokens and credentials are stored encrypted per project.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {integrations.length > 0 ? (
          integrations.map((integration) => (
            <div key={integration.id} className="settings-card-muted p-4">
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
                    {integration.health.isConfigured && canManage ? (
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
          <div className="rounded-lg border border-dashed border-line bg-zinc-800/60/20 px-4 py-6 text-sm text-muted">
            No project integrations are connected yet.
          </div>
        )}
      </div>
      <div className="mt-6">
        <Label>Integration</Label>
        <select
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as SupportedIntegrationType)}
          disabled={!canManage}
          className="mt-2 h-11 w-full max-w-sm rounded-md border border-line bg-zinc-800/60 px-4 text-sm text-text outline-none focus:border-brand/70 focus:ring-4 focus:ring-brand/10"
        >
          <option value="JIRA">Jira</option>
          <option value="TRELLO">Trello</option>
          <option value="GOOGLE_SHEETS">Google Sheets</option>
        </select>
      </div>

      <form key={`${selectedType}-config`} action={configAction} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="type" value={selectedType} />
        <fieldset disabled={!canManage}>
          <div className="grid gap-5 md:grid-cols-3">
            <IntegrationConfigFields type={selectedType} config={configJson} />
          </div>
        </fieldset>
        {!canManage ? <FormMessage tone="muted">Read-only for members. Owners and admins can update integration configuration.</FormMessage> : null}
        <FormMessage tone="success">{configState.success}</FormMessage>
        <FormMessage>{configState.error}</FormMessage>
        {canManage ? <SubmitButton idleLabel="Save integration config" pendingLabel="Saving config..." /> : null}
      </form>

      <form key={`${selectedType}-secret`} action={secretAction} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="type" value={selectedType} />
        <fieldset disabled={!canManage}>
          <div className="grid gap-5 md:grid-cols-3">
            <IntegrationSecretFields
              type={selectedType}
              hasStoredSecret={selectedIntegration?.hasStoredSecret}
              secretPreview={selectedIntegration?.secretPreview}
            />
          </div>
        </fieldset>
        {!canManage ? <FormMessage tone="muted">Read-only for members. Owners and admins can update encrypted integration credentials.</FormMessage> : null}
        <FormMessage tone="success">{secretState.success}</FormMessage>
        <FormMessage>{secretState.error}</FormMessage>
        {canManage ? <SubmitButton idleLabel="Save integration credentials" pendingLabel="Saving credentials..." /> : null}
      </form>
    </div>
  );
}

export function RepositoryHealthCard({
  connection,
}: {
  connection: SettingsResponse['repositoryConnection'];
}) {
  const status = getRepositoryConnectionPresentation(connection);

  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Connection health</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Repository connection</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{status.summary}</p>
        </div>
        <Badge tone={toneFromLabelTone(status.tone)}>{status.label}</Badge>
      </div>

      <div className="mt-6 settings-card-muted p-4">
        <div className="text-sm font-medium text-text">
          {connection ? connection.fullName : 'No repository connected'}
        </div>
        <div className="mt-2 text-sm leading-6 text-soft">
          {connection
            ? `${connection.provider === 'GITHUB' ? 'GitHub' : 'GitLab'} • baseline branch ${connection.defaultBranch}`
            : 'Connect GitHub or GitLab in onboarding to enable repository-aware workflows and webhook health tracking.'}
        </div>
        {status.recovery ? <div className="mt-3 text-sm leading-6 text-muted">{status.recovery}</div> : null}
        {connection?.webhookLastError ? (
          <details className="mt-4 rounded-md border border-line bg-zinc-800/60/50 px-4 py-3 text-sm text-soft">
            <summary className="cursor-pointer font-medium text-text">Advanced webhook detail</summary>
            <div className="mt-2 leading-6">{connection.webhookLastError}</div>
          </details>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/onboarding?stage=repository" className="inline-flex items-center justify-center gap-2 rounded-md h-9 px-3 text-sm font-medium border border-line bg-zinc-800/60/50 text-text hover:border-lineStrong hover:bg-zinc-800/60/90 transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lineStrong/40">
            {connection ? 'Repair repository connection' : 'Connect repository'}
          </Link>
          <Link href="/docs/concepts/repository-onboarding" className="inline-flex items-center justify-center gap-2 rounded-md h-9 px-3 text-sm font-medium text-text hover:bg-zinc-800/60/70 transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lineStrong/30">
            Review repository concepts
          </Link>
        </div>
      </div>
    </div>
  );
}

export function IntegrationHealthCards({
  projectId,
  integrations,
}: {
  projectId: string;
  integrations: SettingsResponse['integrations'];
}) {
  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Connection health</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Project integrations</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Review which integrations are fully ready, which still need credentials, and where to repair them.
          </p>
        </div>
        <Badge tone="brand">{integrations.length} linked</Badge>
      </div>
      <div className="mt-6 space-y-3">
        {integrations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-zinc-800/60/20 px-4 py-6 text-sm text-muted">
            No project integrations are connected yet.
          </div>
        ) : (
          integrations.map((integration) => {
            const status = getIntegrationHealthPresentation(integration);
            return (
              <div key={integration.id} className="settings-card-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-text">{integration.type}</div>
                    <div className="mt-1 text-sm leading-6 text-soft">{status.summary}</div>
                    {status.recovery ? <div className="mt-2 text-sm leading-6 text-muted">{status.recovery}</div> : null}
                    {integration.secretPreview.length > 0 ? (
                      <div className="mt-2 text-xs text-soft">{integration.secretPreview.join(' · ')}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={toneFromLabelTone(status.tone)}>{status.label}</Badge>
                    {integration.health.isConfigured ? (
                      <TestConnectionButton projectId={projectId} type={integration.type as SupportedIntegrationType} />
                    ) : null}
                    <Link href="/onboarding?stage=integrations" className="inline-flex items-center justify-center gap-2 rounded-md h-9 px-3 text-sm font-medium border border-line bg-zinc-800/60/50 text-text hover:border-lineStrong hover:bg-zinc-800/60/90 transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lineStrong/40">
                      Repair integration
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ProjectMetadataCard({
  project,
  repositoryConnection,
  projectSettings,
}: {
  project: {
    id: string;
    slug: string;
    name: string;
  };
  repositoryConnection: SettingsResponse['repositoryConnection'];
  projectSettings: SettingsResponse['projectSettings'];
}) {
  const extensionConnectedAt = typeof projectSettings['extension.connectedAt'] === 'string'
    ? String(projectSettings['extension.connectedAt'])
    : null;
  const onboardingProgress = projectSettings['onboarding_progress']
    ? JSON.stringify(projectSettings['onboarding_progress'])
    : null;
  const onboardingComplete = projectSettings['onboarding_complete']
    ? JSON.stringify(projectSettings['onboarding_complete'])
    : null;

  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Project metadata</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Operational status</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Inspect the project identifiers and the saved onboarding and extension metadata that affect repository-aware flows.
          </p>
        </div>
        <Badge tone="neutral">Read-only</Badge>
      </div>

      <div className="mt-6 settings-card-muted p-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-soft">Project ID</div>
            <div className="mt-1 break-all text-text">{project.id}</div>
          </div>
          <div>
            <div className="text-soft">Project slug</div>
            <div className="mt-1 text-text">{project.slug}</div>
          </div>
          <div>
            <div className="text-soft">Extension verification</div>
            <div className="mt-1 text-text">{extensionConnectedAt ?? 'Not verified yet'}</div>
          </div>
          <div>
            <div className="text-soft">Repository webhook</div>
            <div className="mt-1 text-text">{repositoryConnection?.webhookStatus ?? 'No repository connected'}</div>
          </div>
        </div>
        {onboardingProgress ? (
          <details className="mt-4 rounded-md border border-line bg-zinc-800/60/50 px-4 py-3 text-sm text-soft">
            <summary className="cursor-pointer font-medium text-text">Onboarding progress metadata</summary>
            <div className="mt-2 break-all leading-6">{onboardingProgress}</div>
          </details>
        ) : null}
        {onboardingComplete ? (
          <details className="mt-4 rounded-md border border-line bg-zinc-800/60/50 px-4 py-3 text-sm text-soft">
            <summary className="cursor-pointer font-medium text-text">Onboarding completion metadata</summary>
            <div className="mt-2 break-all leading-6">{onboardingComplete}</div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function EnvironmentSettingsCard({
  entries,
}: {
  entries: EnvironmentSettingEntry[];
}) {
  return (
    <div className="settings-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="settings-kicker">Environment variables</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Operational settings surface</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Real persisted runtime, repository, integration, and project settings that are safe to inspect from the settings UI. Secrets stay masked.
          </p>
        </div>
        <Button variant="secondary" size="sm" className="h-9 rounded-md px-3 text-xs" disabled>
          Read-only surface
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-zinc-800/60/20 px-4 py-6 text-sm text-muted">
          No persisted operational settings are available for this project yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-white/5 bg-[#1a1c21]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-soft">Key</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-soft">Value</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-soft">Scope</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-soft">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={`${entry.scope}-${entry.key}`} className="settings-table-row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-soft">
                        <SettingsIcon name={iconForEnvironmentEntry(entry)} className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-mono text-[0.95rem] text-text">{entry.key}</div>
                        <div className="mt-1 text-xs text-soft">{entry.source}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-soft">{entry.valuePreview}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={entry.isEditable ? 'brand' : 'neutral'}>{entry.scope}</Badge>
                      {entry.isEditable ? <Badge tone="success">editable</Badge> : <Badge tone="neutral">read-only</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-soft">{formatUpdatedAt(entry.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProjectDangerCard({
  project,
  canManage = false,
}: {
  project: {
    id: string;
    slug: string;
    name: string;
  };
  canManage?: boolean;
}) {
  const [deleteState, deleteAction] = useActionState(deleteProjectAction, initialState);

  if (!canManage) {
    return null;
  }

  return (
    <div className="settings-card p-6">
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
        <div className="text-sm font-medium text-rose-100">Danger zone</div>
        <div className="mt-2 text-sm leading-6 text-rose-200/80">
          Deleting this project removes repository connections, integration settings, secrets, actions, and task history for this project.
        </div>
        <form action={deleteAction} className="mt-4 space-y-4">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <Label>Type <span className="font-semibold text-white">{project.slug}</span> to confirm</Label>
            <Input name="confirmation" placeholder={project.slug} />
          </div>
          <FormMessage>{deleteState.error}</FormMessage>
          <SubmitButton idleLabel="Delete project" pendingLabel="Deleting..." className="h-10 rounded-md bg-danger text-white hover:bg-red-400" />
        </form>
      </div>
    </div>
  );
}

export function RuntimeOperationsCard({
  organizationId,
  project,
  repositoryConnection,
  projectSettings,
  canManage = false,
}: {
  organizationId?: string;
  project: {
    id: string;
    slug: string;
    name: string;
  };
  repositoryConnection: SettingsResponse['repositoryConnection'];
  projectSettings: SettingsResponse['projectSettings'];
  canManage?: boolean;
}) {
  const [queueState, queueAction] = useActionState(queueBrowserChecksAction, initialState);
  const exportHref = `/api/settings/export?${new URLSearchParams({
    ...(organizationId ? { organizationId } : {}),
    projectId: project.id,
  }).toString()}`;

  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Advanced</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Runtime operations</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Export current settings, queue a real browser-check action, and inspect useful runtime metadata without mixing in destructive project controls.
          </p>
        </div>
        <Badge tone="warn">Handle with care</Badge>
      </div>

      <div className="mt-6 settings-card-muted p-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-soft">Project</div>
            <div className="mt-1 text-text">{project.name}</div>
          </div>
          <div>
            <div className="text-soft">Project slug</div>
            <div className="mt-1 text-text">{project.slug}</div>
          </div>
          <div>
            <div className="text-soft">Repository webhook</div>
            <div className="mt-1 text-text">{repositoryConnection?.webhookStatus ?? 'No repository connected'}</div>
          </div>
          <div>
            <div className="text-soft">Export scope</div>
            <div className="mt-1 text-text">{organizationId ? 'Organization + project settings' : 'Project settings only'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 settings-card-muted p-4">
        <div className="text-sm font-medium text-text">Operational actions</div>
        <div className="mt-2 text-sm leading-6 text-muted">
          Export a sanitized settings snapshot or queue a real browser-check action for this project.
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={exportHref} className="inline-flex items-center justify-center gap-2 rounded-md h-9 px-3 text-sm font-medium text-text hover:bg-zinc-800/60/70 transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lineStrong/30">
            Export settings JSON
          </Link>
          {canManage ? (
            <form action={queueAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <SubmitButton idleLabel="Queue browser checks" pendingLabel="Queueing..." className="h-10 rounded-md" />
            </form>
          ) : null}
        </div>
        {!canManage ? <FormMessage tone="muted">Members can export settings, but only owners and admins can trigger runtime operations.</FormMessage> : null}
        <FormMessage tone="success">{queueState.success}</FormMessage>
        <FormMessage>{queueState.error}</FormMessage>
      </div>
    </div>
  );
}

export function AdvancedSettingsCard(props: Parameters<typeof RuntimeOperationsCard>[0]) {
  return <RuntimeOperationsCard {...props} />;
}
