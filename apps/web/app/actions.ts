'use server';

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  AppApiError,
  approveAgentAction,
  createAgentAction,
  createOrganization,
  createProject,
  deleteProject,
  revokeOrganizationInvite,
  updateOrganizationProfile,
  updateProjectProfile,
  updateUserProfile,
  saveRepositoryConnection,
  saveRepositorySecret,
  saveAiSettings,
  testHostedRuntime,
  saveIntegration,
  saveIntegrationSecret,
  saveOAuthSettings,
  saveSystemSetting,
  inviteOrganizationMember,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  transferOrganizationOwnership,
  deleteOrganization,
  createAgentThread,
  runHostedAgentExecution,
  sendAgentThreadMessage,
} from '@/lib/api';
import { auth, signIn, signOut } from '@/lib/auth';
import { getPersistedIntegrationState, getIntegrationName, persistIntegrationConnection, type IntegrationType } from '@/lib/integration-connections';
import { isSmtpConfigured, sendPasswordResetEmail, sendOrganizationInviteEmail } from '@/lib/mailer';
import {
  mergeStageProgress,
  mergeOnboardingProgress,
  ONBOARDING_COMPLETE_KEY,
  ONBOARDING_PROGRESS_KEY,
  parseOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStage,
} from '@/lib/onboarding-state';
import { prisma } from '@/lib/prisma';
import { reconcileGitHubWebhook, reconcileGitLabWebhook, type RepositoryProvider } from '@/lib/repository-provider-api';
import { decodeCookieValue, REPOSITORY_FLOW_COOKIES, type GitHubInstallationCookie, type GitLabOAuthCookie } from '@/lib/repository-flow';
import { logServerError, logServerEvent } from '@/lib/server-logger';
import { absoluteUrl, slugify } from '@/lib/utils';
import { decryptPayload } from '@/lib/encryption';

export type ActionState = {
  error?: string;
  success?: string;
  threadId?: string;
  resultJson?: string;
};

function revalidateAppData() {
  revalidatePath('/onboarding');
  revalidatePath('/app');
  revalidatePath('/app/projects');
  revalidatePath('/app/settings');
  revalidatePath('/studio');
  revalidatePath('/studio', 'layout');
  revalidatePath('/studio/runs');
}

function settingsCacheTag(organizationId?: string, projectId?: string) {
  return `settings:${organizationId ?? 'system'}:${projectId ?? 'none'}`;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

async function requireOwnedOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: {
      id: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return membership;
}

async function requireOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return project;
}

function canManageOrganizationSettings(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

async function getProjectOnboardingProgress(projectId: string) {
  const setting = await prisma.systemSetting.findFirst({
    where: {
      scope: 'PROJECT',
      projectId,
      key: ONBOARDING_PROGRESS_KEY,
    },
    select: {
      value: true,
    },
  });

  return parseOnboardingProgress(setting?.value);
}

async function persistProjectOnboardingProgress(projectId: string, patch: Partial<OnboardingProgress>) {
  const current = await getProjectOnboardingProgress(projectId);
  const next = mergeOnboardingProgress(current, {
    ...patch,
    lastVisitedStage: mergeStageProgress(current?.lastVisitedStage, patch.lastVisitedStage),
  });

  await saveSystemSetting({
    scope: 'PROJECT',
    projectId,
    key: ONBOARDING_PROGRESS_KEY,
    value: next,
  });
}

async function setProjectOnboardingStage(projectId: string, stage: OnboardingStage) {
  await persistProjectOnboardingProgress(projectId, { lastVisitedStage: stage });
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const next = readString(formData, 'next') || '/app';

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: next,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      logServerError('auth.login.failed', 'auth_error', { status: 'failed' });
      return { error: 'Invalid email or password.' };
    }
    logServerError('auth.login.failed', 'internal_error', { status: 'failed' }, error);
    throw error;
  }
}

export async function signupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = readString(formData, 'name');
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');
  const next = readString(formData, 'next') || '/onboarding';

  if (!name || !email || !password) {
    logServerError('auth.signup.failed', 'validation_error', { status: 'failed' });
    return { error: 'Name, email, and password are required.' };
  }

  if (password.length < 8) {
    logServerError('auth.signup.failed', 'validation_error', { status: 'failed' });
    return { error: 'Password must be at least 8 characters.' };
  }

  if (!confirmPassword) {
    logServerError('auth.signup.failed', 'validation_error', { status: 'failed' });
    return { error: 'Please confirm your password.' };
  }

  if (password !== confirmPassword) {
    logServerError('auth.signup.failed', 'validation_error', { status: 'failed' });
    return { error: 'Passwords do not match.' };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logServerError('auth.signup.failed', 'validation_error', { status: 'failed', userId: existing.id });
    return { error: 'An account already exists for that email.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  const createdUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  logServerEvent('auth.signup.completed', {
    status: 'success',
    userId: createdUser?.id,
  });
  revalidateAppData();

  await signIn('credentials', {
    email,
    password,
    redirectTo: next,
  });

  return {};
}

