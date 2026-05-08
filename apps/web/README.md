# DioTest Web

Phase 1 Next.js web application for DioTest.

Current scope:
- public landing page
- email/password auth with Auth.js
- Google OAuth-ready wiring
- onboarding with persisted organization, project, GitHub, and setup defaults
- project-scoped extension connection during onboarding Step 5
- minimal signed-in shell reserved for future Dashboard and Studio work

## Routes

Public:
- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password/[token]`

Protected:
- `/onboarding`
- `/app`
- `/app/projects`
- `/app/settings`
- `/studio`

## Environment

Use the repo-root `.env` file as the single local source of truth.
Copy the repo-root `.env.example` to `.env` and fill in the values there.

Long-form setup instructions live in [docs/ENV_SETUP.md](../../docs/ENV_SETUP.md).

Concepts documentation for onboarding and settings meaning lives in [docs/concepts/README.md](../../docs/concepts/README.md).

For settings, integration, and extension connection semantics, see [docs/concepts/settings-and-integrations.md](../../docs/concepts/settings-and-integrations.md).

Important variables:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `API_BASE_URL`
- `INTERNAL_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`
- `SETTINGS_ENCRYPTION_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_NAME`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`

## Development

From the repo root:
- `npx prisma migrate deploy`
- `npm run dev:web`
- `npm run dev:web:open`
- `npm run clean:web`
- `npm run build:web`
- `npm run typecheck:web`

Expected behavior:
- `npm run dev:web` starts Next.js from the correct app directory with repo-root env loading intact.
- frontend edits under `apps/web/app` and `apps/web/components` should hot reload automatically
- use `npm run dev:web:open` if you want the browser opened automatically
- use `npm run clean:web` only as recovery after the web dev server has been stopped
- do not delete `apps/web/.next` while `next dev` is running

Restart the dev server after:
- `.env` changes
- `next.config.mjs` changes
- auth/runtime server changes under `apps/web/lib`

## Password Reset Email

Password reset uses SMTP and will only send email when these values are set to real credentials:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`

The example placeholder values in `.env.example` are not treated as valid SMTP configuration.

## Provider Setup

For detailed instructions for:

- GitHub App creation
- GitLab OAuth
- Trello credentials
- Jira API tokens

see [docs/ENV_SETUP.md](../../docs/ENV_SETUP.md).

If you need the product meaning of the repository step, including `Default branch`, webhook configuration, provider differences, and what DioTest stores, see [docs/concepts/repository-onboarding.md](../../docs/concepts/repository-onboarding.md).

If you need the product meaning of integration settings, encrypted secrets, or the Step 5 extension connection API key flow, see [docs/concepts/settings-and-integrations.md](../../docs/concepts/settings-and-integrations.md).
