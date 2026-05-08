#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.local'), override: true });

export function logModuleInit(moduleName) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`\n📦 [${timestamp}] Initializing ${moduleName} module...`);
}

export function logModuleReady(moduleName, details = {}) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const detailsStr = Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
  console.log(`✓ [${timestamp}] ${moduleName} ready ${detailsStr ? '(' + detailsStr + ')' : ''}`);
}

export function logModuleError(moduleName, error) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`❌ [${timestamp}] ${moduleName} initialization failed:`);
  console.error(`   ${error.message}`);
}

export function checkEnvironment(moduleName, requiredVars = []) {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`${moduleName} missing required variables: ${missing.join(', ')}`);
  }
}

export function checkDatabaseConnection(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }
  if (databaseUrl.includes('localhost:5432')) {
    console.warn('⚠️  Using local PostgreSQL - make sure the database is running');
  } else if (databaseUrl.includes('supabase')) {
    console.log('Using Supabase PostgreSQL');
  }
}

export function checkAuthSecrets(appBaseUrl, nextAuthSecret, settingsEncryptionKey) {
  const issues = [];
  if (!appBaseUrl) issues.push('APP_BASE_URL');
  if (!nextAuthSecret) issues.push('NEXTAUTH_SECRET');
  if (!settingsEncryptionKey) issues.push('SETTINGS_ENCRYPTION_KEY');

  if (issues.length > 0) {
    throw new Error(`Auth/config secrets missing: ${issues.join(', ')}`);
  }

  if (nextAuthSecret.length < 32) {
    console.warn('⚠️  NEXTAUTH_SECRET is very short - consider using a longer random string (32+ chars)');
  }
}