export async function requestPasswordResetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = readString(formData, 'email').toLowerCase();
  if (!email) {
    logServerError('password_reset.request.failed', 'validation_error', { status: 'failed' });
    return { error: 'Enter the email for the account you want to reset.' };
  }

  if (!isSmtpConfigured()) {
    logServerError('password_reset.request.failed', 'provider_error', { status: 'failed' });
    return { error: 'Password reset email is unavailable right now. Configure SMTP and try again.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logServerEvent('password_reset.requested', { status: 'success' });
    return { success: 'If that account exists, a password reset email has been sent.' };
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      token: tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    },
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: absoluteUrl(`/reset-password/${token}`),
    });
  } catch {
    logServerError('password_reset.request.failed', 'provider_error', { status: 'failed', userId: user.id });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    return { error: 'Password reset email could not be delivered right now. Try again later.' };
  }

  logServerEvent('password_reset.requested', {
    status: 'success',
    userId: user.id,
  });

  return {
    success: 'If that account exists, a password reset email has been sent.',
  };
}

export async function resetPasswordAction(token: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');

  if (!email) {
    logServerError('password_reset.complete.failed', 'validation_error', { status: 'failed' });
    return { error: 'Email is required to confirm this reset request.' };
  }

  if (password.length < 8) {
    logServerError('password_reset.complete.failed', 'validation_error', { status: 'failed' });
    return { error: 'Password must be at least 8 characters.' };
  }

  if (password !== confirmPassword) {
    logServerError('password_reset.complete.failed', 'validation_error', { status: 'failed' });
    return { error: 'Passwords do not match.' };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!record || record.expiresAt < new Date()) {
    logServerError('password_reset.complete.failed', 'auth_error', { status: 'failed' });
    return { error: 'This reset link is invalid or has expired.' };
  }

  if (record.user.email.toLowerCase() !== email) {
    logServerError('password_reset.complete.failed', 'auth_error', { status: 'failed', userId: record.user.id });
    return { error: 'This reset link does not match that email address.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });
  await prisma.passwordResetToken.delete({ where: { token: tokenHash } });

  logServerEvent('password_reset.completed', {
    status: 'success',
    userId: record.user.id,
  });

  return { success: 'Password updated. You can sign in now.' };
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

export async function createOrganizationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('organization.create.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const name = readString(formData, 'name');
  const slugInput = readString(formData, 'slug');
  const slug = slugify(slugInput || name);

  if (!name || !slug) {
    logServerError('organization.create.failed', 'validation_error', { status: 'failed', userId: session.user.id });
    return { error: 'Organization name is required.' };
  }

  try {
    const created = await createOrganization({
      userId: session.user.id,
      name,
      slug,
    });

    logServerEvent('organization.created', {
      status: 'success',
      userId: session.user.id,
      organizationId: created.organizationId,
    });
    revalidateAppData();

    redirect('/onboarding?stage=project');
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      logServerError('organization.create.failed', 'validation_error', {
        status: 'failed',
        userId: session.user.id,
        statusCode: error.statusCode,
      });
      return { error: error.message || 'Organization slug is already taken. Choose another one.' };
    }

    throw error;
  }
}

export async function createProjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = readString(formData, 'organizationId');
  const name = readString(formData, 'name');
  const slugInput = readString(formData, 'slug');
  const description = readString(formData, 'description');
  const slug = slugify(slugInput || name);

  if (!organizationId || !name || !slug) {
    logServerError('project.create.failed', 'validation_error', { status: 'failed', organizationId });
    return { error: 'Project name is required.' };
  }

  try {
    const created = await createProject({ organizationId, name, slug, description });
    logServerEvent('project.created', {
      status: 'success',
      organizationId,
      projectId: created.projectId,
    });
    await setProjectOnboardingStage(created.projectId, 'integrations');
    revalidateAppData();
    redirect('/onboarding?stage=integrations');
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      logServerError('project.create.failed', 'validation_error', {
        status: 'failed',
        organizationId,
        statusCode: error.statusCode,
      });
      return { error: error.message || 'Project slug is already taken. Choose another one.' };
    }

    throw error;
  }
}

