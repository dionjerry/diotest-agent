# DioTest Web

Phase 1 Next.js web application for DioTest.

Current scope:
- public landing page
- email/password auth with Auth.js
- Google OAuth-ready wiring
- onboarding with persisted organization, project, GitHub, and setup defaults
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

## Integration Credentials

### Trello

To create Trello credentials for DioTest:
- go to `https://trello.com/app-key`
- create an API key there
- on the same App Key / App details page, generate a token
- use those values in DioTest as:
  - `apiKey`
  - `token`

You will also need your Trello `boardId`, and optionally a `defaultListId` if you want DioTest to create cards in a specific list.
