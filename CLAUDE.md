# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RMF Platform** (Rwanda Market Facilitator) — a full-stack e-commerce marketplace for Rwanda. It is a monorepo with:
- 12 NestJS microservices (`apps/*-service`)
- 1 Next.js web frontend (`apps/frontend`)
- 1 Expo React Native mobile app (`mobile-app/`)
- 6 shared packages (`packages/`)

Production domain: `rwshop.org`

---

## Commands

### Root (Turbo monorepo)

```bash
# Start all services concurrently (builds @rmf/database first)
npm run dev

# Build everything
npm run build

# Lint everything
npm run lint

# Test everything
npm run test

# Seed the database (runs market-service seed)
npm run seed
```

### Individual microservice (from root)

```bash
# Dev watch mode for a single service
npm run dev --workspace user-service

# Run tests for a single service
npm run test --workspace user-service

# Run a single test file
cd apps/user-service && npx jest src/auth/auth.service.spec.ts
```

### Frontend (Next.js)

```bash
cd apps/frontend
npm run dev       # Turbopack dev server on :3000
npm run build
npm run lint
```

### Mobile app (Expo)

```bash
cd mobile-app
npx expo start         # Interactive launcher
npx expo start --android
npx expo start --ios
npm run typecheck      # tsc --noEmit
```

### Local infrastructure (Docker)

```bash
docker compose up -d   # MongoDB :27017, Redis :6379, MailDev SMTP :1025 / UI :1080, Mongo Express :8081
```

---

## Architecture

### Monorepo tooling

- **Turbo** (`turbo.json`) orchestrates builds, dev, lint, and test across workspaces.
- **npm workspaces**: `apps/*` and `packages/*` are all linked at the root.
- `npm run dev` at the root first builds `@rmf/database`, then starts all 13 apps concurrently with `--concurrency=20`.

### Shared packages (`packages/`)

| Package | Name | Purpose |
|---|---|---|
| `database` | `@rmf/database` | Mongoose schemas shared by all services |
| `auth` | `@rmf/auth` | JWT + Google OAuth Passport strategies |
| `shared-types` | `@rmf/shared-types` | TypeScript enums and DTOs |
| `shared-utils` | `@rmf/shared-utils` | Common utility functions |
| `location` | `@rmf/location` | Geocoding helpers |
| `health-check` | `@rmf/health-check` | `@nestjs/terminus` wrapper for all services |

**Important:** Changes to `@rmf/database` require a rebuild (`npm run build --workspace @rmf/database`) before services pick them up in dev mode. The root `npm run dev` script does this automatically on startup.

### Microservices

All services run NestJS 11 on Express. Each exposes:
- Base path: `/api/v1`
- Health check: `GET /api/v1/health`

Default dev ports:

| Service | Port |
|---|---|
| user-service | 3001 |
| market-service | 3002 |
| product-service | 3003 |
| order-service | 3004 |
| delivery-service | 3005 |
| wallet-service | 3006 |
| notification-service | 3007 |
| admin-service | 3008 |
| seller-service | 3009 |
| rider-service | 3010 |
| review-service | 3011 |

Services call each other over HTTP using the `*_SERVICE_URL` env vars. Cross-service requests are authenticated with the `INTERNAL_SERVICE_SECRET` header.

### Frontend (`apps/frontend`)

Next.js 16 app using the App Router. Uses Tailwind CSS, Axios for API calls, Leaflet/react-leaflet for maps, Recharts for dashboards, Socket.IO client for real-time, and Zod + react-hook-form for forms. No React Query or Redux — server state is managed via Axios + local React state.

### Mobile app (`mobile-app/`)

Expo SDK 54 with Expo Router v6 (file-based routing). Tabs live under `app/(tabs)/`. Auth screens under `app/(auth)/`. Feature modules (`seller/`, `rider/`, `wallet/`, etc.) are top-level route groups. Tokens stored in `expo-secure-store`; general persistence in `AsyncStorage`.

### Database

MongoDB via Mongoose. All schemas are defined in `packages/database/` and imported by services — do not duplicate schema definitions inside individual service directories. Key schemas: `User`, `Product`, `Order`, `Wallet`, `Delivery`, `SellerProfile`, `RiderProfile`, `Review`, `Transaction`, `LedgerEntry`, `PayoutRequest`, `AuditLog`.

### Auth flow

1. User logs in via `user-service` (`POST /api/v1/auth/login` or Google OAuth).
2. `user-service` returns a JWT signed with `JWT_SECRET`.
3. Frontend/mobile stores the token and sends it as `Authorization: Bearer <token>`.
4. Each service validates the token using the shared `@rmf/auth` Passport JWT strategy.
5. Service-to-service calls add an `x-internal-secret: <INTERNAL_SERVICE_SECRET>` header instead.

### Payments / Wallet

`wallet-service` holds funds. Supported gateways: PayPack, MTN Mobile Money, Airtel Money. Payout requests flow through `PayoutRequest` → `LedgerEntry` → gateway disbursement. See the PayPack integration in `wallet-service/src/` for the escrow/balance-hold pattern.

---

## Environment Setup

Copy `.env.example` (or the per-service `.env.example` files) to `.env` at the repo root. Key variables:

```
MONGODB_URI=mongodb://127.0.0.1:27017/rmf-platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
INTERNAL_SERVICE_SECRET=<secret>
```

For local dev, Docker Compose provides MongoDB, Redis, and MailDev (SMTP). No cloud credentials are required for basic local development.

---

## Testing

Each NestJS service uses Jest with `ts-jest`. Test files match `**/*.spec.ts` under `src/`. Run with `--passWithNoTests` so services without tests don't fail the pipeline.

```bash
# All tests
npm run test

# Single service, watch mode
cd apps/order-service && npx jest --watch

# Coverage for a service
cd apps/order-service && npm run test:cov
```

---

## Deployment

Production is deployed to **Render** (`render.yaml`). Build and start entry points are `build.sh` and `start.sh` at the repo root, which delegate to Turbo with the service name as the filter. Health checks at `/api/v1/health` must pass before traffic is routed.
