# Governance

- Maintainers review and merge PRs.
- Required checks: lint, typecheck, tests.
- Breaking schema changes require version bump and migration note.
- Direct pushes to `main` are not allowed by policy.
- `main` is production-ready only; all integration happens in `develop`.