export async function saveRepositoryConnectionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');
  const provider = readString(formData, 'provider').toUpperCase() as RepositoryProvider;
  const externalId = readString(formData, 'externalId');
  const owner = readString(formData, 'owner');
  const namespace = readString(formData, 'namespace');
  const repositoryName = readString(formData, 'repositoryName');
  const fullName = readString(formData, 'fullName');
  const repositoryUrl = readString(formData, 'repositoryUrl');
  const defaultBranch = readString(formData, 'defaultBranch') || 'main';
  const gitlabProjectToken = readString(formData, 'gitlabProjectToken');

  if (!projectId || !provider || !externalId || !owner || !repositoryName || !fullName || !repositoryUrl) {
    logServerError('repository.connected.failed', 'validation_error', { status: 'failed', projectId, provider });
    return { error: 'Provider, repository, and branch details are required.' };
  }

  const cookieStore = await cookies();

  // Fetch project with organization to construct org-aware webhook URL
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      organization: {
        select: { slug: true },
      },
    },
  });

  if (!project?.organization?.slug) {
    logServerError('repository.connected.failed', 'validation_error', { status: 'failed', projectId, provider });
    return { error: 'Project organization not found.' };
  }

  let installationId: string | undefined;
  let providerUser: string | undefined;
  let webhookId: string | undefined;
  let webhookStatus: 'configured' | 'failed' = 'failed';
  let webhookUrl: string | undefined;
  let webhookLastError: string | undefined;

  if (provider === 'GITHUB') {
    const githubSession = decodeCookieValue<GitHubInstallationCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.githubInstallation)?.value);
    if (!githubSession || githubSession.projectId !== projectId) {
      logServerError('repository.connected.failed', 'validation_error', { status: 'failed', projectId, provider });
      return { error: 'Connect GitHub before selecting a repository.' };
    }

    installationId = githubSession.installationId;
    const callbackUrl = absoluteUrl(`/${project.organization.slug}/${projectId}/webhooks/github`);
    const webhook = await reconcileGitHubWebhook(githubSession.installationId, owner, repositoryName, callbackUrl);
    webhookId = webhook.id;
    webhookStatus = webhook.status;
    webhookUrl = webhook.url;
    webhookLastError = webhook.error;
  }

  if (provider === 'GITLAB') {
    const gitlabSession = decodeCookieValue<GitLabOAuthCookie>(cookieStore.get(REPOSITORY_FLOW_COOKIES.gitlabOAuth)?.value);
    if (!gitlabSession || gitlabSession.projectId !== projectId) {
      logServerError('repository.connected.failed', 'validation_error', { status: 'failed', projectId, provider });
      return { error: 'Connect GitLab before selecting a project.' };
    }

    providerUser = gitlabSession.userName;
    const existingSecret = await prisma.encryptedSecret.findFirst({
      where: {
        scope: 'PROJECT',
        projectId,
        key: 'repository.gitlab',
      },
    });
    const storedSecret = existingSecret ? decryptPayload<Record<string, string>>(existingSecret) : null;
    const projectToken = gitlabProjectToken || storedSecret?.projectToken;

    if (!projectToken) {
      logServerError('repository.connected.failed', 'validation_error', { status: 'failed', projectId, provider });
      return { error: 'A GitLab project or group token with webhook permissions is required.' };
    }

    await saveRepositorySecret({
      projectId,
      provider: 'GITLAB',
      secretJson: gitlabProjectToken ? { projectToken: gitlabProjectToken } : undefined,
    });

    const callbackUrl = absoluteUrl(`/${project.organization.slug}/${projectId}/webhooks/gitlab`);
    const webhook = await reconcileGitLabWebhook(projectToken, externalId, callbackUrl);
    webhookId = webhook.id;
    webhookStatus = webhook.status;
    webhookUrl = webhook.url;
    webhookLastError = webhook.error;
  }

  const saved = await saveRepositoryConnection({
    projectId,
    provider,
    externalId,
    owner,
    namespace: namespace || undefined,
    repositoryName,
    fullName,
    repositoryUrl,
    defaultBranch,
    installationId,
    providerUser,
    webhookId,
    webhookStatus,
    webhookUrl,
    webhookLastError,
    lastSyncedAt: new Date().toISOString(),
  });

  logServerEvent('repository.connected', {
    status: 'success',
    projectId,
    provider,
    repositoryConnectionId: saved.repositoryConnectionId,
    webhookStatus,
  });
  await setProjectOnboardingStage(projectId, 'extension');
  revalidateAppData();

  redirect('/onboarding?stage=extension');
}

export async function saveIntegrationConnectionAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Not authenticated.' };

  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type') as IntegrationType;
  const configJson = readString(formData, 'configJson');
  const secretJson = readString(formData, 'secretJson');

  if (!projectId || !type || !configJson) {
    logServerError('integration.connection.failed', 'validation_error', { status: 'failed', projectId, integrationType: type });
    return { error: 'Missing required fields.' };
  }

  let config: Record<string, string>;
  let secret: Record<string, string> | undefined;

  try {
    config = JSON.parse(configJson) as Record<string, string>;
    secret = secretJson ? (JSON.parse(secretJson) as Record<string, string>) : undefined;
  } catch {
    logServerError('integration.connection.failed', 'validation_error', { status: 'failed', projectId, integrationType: type });
    return { error: 'Invalid configuration format.' };
  }
  try {
    await persistIntegrationConnection(projectId, type, config, secret ?? {});
    logServerEvent('integration.connected', {
      status: 'success',
      projectId,
      integrationType: type,
    });
    revalidateAppData();
    return { success: 'Integration connection saved successfully.' };
  } catch (error) {
    logServerError('integration.connection.failed', 'validation_error', {
      status: 'failed',
      projectId,
      integrationType: type,
    }, error);
    return { error: error instanceof Error ? error.message : 'Failed to save integration.' };
  }
}

