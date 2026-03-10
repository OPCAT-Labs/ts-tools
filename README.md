# ts-tools

A monorepo for OP_CAT-enabled Bitcoin tooling built with sCrypt smart contracts. Provides the full stack for developing, compiling, deploying, and testing CAT20/CAT721 token protocols on Bitcoin.

## Overview

OP_CAT is a Bitcoin opcode that enables powerful covenant constructions. This repository implements the CAT protocol — a token standard for fungible (CAT20) and non-fungible (CAT721) tokens on Bitcoin — using [sCrypt](https://scrypt.io), a TypeScript-based smart contract framework.

## Packages

| Package | Name | Description |
|---|---|---|
| [`cat-sdk`](packages/cat-sdk) | `@opcat-labs/cat-sdk` | Core SDK for CAT protocol: token minting, transferring, burning, and guard logic |
| [`scrypt-ts-opcat`](packages/scrypt-ts-opcat) | `@opcat-labs/scrypt-ts-opcat` | sCrypt TypeScript framework with OP_CAT support: decorators, contract base classes |
| [`scrypt-ts-transpiler-opcat`](packages/scrypt-ts-transpiler-opcat) | `@opcat-labs/scrypt-ts-transpiler-opcat` | TypeScript-to-sCrypt transpiler for OP_CAT contracts |
| [`scrypt-ts-cli-opcat`](packages/scrypt-ts-cli-opcat) | `@opcat-labs/cli-opcat` | CLI tooling for sCrypt OP_CAT project scaffolding and management |
| [`opcat`](packages/opcat) | `@opcat-labs/opcat` | Base OP_CAT opcode implementations and primitives |
| [`tracker`](packages/tracker) | `@opcat-labs/cat-tracker` | Blockchain indexer/tracker service for CAT protocol state |
| [`examples`](packages/examples) | — | Example contracts and usage patterns |
| [`integration-examples`](packages/integration-examples) | — | Integration test examples |

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Yarn 1.22.19

### Install

```bash
yarn install
```

### Build

```bash
yarn build
```

### Test

```bash
yarn test
```

### Lint

```bash
# Auto-fix
yarn lint

# Check only (CI)
yarn lint-check
```

## Architecture

The monorepo uses [Turborepo](https://turbo.build/) for build orchestration with Yarn workspaces. Packages are layered with `opcat` at the base, `scrypt-ts-opcat` building on top of it, and `cat-sdk` providing the high-level protocol implementation.

```
opcat
  └── scrypt-ts-opcat
        ├── scrypt-ts-transpiler-opcat
        ├── scrypt-ts-cli-opcat
        └── cat-sdk
              └── tracker
```

## Contributing

- Keep PRs focused on a single concern
- Include test coverage for new features and bug fixes
- Run `yarn build && yarn test` before submitting
- Use conventional commit messages (`feat:`, `fix:`, `chore:`, etc.)

## Security

- Never commit private keys, mnemonics, or API keys
- Validate all external inputs at system boundaries

## License

MIT — see individual packages for details.
