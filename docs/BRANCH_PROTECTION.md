# Branch Protection Setup

Apply these settings in GitHub repository settings.

## Main branch (`main`)

- Require a pull request before merging: enabled
- Require approvals: 1+
- Require status checks to pass before merging: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Require branches to be up to date before merging: enabled
- Restrict who can push to matching branches: enabled (maintainers only or nobody)
- Allow force pushes: disabled
- Allow deletions: disabled

## Staging branch (`staging`)

- Require a pull request before merging: enabled
- Require approvals: 1+
- Require status checks to pass before merging: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Require branches to be up to date before merging: enabled
- Restrict who can push to matching branches: enabled (maintainers only or nobody)
- Allow force pushes: disabled
- Allow deletions: disabled

## Develop branch (`develop`)

- Require a pull request before merging: enabled
- Require status checks to pass before merging: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Require branches to be up to date before merging: enabled
- Allow force pushes: disabled
- Allow deletions: disabled

## Promotion intent

- Feature branches open PRs into `develop`
- Promotion PRs move validated work from `develop` into `staging`
- Release PRs move validated staging candidates from `staging` into `main`
- Hotfixes merged into `main` must be back-merged into `staging` and `develop`

## Environments

Create three environments under `Settings > Environments`:

- `development`
- `staging`
- `production`

Recommended branch mapping:

- `develop` -> `development`
- `staging` -> `staging`
- `main` -> `production`

Optionally add required reviewers for `staging` and `production` deployments.
