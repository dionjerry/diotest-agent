export type SettingScope = 'SYSTEM' | 'ORGANIZATION' | 'PROJECT';

export type SecretKey =
  | 'oauth.google'
  | 'ai.openai'
  | 'ai.openrouter'
  | 'integration.jira'
  | 'integration.trello'
  | 'integration.google_sheets';

export interface EncryptedSecretRecord {
  id: string;
  scope: SettingScope;
  organizationId?: string | null;
  projectId?: string | null;
  key: SecretKey | string;
  cipherText: string;
  iv: string;
  tag: string;
  algorithm: 'aes-256-gcm';
  createdAt: string;
  updatedAt: string;
}

export type AgentActionType =
  | 'analyze_pr'
  | 'generate_tests'
  | 'generate_from_recorder'
  | 'run_browser_checks'
  | 'sync_jira'
  | 'sync_trello'
  | 'export_sheets';

export type AgentActionStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentActionTarget = 'pr' | 'recorder_session' | 'test_case' | 'run' | 'project';

export interface AgentAction {
  id: string;
  projectId: string;
  type: AgentActionType;
  target: AgentActionTarget;
  targetId?: string | null;
  title: string;
  description: string;
  readOnly: boolean;
  approvalRequired: boolean;
  status: AgentActionStatus;
  input: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export type TaskType = 'analysis' | 'generation' | 'run' | 'sync' | 'export';

export type TaskStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface TaskOutput {
  summary?: string;
  details?: Record<string, unknown>;
}

export interface Task {
  id: string;
  projectId: string;
  actionId?: string | null;
  type: TaskType;
  status: TaskStatus;
  title: string;
  input: Record<string, unknown>;
  output?: TaskOutput | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface OAuthProviderConfig {
  enabled: boolean;
  provider: 'google';
  clientId: string;
  clientSecret?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}

export interface AiProviderConfig {
  preferredProvider: 'openai' | 'openrouter';
  model: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}

export type IntegrationType = 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';

export interface JiraIntegrationConfig {
  baseUrl: string;
  projectKey: string;
  issueType?: string;
}

export interface JiraIntegrationSecret {
  email: string;
  apiToken: string;
}

export interface TrelloIntegrationConfig {
  boardId: string;
  defaultListId?: string;
}

export interface TrelloIntegrationSecret {
  apiKey: string;
  token: string;
}

export interface GoogleSheetsIntegrationConfig {
  spreadsheetId: string;
  sheetName: string;
}

export interface GoogleSheetsIntegrationSecret {
  serviceAccountJson: string;
}

export interface IntegrationHealthState {
  isConfigured: boolean;
  missing: string[];
}
