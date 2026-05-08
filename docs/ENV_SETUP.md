# Environment Setup

This repo uses the repo-root [`.env.example`](../.env.example) as the canonical template for local development.

## Local Env File

1. Copy [`.env.example`](../.env.example) to `.env` at the repo root.
2. Fill in the required values.
3. Restart the dev server after any `.env` change.

Base local commands:

```bash
cp .env.example .env
npx prisma migrate deploy
npm run dev:web
```

## Core Variables

These variables are required for the web app to boot correctly:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `SETTINGS_ENCRYPTION_KEY`
- `DATABASE_URL`
- `API_BASE_URL`
- `INTERNAL_API_KEY`

Typical local values:

```env
NEXTAUTH_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
```

If you expose the web app through ngrok or another tunnel, set `NEXTAUTH_URL` to that public URL instead.

Example:

```env
NEXTAUTH_URL=https://your-public-tunnel.ngrok-free.dev
```

## SMTP Setup

Password reset requires valid SMTP credentials:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`

Example Gmail SMTP configuration:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="DioTest <your-email@gmail.com>"
SMTP_SECURE=true
```

## Google OAuth Setup

If you want Google sign-in enabled, provide:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

If you are not using Google sign-in locally, these can stay empty.

## GitHub Repository Provider Setup

The onboarding repository step uses a GitHub App, not a GitHub personal access token.

If you need the product meaning of the repository step, including what `Default branch` means, why DioTest uses a GitHub App, and what automatic webhook configuration does, see [docs/concepts/repository-onboarding.md](./concepts/repository-onboarding.md).

Required variables:

- `GITHUB_APP_ID`
- `GITHUB_APP_NAME`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_API_BASE_URL`
- `GITHUB_APP_BASE_URL`

Typical defaults:

```env
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_APP_BASE_URL=https://github.com
```

### Create the GitHub App

1. Open `https://github.com/settings/apps`
2. Click `New GitHub App`
3. Fill in:
   - `GitHub App name`: your app name, for example `DioTestAgent`
   - `Homepage URL`: your local public URL, for example `https://your-public-tunnel.ngrok-free.dev/`
   - `Setup URL`: `https://your-public-tunnel.ngrok-free.dev/api/repositories/github/callback`
   - `Webhook URL`: `https://your-public-tunnel.ngrok-free.dev/api/repositories/webhooks/github`
   - `Webhook secret`: any long random string
4. Leave `Callback URL` empty unless you explicitly enable GitHub user OAuth during installation.
5. Leave `Request user authorization (OAuth) during installation` unchecked for the current DioTest flow.

### GitHub App Permissions

Repository permissions:

- `Metadata`: `Read-only`
- `Contents`: `Read-only`
- `Pull requests`: `Read-only`
- `Issues`: `Read-only`
- `Webhooks`: `Read and write`

### GitHub App Events

Subscribe only to the events currently used by the webhook setup:

- `Push`
- `Pull request`
- `Pull request review`
- `Issue comment`

### Copy Values Into `.env`

After the app is created:

1. Copy `App ID` into `GITHUB_APP_ID`
2. Copy `GitHub App name` into `GITHUB_APP_NAME`
3. Copy the webhook secret into `GITHUB_WEBHOOK_SECRET`
4. Generate a private key from the app settings and download the `.pem`
5. Copy the full `.pem` contents into `GITHUB_APP_PRIVATE_KEY`

Example:

```env
GITHUB_APP_ID=1234567
GITHUB_APP_NAME=DioTestAgent
GITHUB_WEBHOOK_SECRET=replace-with-a-random-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
```

Important:

- Use the full private key contents, not the SHA256 fingerprint.
- If your public tunnel URL changes, update the GitHub App URLs and `NEXTAUTH_URL`.
- Keep the GitHub App `Webhook URL` static at the app level.
- DioTest creates the project-specific repository webhook automatically during Step 4 using a URL like `/{orgSlug}/{projectId}/webhooks/github`.
- If an older repository connection still points to a previous webhook URL format, reconnect or resave Step 4 so DioTest can reprovision it.

## GitLab Repository Provider Setup

The onboarding repository step uses GitLab OAuth plus a project/group token.

Required variables:

- `GITLAB_BASE_URL`
- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`

Typical default:

```env
GITLAB_BASE_URL=https://gitlab.com
```

### Create the GitLab OAuth App

1. Open your GitLab application settings
2. Create a new OAuth application
3. Set the redirect URI to:

```text
https://your-public-tunnel.ngrok-free.dev/api/repositories/gitlab/callback
```

4. Copy:
   - `Application ID` into `GITLAB_CLIENT_ID`
   - `Secret` into `GITLAB_CLIENT_SECRET`

Recommended scopes for the current flow:

- `read_user`
- `read_api`

## Trello Integration Setup

Trello onboarding uses an API key and token.

1. Open `https://trello.com/app-key`
2. Generate or copy the API key
3. Generate a token from the same page
4. Copy the board ID from the Trello board URL
5. Optionally copy a default list ID if you want cards created in a specific list

Values you will use in DioTest:

- `apiKey`
- `token`
- `boardId`
- `defaultListId` (optional)


If you need the product meaning of integrations, saved secrets, AI settings, or the Step 5 extension connection, see [docs/concepts/settings-and-integrations.md](./concepts/settings-and-integrations.md).

## Jira Integration Setup

Jira onboarding uses an Atlassian email plus API token.

1. Confirm your Jira base URL, for example:
   - `https://your-team.atlassian.net`
2. Copy the project key from the Jira project
3. Open `https://id.atlassian.com/manage-profile/security/api-tokens`
4. Create an API token
5. Use these values in DioTest:
   - Jira base URL
   - project key
   - Atlassian account email
   - Jira API token

## Troubleshooting

### GitHub connect fails before redirect

Check:

- `GITHUB_APP_ID`
- `GITHUB_APP_NAME`
- `GITHUB_APP_PRIVATE_KEY`
- `NEXTAUTH_URL`

### GitLab connect fails before redirect

Check:

- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`
- `NEXTAUTH_URL`

### Repository list says "Connect GitHub first" or "Connect GitLab first"

This usually means the provider session cookie was never created or has expired. Retry the provider connection flow from onboarding.

### Private key errors

If GitHub App token creation fails:

- confirm the `.pem` contents were copied, not the fingerprint
- confirm the key is wrapped in quotes in `.env`
- confirm the key still starts with `-----BEGIN RSA PRIVATE KEY-----`
