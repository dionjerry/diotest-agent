# Contributing

1. Install dependencies: `npm install`
2. Run tests: `npm run test`
3. Run lint + typecheck + test + build: `npm run lint && npm run typecheck && npm run test && npm run build`
4. Create a feature branch from `develop`: `feat/<short-name>`
5. Open PR into `develop` with clear summary and linked issue

## Branching Model

- `main`: production-ready only
- `staging`: pre-production QA, release validation, and UAT
- `develop`: active integration branch for day-to-day development
- `feat/*`: feature branches, merged into `develop`
- Example feature branch: `feat/pr-context-extractor`

Long-lived promotion path:

1. feature branches -> `develop`
2. `develop` -> `staging`
3. `staging` -> `main`

Default rules:

- do not merge feature branches directly into `main`
- do not use ad hoc cherry-picks for normal promotion
- if a hotfix lands on `main`, back-merge it into `staging` and `develop`

## Release Flow

1. Merge validated feature PRs into `develop`
2. Open a promotion PR from `develop` into `staging`
3. Validate the release candidate in the staging environment
4. Open a release PR from `staging` into `main`
5. Create a release tag on `main` (for example: `v0.1.0`)
6. Back-merge any direct production hotfixes into `staging` and `develop`

## Environment Mapping

- `develop`: dev environment
- `staging`: staging environment
- `main`: production environment

Repository webhooks, public app URLs, and callback URLs should be configured per environment when deployments diverge.

## PR Checklist

- Branch name follows `feat/*`, `fix/*`, or `chore/*`
- Target branch is `develop` for normal feature work
- Promotion PRs target `staging`
- Release PRs target `main`
- `npm run lint`, `npm run typecheck`, and `npm run test` pass
- PR includes testing notes and scope summary