export async function completeSetupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = readString(formData, 'organizationId');
  const projectId = readString(formData, 'projectId');
  const provider = readString(formData, 'provider') || 'openai';
  const environment = readString(formData, 'environment') || 'staging';
  const jiraProject = readString(formData, 'jiraProject');
  const trelloBoard = readString(formData, 'trelloBoard');
  const sheetsName = readString(formData, 'sheetsName');

  if (!projectId) {
    logServerError('integration.connection.failed', 'validation_error', { status: 'failed' });
    return { error: 'Project context is missing.' };
  }

  if (organizationId) {
    await saveAiSettings({
      organizationId,
      preferredProvider: provider === 'openrouter' ? 'openrouter' : 'openai',
      model: provider === 'openrouter' ? 'openrouter/free' : 'gpt-4.1-mini',
    });
  }

  await saveSystemSetting({
    scope: 'PROJECT',
    projectId,
    key: 'default-environment',
    value: { environment },
  });

  const selectedIntegrations: IntegrationType[] = [];
  if (jiraProject) selectedIntegrations.push('JIRA');
  if (trelloBoard) selectedIntegrations.push('TRELLO');
  if (sheetsName) selectedIntegrations.push('GOOGLE_SHEETS');

  for (const type of selectedIntegrations) {
    const state = await getPersistedIntegrationState(projectId, type);
    if (!state.isConfigured) {
      logServerError('integration.connection.failed', 'validation_error', {
        status: 'failed',
        projectId,
        integrationType: type,
      });
      return { error: state.message || `${getIntegrationName(type)} must be configured before you continue.` };
    }
  }

  logServerEvent('integration.connected', {
    status: 'success',
    organizationId,
    projectId,
    integrationType: selectedIntegrations,
  });
  await setProjectOnboardingStage(projectId, 'repository');
  revalidateAppData();

  redirect('/onboarding?stage=repository');
}


export async function saveIntegrationConfigAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type');

  if (!projectId) {
    return { error: 'Project is required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project) {
    return { error: 'Project not found.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
  if (!membership || !canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can update integration configuration.' };
  }

  if (type === 'JIRA') {
    const baseUrl = readString(formData, 'baseUrl');
    const projectKey = readString(formData, 'projectKey');
    const issueType = readString(formData, 'issueType') || 'Task';

    if (!baseUrl || !projectKey) {
      return { error: 'Jira base URL and project key are required.' };
    }

    await saveIntegration({
      projectId,
      type: 'JIRA',
      name: 'Jira',
      configJson: { baseUrl, projectKey, issueType },
    });
    revalidateAppData();

    return { success: 'Jira configuration saved.' };
  }

  if (type === 'TRELLO') {
    const boardId = readString(formData, 'boardId');
    const defaultListId = readString(formData, 'defaultListId');

    if (!boardId) {
      return { error: 'Trello board ID is required.' };
    }

    await saveIntegration({
      projectId,
      type: 'TRELLO',
      name: 'Trello',
      configJson: { boardId, defaultListId: defaultListId || undefined },
    });
    revalidateAppData();

    return { success: 'Trello configuration saved.' };
  }

  if (type === 'GOOGLE_SHEETS') {
    const spreadsheetId = readString(formData, 'spreadsheetId');
    const sheetName = readString(formData, 'sheetName');

    if (!spreadsheetId || !sheetName) {
      return { error: 'Spreadsheet ID and sheet name are required.' };
    }

    await saveIntegration({
      projectId,
      type: 'GOOGLE_SHEETS',
      name: 'Google Sheets',
      configJson: { spreadsheetId, sheetName },
    });
    revalidateAppData();

    return { success: 'Google Sheets configuration saved.' };
  }

  return { error: 'Choose a valid integration.' };
}

export async function finalizeOnboardingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');

  if (projectId) {
    await saveSystemSetting({
      scope: 'PROJECT',
      projectId,
      key: ONBOARDING_COMPLETE_KEY,
      value: { completedAt: new Date().toISOString() },
    });
    await setProjectOnboardingStage(projectId, 'finalize');
    revalidateAppData();
  }

  redirect('/app');
}

export async function saveOAuthSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId');
  const enabled = readBoolean(formData, 'enabled');
  const clientId = readString(formData, 'clientId');
  const clientSecret = readString(formData, 'clientSecret');
  const authUrl = readString(formData, 'authUrl');
  const tokenUrl = readString(formData, 'tokenUrl');
  const userInfoUrl = readString(formData, 'userInfoUrl');

  if (!organizationId) {
    return { error: 'Organization is required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership) {
    return { error: 'Organization not found.' };
  }
  if (!canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can update OAuth settings.' };
  }

  if (enabled && !clientId) {
    return { error: 'Client ID is required when Google OAuth is enabled.' };
  }

  await saveOAuthSettings({
    enabled,
    provider: 'google',
    clientId,
    clientSecret: clientSecret || undefined,
    authUrl: authUrl || undefined,
    tokenUrl: tokenUrl || undefined,
    userInfoUrl: userInfoUrl || undefined,
  });
  revalidateAppData();

  return { success: 'OAuth settings saved.' };
}

export async function saveUserProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const name = readString(formData, 'name');
  if (!name) {
    return { error: 'Display name is required.' };
  }

  try {
    await updateUserProfile({
      userId: session.user.id,
      name,
    });
    revalidateAppData();

    return { success: 'User profile saved.' };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Could not save your profile right now.' };
    }

    throw error;
  }
}

