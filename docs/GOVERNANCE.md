# Governance

- Maintainers review and merge PRs.
- Required checks: lint, typecheck, tests, build.
- Breaking schema changes require version bump and migration note.
- Direct pushes to `main` are not allowed by policy.
- Direct pushes to `staging` are not allowed by policy.
- `main` is production-ready only.
- `staging` is the release-validation and QA branch.
- `develop` is the active integration branch for feature work.
- Normal promotion flow is `develop` -> `staging` -> `main`.
- Production hotfixes must be back-merged into `staging` and `develop`.
- CI required checks are named: `lint`, `typecheck`, `test`, and `build`.
- Branch protection configuration is documented in `docs/BRANCH_PROTECTION.md`.
