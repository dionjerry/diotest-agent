import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.local'), override: true });

// Module initialization check
const moduleInitTime = new Date().toISOString().split('T')[1].split('.')[0];
console.log(`\n📦 [${moduleInitTime}] Initializing Web module...`);

try {
  // Validate core configuration early
  if (!process.env.APP_BASE_URL) {
    throw new Error('APP_BASE_URL environment variable is required (e.g., http://localhost:3000 or https://your-domain.com)');
  }
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET environment variable is required for session encryption');
  }
  if (!process.env.SETTINGS_ENCRYPTION_KEY) {
    throw new Error('SETTINGS_ENCRYPTION_KEY environment variable is required for settings encryption');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for database connection');
  }
} catch (error) {
  console.error(`❌ [${moduleInitTime}] Web module initialization failed:`);
  console.error(`   ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log(`✓ [${moduleInitTime}] Web module configuration validated`);

export const env = {
  appBaseUrl: process.env.APP_BASE_URL || (() => {
    throw new Error('APP_BASE_URL environment variable is required (e.g., http://localhost:3000 or https://your-domain.com)');
  })(),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  nextAuthUrl: process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '',
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? '',
  github: {
    appId: process.env.GITHUB_APP_ID ?? '',
    appName: process.env.GITHUB_APP_NAME ?? '',
    appPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY ?? '',
    apiBaseUrl: process.env.GITHUB_API_BASE_URL ?? 'https://api.github.com',
    appBaseUrl: process.env.GITHUB_APP_BASE_URL ?? 'https://github.com',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  },
  gitlab: {
    baseUrl: process.env.GITLAB_BASE_URL ?? 'https://gitlab.com',
    clientId: process.env.GITLAB_CLIENT_ID ?? '',
    clientSecret: process.env.GITLAB_CLIENT_SECRET ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? '',
    secure: process.env.SMTP_SECURE === 'true',
  },
};