export async function saveOrganizationProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId');
  const name = readString(formData, 'name');
  const slug = slugify(readString(formData, 'slug'));

  if (!organizationId || !name || !slug) {
    return { error: 'Organization name and slug are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership) {
    return { error: 'Organization not found.' };
  }

  if (!canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can update organization settings.' };
  }

  try {
    await updateOrganizationProfile({
      organizationId,
      name,
      slug,
    });
    revalidateAppData();

    return { success: 'Organization profile saved.' };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Organization profile could not be saved.' };
    }

    throw error;
  }
}

export async function saveProjectProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const projectId = readString(formData, 'projectId');
  const name = readString(formData, 'name');
  const slug = slugify(readString(formData, 'slug'));
  const description = readString(formData, 'description');

  if (!projectId || !name || !slug) {
    return { error: 'Project name and slug are required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project) {
    return { error: 'Project not found.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
  if (!membership || !canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can update project settings.' };
  }

  try {
    await updateProjectProfile({
      projectId,
      name,
      slug,
      description: description || undefined,
    });
    revalidateAppData();

    return { success: 'Project profile saved.' };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Project profile could not be saved.' };
    }

    throw error;
  }
}

export async function queueBrowserChecksAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const projectId = readString(formData, 'projectId');
  if (!projectId) {
    return { error: 'Project is required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project) {
    return { error: 'Project not found.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
  if (!membership || !canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can queue browser checks from settings.' };
  }

  try {
    await createAgentAction({
      projectId,
      type: 'run_browser_checks',
      target: 'project',
      title: `Run browser checks for ${project.name}`,
      description: 'Queued from settings to validate the current project runtime and browser-facing flows.',
      readOnly: false,
      approvalRequired: false,
      input: {
        source: 'settings',
        projectSlug: project.slug,
      },
    });
    revalidateAppData();

    return { success: 'Browser checks queued.' };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Could not queue browser checks.' };
    }

    throw error;
  }
}

export async function deleteProjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const projectId = readString(formData, 'projectId');
  const confirmation = readString(formData, 'confirmation');

  if (!projectId) {
    return { error: 'Project is required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project) {
    return { error: 'Project not found.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
  if (!membership || !canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can delete a project.' };
  }

  if (confirmation !== project.slug) {
    return { error: `Type "${project.slug}" to confirm deletion.` };
  }

  try {
    await deleteProject(projectId);
    revalidateAppData();
    redirect('/app');
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Project deletion failed.' };
    }

    throw error;
  }
}

export async function saveAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId') || undefined;
  const projectId = readString(formData, 'projectId') || undefined;
  const preferredProvider = readString(formData, 'preferredProvider');
  const model = readString(formData, 'model');
  const openaiApiKey = readString(formData, 'openaiApiKey');
  const openrouterApiKey = readString(formData, 'openrouterApiKey');

  if (!model) {
    return { error: 'Model is required.' };
  }

  if (preferredProvider !== 'openai' && preferredProvider !== 'openrouter') {
    return { error: 'Choose a valid AI provider.' };
  }

  if (projectId) {
    const project = await requireOwnedProject(session.user.id, projectId);
    if (!project) {
      return { error: 'Project not found.' };
    }

    const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
    if (!membership || !canManageOrganizationSettings(membership.role)) {
      return { error: 'Only organization owners and admins can update AI settings.' };
    }
  } else if (organizationId) {
    const membership = await requireOwnedOrganization(session.user.id, organizationId);
    if (!membership) {
      return { error: 'Organization not found.' };
    }
    if (!canManageOrganizationSettings(membership.role)) {
      return { error: 'Only organization owners and admins can update AI settings.' };
    }
  } else {
    return { error: 'Settings scope is required.' };
  }

  await saveAiSettings({
    organizationId,
    projectId,
    preferredProvider,
    model,
    openaiApiKey: openaiApiKey || undefined,
    openrouterApiKey: openrouterApiKey || undefined,
  });
  revalidateTag(settingsCacheTag(organizationId, projectId));
  revalidateAppData();

  return { success: 'AI settings saved.' };
}

export async function testAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId') || undefined;
  const projectId = readString(formData, 'projectId') || undefined;
  const preferredProvider = readString(formData, 'preferredProvider');
  const model = readString(formData, 'model');
  const openaiApiKey = readString(formData, 'openaiApiKey');
  const openrouterApiKey = readString(formData, 'openrouterApiKey');

  if (projectId) {
    const project = await requireOwnedProject(session.user.id, projectId);
    if (!project) {
      return { error: 'Project not found.' };
    }

    const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
    if (!membership || !canManageOrganizationSettings(membership.role)) {
      return { error: 'Only organization owners and admins can validate AI settings.' };
    }
  } else if (organizationId) {
    const membership = await requireOwnedOrganization(session.user.id, organizationId);
    if (!membership || !canManageOrganizationSettings(membership.role)) {
      return { error: 'Only organization owners and admins can validate AI settings.' };
    }
  } else {
    return { error: 'Settings scope is required.' };
  }

  if (preferredProvider !== 'openai' && preferredProvider !== 'openrouter') {
    return { error: 'Choose a valid AI provider.' };
  }

  if (!model) {
    return { error: 'Model is required.' };
  }

  try {
    const result = await testHostedRuntime({
      organizationId,
      projectId,
      preferredProvider,
      model,
      openaiApiKey: openaiApiKey || undefined,
      openrouterApiKey: openrouterApiKey || undefined,
    });
    return {
      success: `Runtime OK: ${result.provider} · ${result.model} · ${result.scope}`,
    };
  } catch (error) {
    if (error instanceof AppApiError) {
      return { error: error.message || 'Runtime validation failed.' };
    }

    throw error;
  }
}

export async function saveIntegrationSecretAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type');

  if (!projectId) {
    return { error: 'Project is required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project) {
    return { error: 'Project not found.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, project.organizationId);
  if (!membership || !canManageOrganizationSettings(membership.role)) {
    return { error: 'Only organization owners and admins can update integration credentials.' };
  }

  if (type !== 'JIRA' && type !== 'TRELLO' && type !== 'GOOGLE_SHEETS') {
    return { error: 'Choose a valid integration.' };
  }

  let secretJson: Record<string, unknown>;

  if (type === 'JIRA') {
    const email = readString(formData, 'email');
    const apiToken = readString(formData, 'apiToken');
    if (!email || !apiToken) {
      return { error: 'Jira email and API token are required.' };
    }
    secretJson = { email, apiToken };
  } else if (type === 'TRELLO') {
    const apiKey = readString(formData, 'apiKey');
    const token = readString(formData, 'token');
    if (!apiKey || !token) {
      return { error: 'Trello API key and token are required.' };
    }
    secretJson = { apiKey, token };
  } else {
    const serviceAccountJson = readString(formData, 'serviceAccountJson');
    if (!serviceAccountJson) {
      return { error: 'Google service account JSON is required.' };
    }
    try {
      JSON.parse(serviceAccountJson);
    } catch {
      return { error: 'Google service account JSON must be valid JSON.' };
    }
    secretJson = { serviceAccountJson };
  }

  await saveIntegrationSecret({
    projectId,
    type,
    secretJson,
  });
  revalidateAppData();

  return { success: `${type} secret saved.` };
}

export async function createAgentActionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type');
  const target = readString(formData, 'target') || 'project';
  const title = readString(formData, 'title');
  const description = readString(formData, 'description');
  const targetId = readString(formData, 'targetId');
  const integrationMode = readString(formData, 'mode');
  const integrationId = readString(formData, 'integrationId');
  const readOnly = readBoolean(formData, 'readOnly');
  const approvalRequired = readBoolean(formData, 'approvalRequired');
  const inputJson = readString(formData, 'inputJson');

  if (!projectId || !title || !description) {
    return { error: 'Project, title, and description are required.' };
  }

  let input: Record<string, unknown> = {};
  if (inputJson) {
    try {
      input = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      return { error: 'Input JSON must be valid JSON.' };
    }
  }

  if (type === 'sync_jira') {
    input = {
      ...input,
      mode: integrationMode || 'create',
      ...(integrationMode === 'status_check' && integrationId ? { issueKey: integrationId } : {}),
      ...(integrationMode !== 'status_check' ? { title, description } : {}),
    };
  }

  if (type === 'sync_trello') {
    input = {
      ...input,
      mode: integrationMode || 'create',
      ...(integrationMode === 'status_check' && integrationId ? { cardId: integrationId } : {}),
      ...(integrationMode !== 'status_check' ? { title, description } : {}),
    };
  }

  if (type === 'export_sheets') {
    input = {
      ...input,
      mode: 'tickets_table',
    };
  }

  if (
    !['analyze_pr', 'generate_tests', 'generate_from_recorder', 'run_browser_checks', 'sync_jira', 'sync_trello', 'export_sheets'].includes(type) ||
    !['pr', 'recorder_session', 'test_case', 'run', 'project'].includes(target)
  ) {
    return { error: 'Invalid action type or target.' };
  }

  await createAgentAction({
    projectId,
    type: type as Parameters<typeof createAgentAction>[0]['type'],
    target: target as Parameters<typeof createAgentAction>[0]['target'],
    targetId: targetId || undefined,
    title,
    description,
    readOnly,
    approvalRequired,
    input,
  });
  revalidateAppData();

  return { success: 'Agent action created.' };
}

export async function approveAgentActionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actionId = readString(formData, 'actionId');
  if (!actionId) {
    return { error: 'Action id is required.' };
  }

  await approveAgentAction(actionId);
  revalidateAppData();
  return { success: 'Action approved and queued.' };
}

export async function createStudioAgentThreadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId');
  const projectId = readString(formData, 'projectId');
  const content = readString(formData, 'content');

  if (!organizationId || !projectId || !content) {
    return { error: 'Organization, project, and message are required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project || project.organizationId !== organizationId) {
    return { error: 'Project not found.' };
  }

  try {
    const result = await createAgentThread({
      organizationId,
      projectId,
      content,
    });
    revalidateAppData();
    return {
      success: 'Agent thread created.',
      threadId: result.thread.id,
    };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Could not create the agent thread.' };
    }

    throw error;
  }
}

