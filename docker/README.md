# CAT Token Tracker Docker Guide

## Quick Start

### 1. Configure Environment

Copy the example environment file and configure with your settings:

```bash
cp packages/tracker/.env.example .env.docker
```

Then edit `.env.docker` with your own configuration (database credentials, RPC node, etc.).

### 2. Start Services

**Option 1: Auto-build (Development)**
```bash
cd docker
docker-compose -f docker-compose-build.yml up -d --build
```

**Option 2: Pre-built Images (Production)**
```bash
# Build images first
docker build -f docker/Dockerfile --target api -t cat-token-tracker-api .
docker build -f docker/Dockerfile --target worker -t cat-token-tracker-worker .

# Start services
cd docker
docker-compose up -d
```

### 3. Common Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f worker

# Check status
docker-compose ps

# Stop services
docker-compose down

# Restart services
docker-compose restart
```

## Services

- **API**: REST API service on port 3002
- **Worker**: Background task processor on port 3001
- **Image Size**: ~924MB per service

## Architecture

Multi-stage Dockerfile with:
- **builder**: Builds application and dependencies
- **production-base**: Shared production base
- **api**: API service image
- **worker**: Worker service image
