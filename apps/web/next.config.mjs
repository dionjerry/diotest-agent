import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const { loadEnvConfig } = nextEnv;
loadEnvConfig(repoRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.DIOTEST_NEXT_DIST_DIR || '.next',
  experimental: {
    devtoolSegmentExplorer: false,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Allow ngrok and localhost for development cross-origin requests
  allowedDevOrigins: [
    'localhost:3000',
    'localhost:3001',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
