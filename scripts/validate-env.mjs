#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.local'), override: true });

const REQUIRED_VARS = [
  'APP_BASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'SETTINGS_ENCRYPTION_KEY',
  'DATABASE_URL',
  'API_BASE_URL',
  'INTERNAL_API_KEY',
];

const OPTIONAL_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_APP_ID',
  'GITHUB_APP_NAME',
  'GITHUB_APP_PRIVATE_KEY',
  'GITLAB_CLIENT_ID',
  'GITLAB_CLIENT_SECRET',
];

const SMTP_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
];

function validateEnv() {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`\n📋 [${timestamp}] Environment Configuration Validation\n`);
  console.log('='.repeat(70));

  let hasErrors = false;
  let hasMissing = false;

  // Check required variables
  console.log('\n✓ Required Variables:');
  REQUIRED_VARS.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ❌ ${varName} - MISSING`);
      hasErrors = true;
    } else {
      const maskedValue = maskValue(varName, value);
      console.log(`  ✓ ${varName} - ${maskedValue}`);
    }
  });

  // Check SMTP configuration
  console.log('\n📧 SMTP Configuration:');
  const smtpConfigured = SMTP_VARS.every((v) => process.env[v]);
  if (smtpConfigured) {
    console.log(`  ✓ SMTP is configured`);
    console.log(`    Host: ${process.env.SMTP_HOST}`);
    console.log(`    Port: ${process.env.SMTP_PORT}`);
    console.log(`    From: ${process.env.SMTP_FROM}`);
  } else {
    console.log(`  ⚠️  SMTP is not fully configured (password reset will not work)`);
    SMTP_VARS.forEach((varName) => {
      if (!process.env[varName]) {
        console.log(`     Missing: ${varName}`);
        hasMissing = true;
      }
    });
  }

  // Check optional variables
  console.log('\n⚙️  Optional Variables:');
  const configured = OPTIONAL_VARS.filter((v) => process.env[v]).length;
  const total = OPTIONAL_VARS.length;
  console.log(`  ${configured}/${total} configured`);

  // Check GitHub integration
  const githubConfigured =
    process.env.GITHUB_APP_ID && process.env.GITHUB_APP_NAME && process.env.GITHUB_APP_PRIVATE_KEY;
  if (githubConfigured) {
    console.log(`  ✓ GitHub App is configured`);
  } else {
    console.log(`  ⚠️  GitHub App is not fully configured`);
  }

  // Check GitLab integration
  const gitlabConfigured = process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET;
  if (gitlabConfigured) {
    console.log(`  ✓ GitLab OAuth is configured`);
  } else {
    console.log(`  ⚠️  GitLab OAuth is not configured`);
  }

  // Check Google integration
  const googleConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (googleConfigured) {
    console.log(`  ✓ Google OAuth is configured`);
  } else {
    console.log(`  ⚠️  Google OAuth is not configured`);
  }

  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('\n❌ CONFIGURATION ERROR: Required variables are missing');
    console.log('Please set all required variables in .env or .env.local\n');
    process.exit(1);
  }

  if (hasMissing) {
    console.log('\n⚠️  WARNING: Some optional features are not configured');
    console.log('The app will work but some features may be unavailable\n');
  }

  console.log('✓ Configuration is valid - ready to start\n');
  return true;
}

function maskValue(varName, value) {
  const sensitivePatterns = [
    'SECRET',
    'KEY',
    'PASSWORD',
    'PASS',
    'TOKEN',
  ];

  const isSensitive = sensitivePatterns.some((pattern) => varName.includes(pattern));

  if (isSensitive) {
    if (value.length > 20) {
      return value.substring(0, 8) + '...' + value.substring(value.length - 4);
    }
    return '***';
  }

  return value;
}

try {
  validateEnv();
} catch (error) {
  console.error('❌ Validation error:', error.message);
  process.exit(1);
}
