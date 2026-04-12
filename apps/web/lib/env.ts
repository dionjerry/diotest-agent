import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.local'), override: true });

export const env = {
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  nextAuthUrl: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? '',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? '',
    secure: process.env.SMTP_SECURE === 'true',
  },
};
