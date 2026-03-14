# Contributing

1. Install dependencies: `npm install`
2. Run tests: `npm run test`
3. Run lint + typecheck + test + build: `npm run lint && npm run typecheck && npm run test && npm run build`
4. Create a feature branch from `develop`: `feat/<short-name>`
5. Open PR into `develop` with clear summary and linked issue

## Branching Model

- `main`: production-ready only
- `develop`: staging/integration
- `feat/*`: feature branches, merged into `develop`
- Example feature branch: `feat/pr-context-extractor`

## Release Flow

1. Merge validated feature PRs into `develop`
2. Promote to production by merging `develop` into `main`
3. Create a release tag on `main` (for example: `v0.1.0`)

## PR Checklist

- Branch name follows `feat/*`, `fix/*`, or `chore/*`
- Target branch is `develop` (except release promotion PRs)
- `npm run lint`, `npm run typecheck`, and `npm run test` pass
- PR includes testing notes and scope summary