export async function sendStudioAgentMessageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId');
  const projectId = readString(formData, 'projectId');
  const threadId = readString(formData, 'threadId');
  const content = readString(formData, 'content');

  if (!organizationId || !projectId || !threadId || !content) {
    return { error: 'Organization, project, thread, and message are required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project || project.organizationId !== organizationId) {
    return { error: 'Project not found.' };
  }

  try {
    await sendAgentThreadMessage({
      threadId,
      organizationId,
      projectId,
      content,
    });
    revalidateAppData();
    return {
      success: 'Message sent.',
      threadId,
    };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Could not send the message.' };
    }

    throw error;
  }
}

export async function runStudioAgentPlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated.' };
  }

  const organizationId = readString(formData, 'organizationId');
  const projectId = readString(formData, 'projectId');
  const goal = readString(formData, 'goal');
  const focus = readString(formData, 'focus') || undefined;

  if (!organizationId || !projectId || !goal) {
    return { error: 'Organization, project, and goal are required.' };
  }

  const project = await requireOwnedProject(session.user.id, projectId);
  if (!project || project.organizationId !== organizationId) {
    return { error: 'Project not found.' };
  }

  try {
    const result = await runHostedAgentExecution({
      organizationId,
      projectId,
      goal,
      focus,
    });
    revalidateAppData();

    return {
      success: 'Execution plan generated.',
      resultJson: JSON.stringify(result),
    };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Agent plan generation failed.' };
    }

    throw error;
  }
}

