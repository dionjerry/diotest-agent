# DioTest API

Phase 1 Fastify backend for DioTest.

Current scope:
- health and readiness endpoints
- onboarding persistence APIs
- bootstrap payload for the web app
- GitHub connection boundary persistence
- system and integration settings persistence

## Endpoints

Public:
- `GET /`
- `GET /health`
- `GET /ready`

Internal:
- `GET /bootstrap?userId=...`
- `POST /organizations`
- `POST /projects`
- `POST /github-connections`
- `POST /integrations`
- `POST /system-settings`

Internal routes require the `x-internal-api-key` header.

## Environment

Use the repo-root `.env` file as the single local source of truth.
Copy the repo-root `.env.example` to `.env` and fill in:
- `PORT`
- `HOST`
- `DATABASE_URL`
- `INTERNAL_API_KEY`
- `SETTINGS_ENCRYPTION_KEY`
- `DEBUG_BACKEND`

`DEBUG_BACKEND=true` enables extra structured debug logs for request lifecycle, provider failures, and save/update flows. It is opt-in and intended for local troubleshooting.

## Development

From the repo root:
- `npx prisma migrate deploy`
- `npm run dev:api`
- `npm run build:api`
- `npm run typecheck:api`
