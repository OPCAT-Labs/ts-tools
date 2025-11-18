# =============================================================================
# CAT Token Tracker Dockerfile
# =============================================================================
# This Dockerfile builds both API and Worker services for CAT Token Tracker.
#
# Usage:
#   Build API:    docker build --target api -t cat-token-tracker-api .
#   Build Worker: docker build --target worker -t cat-token-tracker-worker .
#
# Tracker Runtime Dependencies:
# - @opcat-labs/cat-tracker (main application)
# - @opcat-labs/cat-sdk (CAT protocol SDK)
# - @opcat-labs/opcat (OP_CAT protocol implementation)
# - @opcat-labs/scrypt-ts-opcat (sCrypt TypeScript library for OP_CAT)
#
# Dependency Chain:
# tracker → cat-sdk → scrypt-ts-opcat → opcat
#         ↘ opcat
# =============================================================================

# Build stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy root workspace configuration
COPY package.json yarn.lock turbo.json tsconfig.base.json ./

# Copy all packages
COPY packages ./packages

# Install dependencies first (before removing any packages)
RUN yarn install --frozen-lockfile

# Remove packages we don't need to build
RUN rm -rf packages/examples packages/integration-examples

# Build packages individually to handle cat-sdk specially
# Build dependencies first
RUN cd packages/scrypt-ts-opcat && yarn build
RUN cd packages/scrypt-ts-transpiler-opcat && yarn build
RUN cd packages/scrypt-ts-cli-opcat && yarn build

# Build cat-sdk without contract compilation (use existing artifacts)
RUN cd packages/cat-sdk && \
    npx rimraf dist && \
    yarn run build:cjs && \
    yarn run build:esm && \
    npx -y cpy-cli artifacts dist/

# Build tracker
RUN cd packages/tracker && yarn build

# =============================================================================
# Production base stage (shared by API and Worker)
# =============================================================================
FROM node:22-alpine AS production-base

# Install runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy entire built workspace
COPY --from=builder /app ./

# Set to tracker directory
WORKDIR /app/packages/tracker

# Set common environment variable
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# =============================================================================
# API service (target: api)
# =============================================================================
FROM production-base AS api

# Set API-specific environment variables
ENV API_PORT=3000

# Expose API port
EXPOSE 3000

# Start the API server
CMD ["node", "dist/main-api.js"]

# =============================================================================
# Worker service (target: worker)
# =============================================================================
FROM production-base AS worker

# Set Worker-specific environment variables
ENV WORKER_PORT=3001

# Expose worker port
EXPOSE 3001

# Start the worker server
CMD ["node", "dist/main-worker.js"]
