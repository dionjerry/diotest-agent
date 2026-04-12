'use server';

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  approveAgentAction,
  createAgentAction,
  createOrganization,
  createProject,
  saveAiSettings,
  saveGithubConnection,
  saveIntegration,
  saveIntegrationSecret,
  saveOAuthSettings,
  saveSystemSetting,
} from '@/lib/api';
import { auth, signIn, signOut } from '@/lib/auth';
import { getPersistedIntegrationState, getIntegrationName, persistIntegrationConnection, type IntegrationType } from '@/lib/integration-connections';
import { isSmtpConfigured, sendPasswordResetEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { logServerError, logServerEvent } from '@/lib/server-logger';
import { absoluteUrl, slugify } from '@/lib/utils';

export type ActionState = {
  error?: string;
  success?: string;
};

function revalidateAppData() {
  revalidatePath('/onboarding');
  revalidatePath('/app');
  revalidatePath('/app/projects');
  revalidatePath('/app/settings');
  revalidatePath('/studio');
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/app',
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
    redirectTo: '/onboarding',
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

  redirect('/onboarding');
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

  const created = await createProject({ organizationId, name, slug, description });
  logServerEvent('project.created', {
    status: 'success',
    organizationId,
    projectId: created.projectId,
  });
  revalidateAppData();
  redirect('/onboarding');
}

export async function saveGithubConnectionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');
  const repositoryOwner = readString(formData, 'repositoryOwner');
  const repositoryName = readString(formData, 'repositoryName');
  const defaultBranch = readString(formData, 'defaultBranch') || 'main';
  const installationId = readString(formData, 'installationId');

  if (!projectId || !repositoryOwner || !repositoryName) {
    logServerError('github.connected.failed', 'validation_error', { status: 'failed', projectId });
    return { error: 'Repository owner and name are required.' };
  }

  const saved = await saveGithubConnection({
    projectId,
    repositoryOwner,
    repositoryName,
    defaultBranch,
    installationId: installationId || undefined,
  });

  logServerEvent('github.connected', {
    status: 'success',
    projectId,
    githubConnectionId: saved.githubConnectionId,
  });
  revalidateAppData();

  redirect('/onboarding');
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
  revalidateAppData();

  redirect('/onboarding?stage=finalize');
}


export async function saveIntegrationConfigAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type');

  if (!projectId) {
    return { error: 'Project is required.' };
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
      key: 'onboarding_complete',
      value: { completedAt: new Date().toISOString() },
    });
    revalidateAppData();
  }

  redirect('/app');
}

export async function saveOAuthSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = readString(formData, 'organizationId') || undefined;
  const enabled = readBoolean(formData, 'enabled');
  const clientId = readString(formData, 'clientId');
  const clientSecret = readString(formData, 'clientSecret');
  const authUrl = readString(formData, 'authUrl');
  const tokenUrl = readString(formData, 'tokenUrl');
  const userInfoUrl = readString(formData, 'userInfoUrl');

  if (enabled && !clientId) {
    return { error: 'Client ID is required when Google OAuth is enabled.' };
  }

  await saveOAuthSettings({
    organizationId,
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

export async function saveAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
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

  await saveAiSettings({
    organizationId,
    projectId,
    preferredProvider,
    model,
    openaiApiKey: openaiApiKey || undefined,
    openrouterApiKey: openrouterApiKey || undefined,
  });
  revalidateAppData();

  return { success: 'AI settings saved.' };
}

export async function saveIntegrationSecretAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = readString(formData, 'projectId');
  const type = readString(formData, 'type');

  if (!projectId) {
    return { error: 'Project is required.' };
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
