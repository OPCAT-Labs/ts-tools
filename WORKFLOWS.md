# GitHub Actions Workflows

## 📋 Workflows Overview

### test.yml
**When:** Automatically triggered on push to `main` or pull request to `main`

**What it does:**
1. Runs on Ubuntu with Node.js 22
2. Checkout code with submodules
3. Install dependencies: `yarn install`
4. Build packages: `yarn build`
5. Run tests: `yarn test`

**Triggers:**
- Push to `main` branch
- Pull request targeting `main` branch

**Purpose:** Ensures code quality by running automated tests on every commit and PR.

---

### claude-pr-review.yml
**When:** Automatically triggered when a PR is opened, updated, or ready for review

**What it does:**
1. Validates API credentials (ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL)
2. Installs Claude Code CLI
3. Extracts PR diff (excluding lock files)
4. Reviews code using Claude Code CLI with expert prompts
5. Posts or updates review comment on the PR
6. Supports incremental reviews (updates existing review with status markers)

**Triggers:**
- Pull request opened, synchronize, reopened, or marked ready for review
- Only runs on non-draft PRs

**Secrets Required:**
- `ANTHROPIC_AUTH_TOKEN` - Anthropic API authentication token
- `ANTHROPIC_BASE_URL` - Anthropic API base URL

**Features:**
- Automated code review with AI expertise in Bitcoin/cryptocurrency codebases
- Incremental review updates (marks issues as ✅ RESOLVED, ⚠️ PARTIALLY RESOLVED, ❌ NOT FIXED)
- Cost warnings based on PR size (>2k, >5k, >50k lines)
- Updates existing review comment instead of creating new ones

---

### test-publish-beta.yml
**When:** Automatically triggered on push to `beta-release` branch (when workflow or script files change)

**What it does:**
1. Uses current commit SHA and `version_core = 2.0.0`
2. Constructs `full_version = 2.0.0-beta-{short_sha}-{date}`
3. Calls `build-and-publish.yml` to test the entire release process

**Triggers:**
- Push to `beta-release` branch
- Only when `.github/workflows/**` or `scripts/**` files change

**Purpose:** Validate beta release workflow before merging to main.

**⚠️ Warning:** This will actually publish to npm with version `2.0.0-beta-{current_commit_sha}-YYYYMMDD`

---

### publish-beta.yml
**When:** User manually triggers via GitHub Actions UI

**What it does:**
1. Accepts user inputs: `commit_sha` + `version_core`
2. Constructs `full_version = {version_core}-beta-{short_sha}-{date}`
3. Calls `build-and-publish.yml` with the constructed version

**Inputs:**
- `commit_sha` (required) - Git commit hash (8-char or full)
- `version_core` (required) - Semver core version (e.g., `1.0.5`)

**Example:**
```
commit_sha:    9e83e4c0
version_core:  1.0.5
```

**Result:**
```
full_version: 1.0.5-beta-9e83e4c0-20241116
npmTag: beta
```

---

### build-and-publish.yml
**When:** Called by `publish-beta.yml` (reusable workflow)

**What it does:**
1. Checkout code at specified commit
2. Install dependencies: `yarn install --frozen-lockfile`
3. Build packages: `yarn build`
4. Update all package.json to `full_version`
5. Check if version already exists on npm (fails if exists)
6. Publish to npm with specified `npmTag`

**Inputs:**
- `commit_sha` (required) - Git commit to build
- `full_version` (required) - Complete version string (e.g., `1.0.5-beta-a1b2c3d4-20241116`)
- `npmTag` (required) - NPM dist tag (e.g., `beta`)

**Secrets:**
- `NPM_TOKEN` - NPM authentication token

---

## 🚀 How to Use

### Publish Beta Version

1. **Go to GitHub Actions**
   ```
   Actions → "Publish Beta" → Run workflow
   ```

2. **Fill in inputs:**
   ```
   commit_sha:    9e83e4c0       (or full hash)
   version_core:  1.0.5          (semver format)
   ```

3. **Click "Run workflow"**

4. **Result:**
   - All packages published as `1.0.5-beta-9e83e4c0-20241116`
   - NPM tag: `beta`

---

## 🔄 Workflow Call Chain

```
User triggers publish-beta.yml
  │
  ├─ Input: commit_sha = 9e83e4c0
  ├─ Input: version_core = 1.0.5
  │
  ├─ Construct: full_version = 1.0.5-beta-9e83e4c0-20241116
  │
  └─ Calls: build-and-publish.yml
       │
       ├─ Checkout @ 9e83e4c0
       ├─ yarn install && yarn build
       ├─ update-version.js 1.0.5-beta-9e83e4c0-20241116
       ├─ check-versions.js 1.0.5-beta-9e83e4c0-20241116
       └─ publish-packages.js beta
```

---

## 📦 Published Packages

All public packages get the same `full_version`:

```
@opcat-labs/scrypt-ts-opcat@1.0.5-beta-9e83e4c0-20241116
@opcat-labs/cat-sdk@1.0.5-beta-9e83e4c0-20241116
@opcat-labs/opcat@1.0.5-beta-9e83e4c0-20241116
```

Install:
```bash
npm install @opcat-labs/scrypt-ts-opcat@beta
```

