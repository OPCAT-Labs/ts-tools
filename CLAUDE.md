# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** for OP_CAT-enabled Bitcoin tooling built with sCrypt smart contracts. It provides the full stack for developing, compiling, deploying, and testing CAT20/CAT721 token protocols on Bitcoin.

## Commands

```bash
# Build all packages
yarn build

# Run all tests
yarn test

# Lint and format
yarn lint

# Lint check (CI)
yarn lint-check

# Release
yarn release
```

## Architecture

### Monorepo Structure (`packages/`)

- **cat-sdk** - Core SDK for CAT protocol (token minting, transferring, burning, guard logic)
- **scrypt-ts-opcat** - sCrypt TypeScript framework with OP_CAT support (decorators, contract base classes)
- **scrypt-ts-transpiler-opcat** - TypeScript-to-sCrypt transpiler for OP_CAT contracts
- **scrypt-ts-cli-opcat** - CLI tooling for sCrypt OP_CAT development
- **opcat** - OP_CAT opcode implementations
- **tracker** - Blockchain indexer/tracker service
- **examples** - Example contracts and usage
- **integration-examples** - Integration test examples

### Build System

- Uses **Turborepo** (`turbo.json`) for monorepo build orchestration
- Package manager: **Yarn** (v1.22.19) with workspaces
- TypeScript base config: `tsconfig.base.json`
- Linting: ESLint + Prettier with lint-staged via Husky

### Key Conventions

- sCrypt contracts use `@prop()`, `@method()` decorators from `scrypt-ts-opcat`
- `SmartContractLib` for library classes, `SmartContract` for main contracts
- Contracts must call `loadArtifact()` before use
- Tests use Mocha + Chai
- **Important**: sCrypt doesn't support `let` declarations or early `return` in conditionals - use conditional expressions (ternary operators) instead

## PR Standards

- Keep PRs focused on a single concern
- Include test coverage for new features and bug fixes
- Run `yarn build && yarn test` before submitting
- Use conventional commit messages (feat:, fix:, chore:, etc.)

## Security

- Never commit private keys, mnemonics, or API keys
- Validate all external inputs at system boundaries
- Follow OWASP top 10 guidelines
