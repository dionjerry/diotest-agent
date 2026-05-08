# DioTest Agent — Startup Checklist

This document tracks what gets checked and initialized when you run `npm run dev:web`, `npm run dev:api`, or `npm run dev`.

## Pre-Startup Validation

When you run any dev command, the environment is validated by `scripts/validate-env.mjs`. This checks:

### ✓ Required Variables (Must be set)
- `APP_BASE_URL` — Public URL where the app is accessed (e.g., https://your-ngrok-domain.ngrok-free.dev)
- `NEXTAUTH_URL` — Should match APP_BASE_URL for OAuth callbacks
- `NEXTAUTH_SECRET` — Session encryption key (must be 32+ chars, consistent across instances)
- `SETTINGS_ENCRYPTION_KEY` — Settings encryption key for project secrets
- `DATABASE_URL` — PostgreSQL connection string
- `API_BASE_URL` — Backend API URL (default: http://localhost:4000)
- `INTERNAL_API_KEY` — Key for internal API requests between services

### ⚠️ Optional Variables (Feature-dependent)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `GITHUB_APP_ID` / `GITHUB_APP_NAME` / `GITHUB_APP_PRIVATE_KEY` — GitHub integration
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` — GitLab OAuth
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — Password reset emails

## Module-Specific Initialization

### Web Module (`npm run dev:web`)

**File:** `apps/web/lib/env.ts`

Checks on startup:
1. ✓ APP_BASE_URL is set (required for GitHub callbacks and webhook URLs)
2. ✓ NEXTAUTH_SECRET is set (required for session encryption)
3. ✓ SETTINGS_ENCRYPTION_KEY is set (required for project secrets)
4. ✓ DATABASE_URL is set (required for Prisma)

If any check fails, the web server **will not start** and displays which variable is missing.

**Common Issues:**
- "Can't reach database server" → PostgreSQL not running (`brew services start postgresql`)
- "no matching decryption secret" → NEXTAUTH_SECRET mismatch (see `.env` vs `.env.local`)
- "APP_BASE_URL environment variable is required" → Not set in `.env` or `.env.local`

### API Module (`npm run dev:api`)

**File:** `apps/api/src/env.ts`

Checks on startup:
1. ✓ DATABASE_URL is set (Zod validation)
2. ✓ INTERNAL_API_KEY is set (Zod validation)
3. ✓ SETTINGS_ENCRYPTION_KEY is set (Zod validation)
4. ✓ PORT is numeric (default: 4000)
5. ✓ HOST is valid (default: 0.0.0.0)

If validation fails, displays all missing/invalid fields with error messages.

**Common Issues:**
- "PORT is not a number" → PORT env var is not numeric
- "DATABASE_URL is required" → Not set in `.env`

### Environment Validation Script

**File:** `scripts/validate-env.mjs`

Runs before any dev command:

```bash
$ npm run dev:web
> npm run validate:env && node scripts/dev-web.mjs
```

Output includes:
- Required variables status (✓ or ❌)
- SMTP configuration status (fully configured, or missing vars)
- Optional integrations status (how many configured)
- GitHub App connection status
- GitLab OAuth status
- Google OAuth status

**Example output:**
```
📋 [14:23:15] Environment Configuration Validation

============================================================================
✓ Required Variables:
  ✓ APP_BASE_URL - https://lamar-cupped-stepfatherly.ngrok-free.dev
  ✓ NEXTAUTH_URL - https://lamar-cupped-stepfatherly.ngrok-free.dev
  ✓ NEXTAUTH_SECRET - ***
  ✓ SETTINGS_ENCRYPTION_KEY - ***
  ✓ DATABASE_URL - postgresql://...
  ✓ API_BASE_URL - http://localhost:4000
  ✓ INTERNAL_API_KEY - ***

📧 SMTP Configuration:
  ✓ SMTP is configured
    Host: smtp.gmail.com
    Port: 465
    From: DIoTest - <mydownloads442@gmail.com>

⚙️ Optional Variables:
  1/3 configured
  ✓ GitHub App is configured
  ⚠️ GitLab OAuth is not configured
  ⚠️ Google OAuth is not configured

============================================================================
✓ Configuration is valid - ready to start
```

## Secret Configuration Best Practices

### NEXTAUTH_SECRET & SETTINGS_ENCRYPTION_KEY

**Important:** These should be the same across all instances to prevent session/decryption errors.

- **Local Development:** Use values from `.env` (checked into git as examples)
- **Staging/Production:** Use strong random strings generated with `openssl rand -base64 32`
- **Do not override in `.env.local`** → Use `.env` as single source of truth

To generate a new secret:
```bash
openssl rand -base64 32
```

### Database Connection

**PostgreSQL on Mac:**
```bash
# Start the database
brew services start postgresql

# Check if running
brew services list | grep postgresql

# Stop the database
brew services stop postgresql
```

**Supabase (Remote):**
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
```

**Local Docker PostgreSQL:**
```bash
docker run -d --name diotest-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=diotest \
  -p 5432:5432 \
  postgres:15
```

## Startup Sequence

When you run `npm run dev` (or `npm run dev:web`):

1. **Environment Validation** (scripts/validate-env.mjs)
   - Checks all REQUIRED_VARS
   - Checks SMTP configuration
   - Reports optional features status
   - **Exits with error code 1 if required vars missing**

2. **Web Module Init** (apps/web/lib/env.ts)
   - Parses .env and .env.local
   - Validates core secrets (APP_BASE_URL, NEXTAUTH_SECRET, etc.)
   - **Exits with error code 1 if validation fails**
   - Logs "Web module configuration validated"

3. **Database Connection** (Next.js startup)
   - Connects to Prisma
   - Runs any pending migrations
   - **Hangs with "PrismaClientInitializationError" if DB is down**

4. **API Module Init** (apps/api/src/env.ts, if running `npm run dev:api`)
   - Parses environment with Zod schema
   - Validates required fields
   - Logs "API module configuration validated"
   - **Exits with error code 1 if validation fails**

5. **Dev Server Ready**
   - Web module: "Ready on http://localhost:3000"
   - API module: "Server is running on 0.0.0.0:4000"
   - Both servers accept requests

## Troubleshooting

### "npm ERR! code ENOENT" when running validate:env

The validation script isn't executable or Node.js isn't finding it.

**Fix:**
```bash
chmod +x scripts/validate-env.mjs
npm run validate:env
```

### "Cannot find module" errors

Modules haven't been installed or dependencies are missing.

**Fix:**
```bash
npm install
npm run prisma:generate
```

### App starts but errors on first request

The database wasn't ready when the validation ran, but is needed for business logic.

**Fix:**
```bash
# Stop the app
brew services start postgresql  # or start your DB
npm run dev:web  # restart, validation will pass again
```

### NEXTAUTH_SECRET mismatch errors during password reset

Two different NEXTAUTH_SECRET values are being used (one in .env, another in .env.local, or changed between restarts).

**Fix:**
1. Set NEXTAUTH_SECRET in `.env` only
2. Remove or comment out NEXTAUTH_SECRET in `.env.local`
3. Restart the server
4. Log out and back in to refresh sessions with the new secret

## Environment Files

### `.env` (Checked into git)
- Contains local development defaults
- Used as fallback for all modules
- Should never contain production secrets

### `.env.local` (Git-ignored)
- Developer-specific overrides (ngrok URLs, personal Gmail keys, etc.)
- Takes precedence over `.env` (loaded with `override: true`)
- **Do not override NEXTAUTH_SECRET or SETTINGS_ENCRYPTION_KEY here**

### CI/CD Systems
- Set environment variables directly in the platform (Vercel, Render, GitHub Actions)
- No `.env` files needed
- All required variables must be explicitly set
