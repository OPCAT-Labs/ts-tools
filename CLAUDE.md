# Project Guidelines for Claude

## Overview

This is a TypeScript monorepo for OP_CAT Labs, containing smart contract tools for CAT20/CAT721 token protocols on Bitcoin. Key packages:

- `packages/cat-sdk` — CAT20/CAT721 contract implementations and SDK
- `packages/scrypt-ts-opcat` — sCrypt TypeScript framework for OP_CAT contracts
- `packages/scrypt-ts-transpiler-opcat` — Transpiler for sCrypt contracts
- `packages/opcat` — Core Bitcoin/OP_CAT primitives
- `packages/tracker` — Token indexer/tracker service
- `packages/examples` — Usage examples

## Build & Test

```bash
yarn install          # install dependencies
yarn build            # build all packages (Turborepo, respects dependency order)
yarn test             # run all tests
yarn lint             # lint and format
```

Tests depend on build: always run `yarn build` before `yarn test`, or use `yarn test` which Turborepo handles via `dependsOn: ["build"]`.

## Code Style

- TypeScript strict mode throughout
- Follow existing patterns in each package — do not introduce new abstractions without precedent
- Use named constants instead of magic numbers (see `packages/cat-sdk/src/contracts/constants.ts`)
- Lint/format is enforced via ESLint + Prettier on commit (`lint-staged`)
- Write tests for new functionality

## PR Standards

- Keep PRs small and focused on a single concern
- Always include `Fixes #N` or `Closes #N` in PR descriptions when working from an issue
- Include a brief description of what changed and why
- Run `yarn build && yarn test` locally before opening a PR
- Do not break existing test fixtures in `packages/*/test/fixtures/`

## Commit Standards

- Use conventional commits: `fix:`, `feat:`, `refactor:`, `test:`, `docs:`
- Do not commit build artifacts (`dist/`) — these are gitignored

## Monorepo Rules

- Changes to shared packages (`opcat`, `scrypt-ts-opcat`, `scrypt-ts-transpiler-opcat`) can affect all downstream packages — test broadly
- Package versioning is managed via `@changesets/cli` — do not manually edit `package.json` versions
- Do not add dependencies without checking if they already exist in the workspace root

## Review Standards

- Flag security vulnerabilities, breaking changes, and missing error handling
- Highlight any changes to contract logic or consensus-critical code
- Note missing tests for new functionality

## Security

- Never commit private keys, mnemonics, or API keys
- Contract logic changes require careful review — these contracts handle real funds on Bitcoin mainnet
- Test fixture JSON files (`test/fixtures/*.json`) are auto-generated — do not edit manually; regenerate via the compile scripts
