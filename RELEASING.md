# Releasing inei

## How it works

Releases use [changesets](https://github.com/changesets/changesets) for versioning and GitHub Actions for publishing. The flow has three steps:

1. You add a changeset to your feature branch
2. You merge your PR into `main`
3. The bot opens a "Version Packages" PR — you merge that, and CI publishes to npm

## Step by step

### 1. Create a changeset

On your feature branch, before opening a PR:

```bash
pnpm changeset
```

This prompts you for:
- **Package**: select `inei`
- **Bump type**: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
- **Summary**: one-line description of the change

It creates a file like `.changeset/cool-dogs-fly.md`. Commit it with your code.

If you forget, the CI `require-changeset` job will fail on your PR. Add the `skip-release` label to bypass this for PRs that don't need a release (docs, CI changes, etc).

### 2. Merge your PR

Squash and merge your feature PR into `main`. This triggers the release workflow.

The release workflow runs the changesets action, which sees the `.changeset/*.md` file(s) and opens a **"Version Packages"** PR. This PR:
- Bumps `version` in `package.json`
- Updates `CHANGELOG.md`
- Deletes the consumed `.changeset/*.md` files

### 3. Merge the Version Packages PR

Review the version bump and changelog. Merge it (regular merge, not squash).

On merge, the release workflow runs again. This time there are no changesets, so the changesets action is a no-op. The publish step compares the local version against npm — if it's ahead, it runs `npm publish --provenance --access public` using OIDC trusted publishers.

## Auth

Publishing uses npm trusted publishers (OIDC). No `NPM_TOKEN` secret is needed.

The trusted publisher is configured on npmjs.com under the `inei` package settings:
- **Organization/user**: `rajbirjohar`
- **Repository**: `inei`
- **Workflow**: `release.yml`
- **Environment**: (blank)

The GitHub workflow has `id-token: write` permission, which allows the OIDC token exchange with npm.

## Manual publish (emergency)

If CI fails and you need to publish immediately:

```bash
git checkout main
git pull
pnpm build
npm login
npm publish --access public
```

Note: `--provenance` only works in GitHub Actions. Local publishes won't have provenance attestation. This is fine for emergencies.

## Troubleshooting

**CI says "no changeset found"**
You forgot to run `pnpm changeset` and commit the file. Either add one, or apply the `skip-release` label if the PR doesn't need a release.

**Version Packages PR has wrong version**
The bump type (patch/minor/major) comes from the changeset file. If it's wrong, edit the `.changeset/*.md` frontmatter before merging your feature PR.

**Publish fails with 404**
The OIDC token claim doesn't match the trusted publisher config on npmjs.com. Verify the workflow filename is `release.yml` and the repository is `rajbirjohar/inei`. Use the manual publish as a fallback.

**Version is already published**
The publish step skips if npm already has the version. This is normal — it means the Version Packages PR merge didn't change the version (e.g., if you merged a PR with `skip-release`).