---

## 🔧 Scripts Used

### update-version.js
Updates all package.json files to specified `full_version`.

**Usage:**
```bash
node scripts/update-version.js <full-version>
```

**Example:**
```bash
node scripts/update-version.js 1.0.5-beta-9e83e4c0-20241116
```

---

### check-versions.js
Checks if `full_version` already exists on npm.

**Usage:**
```bash
node scripts/check-versions.js <full-version>
```

**Exit codes:**
- `0` - Version doesn't exist (ready to publish)
- `1` - Version exists (publish will fail)

---

### publish-packages.js
Publishes all public packages to npm with specified tag.

**Usage:**
```bash
node scripts/publish-packages.js <npmTag>
```

**Example:**
```bash
node scripts/publish-packages.js beta
```

---

## 🧪 Local Testing

Test the scripts manually before publishing:

```bash
# 1. Construct full_version
FULL_VERSION="1.0.5-beta-9e83e4c0-20241116"

# 2. Backup package.json files
find packages -name "package.json" -not -path "*/node_modules/*" -exec cp {} {}.backup \;

# 3. Test update
node scripts/update-version.js "$FULL_VERSION"

# 4. Test check
node scripts/check-versions.js "$FULL_VERSION"

# 5. View changes
git diff packages/*/package.json

# 6. Restore
find packages -name "package.json.backup" -exec sh -c 'mv "$1" "${1%.backup}"' _ {} \;
```

---

## ⚙️ Setup

### Required: NPM Token

1. Generate token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Type: **Automation**
   - Permissions: **Read and Publish**

2. Add to GitHub:
   - Settings → Secrets and variables → Actions
   - New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your token

---

## 🎯 Version Format

```
1.0.5-beta-9e83e4c0-20241116
  │     │      │        │
  │     │      │        └─ commit_date (auto-generated)
  │     │      └────────── commit_sha (first 8 chars)
  │     └───────────────── npmTag (fixed: beta)
  └─────────────────────── version_core (user input)
```

**Components:**
- `version_core`: From user input (e.g., `1.0.5`)
- `npmTag`: Fixed to `beta` in publish-beta.yml
- `commit_sha`: From user input, truncated to 8 chars
- `commit_date`: Auto-generated (YYYYMMDD format)

---

## 🐛 Troubleshooting

### "Version already exists"
**Cause:** This exact version was already published.

**Fix:** Use a different commit or version_core.

**Check:**
```bash
npm view @opcat-labs/scrypt-ts-opcat versions | grep 1.0.5-beta
```

---

### "Authentication failed"
**Cause:** Invalid or missing NPM_TOKEN.

**Fix:**
1. Check GitHub Secrets: Settings → Secrets → Actions
2. Verify NPM_TOKEN exists and is valid
3. Regenerate token if needed

---

### "Build failed"
**Cause:** Build errors in the code.

**Fix:**
1. Test locally: `yarn install && yarn build`
2. Fix any errors
3. Commit and push
4. Use the new commit SHA

---

## 📊 Example Scenarios

### Scenario 1: Regular Beta Release

**Goal:** Publish current code as beta for testing

**Steps:**
1. Get latest commit: `git log --oneline | head -1`
2. Actions → Publish Beta
3. Input: `commit_sha = 9e83e4c0`, `version_core = 1.0.5`
4. Result: `1.0.5-beta-9e83e4c0-20241116`

---

### Scenario 2: Preparing Major Version

**Goal:** Test next major version before release

**Steps:**
1. Get commit: `git log --oneline | head -1`
2. Actions → Publish Beta
3. Input: `commit_sha = a1b2c3d4`, `version_core = 2.0.0`
4. Result: `2.0.0-beta-a1b2c3d4-20241116`

---

### Scenario 3: Publishing Old Commit

**Goal:** Publish a specific older commit as beta

**Steps:**
1. Find commit: `git log --oneline | grep "feature"`
2. Actions → Publish Beta
3. Input: `commit_sha = abcd1234`, `version_core = 1.0.5`
4. Result: `1.0.5-beta-abcd1234-20241116`

---

## 🔍 Verify Published Version

```bash
# View all versions
npm view @opcat-labs/scrypt-ts-opcat versions

# View latest beta
npm view @opcat-labs/scrypt-ts-opcat@beta

# View package details
npm view @opcat-labs/scrypt-ts-opcat@1.0.5-beta-9e83e4c0-20241116

# Check dist tags
npm dist-tag ls @opcat-labs/scrypt-ts-opcat
```

---

## 📚 Files

### Workflows
- `.github/workflows/test.yml` - Automated testing on push/PR
- `.github/workflows/claude-pr-review.yml` - Automated AI code review on PRs
- `.github/workflows/test-publish-beta.yml` - Auto test beta release on beta-release branch
- `.github/workflows/publish-beta.yml` - Manual beta release workflow
- `.github/workflows/build-and-publish.yml` - Reusable build & publish workflow

### Scripts
- `scripts/update-version.js` - Update package versions
- `scripts/check-versions.js` - Check version existence
- `scripts/publish-packages.js` - Publish to npm

### Documentation
- `WORKFLOWS.md` - This file

---

**Last Updated:** 2025-11-16