export async function inviteOrganizationMemberAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('member.invite.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const email = readString(formData, 'email');
  const role = readString(formData, 'role');

  if (!organizationId || !email || !role) {
    return { error: 'Email and role are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership) {
    logServerError('member.invite.failed', 'auth_error', { status: 'failed', userId: session.user.id, organizationId });
    return { error: 'You do not have access to this organization.' };
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { error: 'Only organization owners and admins can invite members.' };
  }

  if (role === 'owner' && membership.role !== 'owner') {
    return { error: 'Only organization owners can invite another owner.' };
  }

  try {
    const { rawToken } = await inviteOrganizationMember(organizationId, session.user.id, {
      email,
      role: role as 'owner' | 'admin' | 'member',
    });

    const inviteUrl = `${absoluteUrl('/invite')}/${rawToken}`;

    try {
      await sendOrganizationInviteEmail({
        to: email,
        inviterName: session.user.name || session.user.email || 'A team member',
        orgName: membership.organization.name,
        inviteUrl,
      });
    } catch (emailError) {
      logServerError('member.invite.email_send.failed', 'network_error', {
        status: 'failed',
        userId: session.user.id,
        organizationId,
      });
      return {
        error: 'Invitation created, but email could not be sent. SMTP is not configured.',
      };
    }

    logServerEvent('member.invited', {
      status: 'success',
      userId: session.user.id,
      organizationId,
      invitedEmail: email,
    });
    revalidateAppData();

    return { success: `Invitation sent to ${email}` };
  } catch (error) {
    logServerError('member.invite.failed', 'internal_error', {
      status: 'failed',
      userId: session.user.id,
      organizationId,
    });
    throw error;
  }
}

export async function revokeOrganizationInviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('member.invite.revoke.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const inviteId = readString(formData, 'inviteId');

  if (!organizationId || !inviteId) {
    return { error: 'Organization and invite IDs are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership) {
    return { error: 'You do not have access to this organization.' };
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { error: 'Only organization owners and admins can revoke invites.' };
  }

  try {
    await revokeOrganizationInvite(organizationId, session.user.id, inviteId);
    logServerEvent('member.invite.revoked', {
      status: 'success',
      userId: session.user.id,
      organizationId,
      inviteId,
    });
    revalidateAppData();
    return { success: 'Invitation revoked.' };
  } catch (error) {
    if (error instanceof AppApiError && error.code === 'request_failed') {
      return { error: error.message || 'Invitation could not be revoked.' };
    }

    logServerError('member.invite.revoke.failed', 'validation_error', { status: 'failed', userId: session.user.id, organizationId });
    throw error;
  }
}

export async function removeOrganizationMemberAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('member.remove.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const memberId = readString(formData, 'memberId');

  if (!organizationId || !memberId) {
    return { error: 'Organization and member IDs are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership || membership.role !== 'owner') {
    return { error: 'Only organization owners can remove members.' };
  }

  try {
    await removeOrganizationMember(organizationId, session.user.id, memberId);

    logServerEvent('member.removed', {
      status: 'success',
      userId: session.user.id,
      organizationId,
      removedMemberId: memberId,
    });
    revalidateAppData();

    return { success: 'Member removed.' };
  } catch (error) {
    logServerError('member.remove.failed', 'validation_error', { status: 'failed', userId: session.user.id, organizationId });
    throw error;
  }
}

export async function updateOrganizationMemberRoleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('member.role.update.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const memberId = readString(formData, 'memberId');
  const role = readString(formData, 'role');

  if (!organizationId || !memberId || !role) {
    return { error: 'Organization ID, member ID, and role are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership || membership.role !== 'owner') {
    return { error: 'Only organization owners can change member roles.' };
  }

  try {
    await updateOrganizationMemberRole(organizationId, session.user.id, memberId, {
      role: role as 'owner' | 'admin' | 'member',
    });

    logServerEvent('member.role.updated', {
      status: 'success',
      userId: session.user.id,
      organizationId,
      memberId,
      newRole: role,
    });
    revalidateAppData();

    return { success: 'Member role updated.' };
  } catch (error) {
    logServerError('member.role.update.failed', 'validation_error', { status: 'failed', userId: session.user.id, organizationId });
    throw error;
  }
}

export async function transferOrganizationOwnershipAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('organization.ownership.transfer.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const newOwnerUserId = readString(formData, 'newOwnerUserId');

  if (!organizationId || !newOwnerUserId) {
    return { error: 'Organization ID and new owner user ID are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership || membership.role !== 'owner') {
    return { error: 'Only organization owners can transfer ownership.' };
  }

  try {
    await transferOrganizationOwnership(organizationId, session.user.id, {
      newOwnerUserId,
    });

    logServerEvent('organization.ownership.transferred', {
      status: 'success',
      userId: session.user.id,
      organizationId,
      newOwnerUserId,
    });
    revalidateAppData();

    return { success: 'Ownership transferred.' };
  } catch (error) {
    logServerError('organization.ownership.transfer.failed', 'validation_error', { status: 'failed', userId: session.user.id, organizationId });
    throw error;
  }
}

export async function deleteOrganizationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    logServerError('organization.delete.failed', 'auth_error', { status: 'failed' });
    redirect('/login');
  }

  const organizationId = readString(formData, 'organizationId');
  const confirmation = readString(formData, 'confirmation');

  if (!organizationId || !confirmation) {
    return { error: 'Organization ID and confirmation are required.' };
  }

  const membership = await requireOwnedOrganization(session.user.id, organizationId);
  if (!membership || membership.role !== 'owner') {
    return { error: 'Only organization owners can delete the organization.' };
  }

  if (confirmation !== membership.organization.slug) {
    return { error: `Please type the organization slug "${membership.organization.slug}" to confirm deletion.` };
  }

  try {
    await deleteOrganization(organizationId, session.user.id);

    logServerEvent('organization.deleted', {
      status: 'success',
      userId: session.user.id,
      organizationId,
    });

    redirect('/login');
  } catch (error) {
    logServerError('organization.delete.failed', 'validation_error', { status: 'failed', userId: session.user.id, organizationId });
    throw error;
  }
}
