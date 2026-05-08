# Environment Configuration Guide

## Overview

The DioTest Agent requires explicit environment configuration with **no hardcoded fallbacks**. This ensures:
- Correct URLs for GitHub OAuth callbacks
- Proper webhook routing
- Reset password links work correctly
- No silent misconfigurations

## Key Environment Variable: `APP_BASE_URL`

**`APP_BASE_URL`** is the public URL where users access your application. It's used to generate:
- GitHub App callback URLs
- Webhook URLs (extension pings, repository webhooks)
- Password reset links
- All server-side absolute links

**This variable is REQUIRED** and will throw an error if not set.

## Configuration by Environment

### Local Development (localhost)

```env
APP_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

**When to use:** Pure local development, no external access needed.

### Development via Ngrok (tunneling to localhost)

```env
APP_BASE_URL=https://your-ngrok-domain.ngrok-free.dev
NEXTAUTH_URL=https://your-ngrok-domain.ngrok-free.dev
```

**When to use:** Testing GitHub OAuth, webhooks, or integrations without deploying.

**Setup:**
1. Start ngrok: `ngrok http 3000`
2. Get your ngrok URL from the output (e.g., `https://xyz123.ngrok-free.dev`)
3. Update `APP_BASE_URL` and `NEXTAUTH_URL` to that URL
4. Update GitHub App settings if needed:
   - Setup URL: `https://your-ngrok-domain.ngrok-free.dev/api/repositories/github/callback`
   - Webhook URL: `https://your-ngrok-domain.ngrok-free.dev/api/repositories/webhooks/github`

### Staging / Production

```env
APP_BASE_URL=https://staging.example.com
NEXTAUTH_URL=https://staging.example.com
```

OR

```env
APP_BASE_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com
```

**When to use:** Staging or production deployments.

## Full Environment File Example

See `.env.example` for a complete template.

Key variables:
- `APP_BASE_URL` - **Required**, public application URL
- `NEXTAUTH_URL` - **Should match APP_BASE_URL**
- `NEXTAUTH_SECRET` - **Required for production**
- `SETTINGS_ENCRYPTION_KEY` - **Required for production**
- `DATABASE_URL` - PostgreSQL connection
- `API_BASE_URL` - Backend API URL (can be localhost if internal)
- `GITHUB_APP_ID`, `GITHUB_APP_NAME`, `GITHUB_APP_PRIVATE_KEY` - GitHub integration
- `GITHUB_WEBHOOK_SECRET` - GitHub webhook secret

## How It Works

### `absoluteUrl(path)` Function

Located in `apps/web/lib/utils.ts`, this function builds absolute URLs:

```typescript
export function absoluteUrl(path: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new Error('APP_BASE_URL environment variable is required...');
  }
  return new URL(path, base).toString();
}
```

**Used for:**
- GitHub OAuth callbacks: `/api/repositories/github/callback`
- Extension pings: `/api/extension/ping` or `/{org}/{projectId}/api/extension/ping`
- Webhooks: `/api/repositories/webhooks/github` or `/{org}/{projectId}/webhooks/github`
- Password reset links

### Environment Loading

In `apps/web/lib/env.ts`:
1. Loads from `.env` file
2. Overrides with `.env.local` if it exists
3. Falls back to `process.env` for CI/CD systems

```typescript
export const env = {
  appBaseUrl: process.env.APP_BASE_URL || (() => {
    throw new Error('APP_BASE_URL is required...');
  })(),
  // ... other variables
};
```

## Common Issues

### "APP_BASE_URL environment variable is required"

**Cause:** `APP_BASE_URL` is not set in `.env`, `.env.local`, or system environment.

**Fix:** 
1. Copy `.env.example` to `.env`
2. Or create `.env.local` with your configuration
3. Set `APP_BASE_URL` to your public URL

### GitHub redirects to localhost instead of your domain

**Cause:** `APP_BASE_URL` is not set, so fallback code used localhost.

**Fix:** Set `APP_BASE_URL` to your ngrok domain or production domain.

### Webhooks don't arrive at your app

**Cause:** GitHub is sending webhooks to the wrong URL (probably localhost).

**Fix:**
1. Verify `APP_BASE_URL` is set correctly
2. Check GitHub App webhook URL setting matches your `APP_BASE_URL`
3. Restart the web server after changing environment

## Changing Configuration

To switch environments while the server is running:

1. Update `.env.local` with new `APP_BASE_URL`
2. Restart the web server: `npm run dev:web`
3. Restart API server if needed: `npm run dev:api`

Changes take effect on next request.

## Production Deployment

For production or staging:

1. Set environment variables in your deployment platform:
   - Render: Environment tab
   - Vercel: Environment Variables
   - Docker: Build args or `docker run -e APP_BASE_URL=...`
   - Traditional server: `.env` file or system environment

2. Never commit sensitive credentials to git
3. Use unique secrets for each environment
4. Keep `APP_BASE_URL` consistent across all services

## Verification

To verify configuration is correct:

```bash
# Check what URL would be generated
node -e "
const env = process.env.APP_BASE_URL;
console.log('APP_BASE_URL:', env);
console.log('GitHub callback would be:', env + '/api/repositories/github/callback');
console.log('Webhook would be:', env + '/api/repositories/webhooks/github');
"
```

Or inspect the running app's logs for `APP_BASE_URL` warnings.
