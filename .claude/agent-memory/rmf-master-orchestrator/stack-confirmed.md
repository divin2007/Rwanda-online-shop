---
name: stack-confirmed
description: Confirmed RMF technology stack and architecture from codebase inspection (2026-06-06) — use before instructing workers
metadata:
  type: project
---

RMF actual stack, confirmed by reading package.json, .env.example, schemas, and service source on 2026-06-06.

- Monorepo: Turborepo + npm workspaces (`apps/*`, `packages/*`).
- Backend: NestJS 11 microservices (12 services), Express platform, TypeScript.
- Frontend: Next.js 16 App Router, React, Tailwind, Socket.IO client. One app serving 4 portals via route groups `(admin)`, `(seller)`, `(rider)`, and public/buyer routes.
- Database: MongoDB via Mongoose. Shared schemas live in `packages/database/src/schemas` (21 schemas incl. wallet, ledger-entry, payout-request, transaction, delivery, rider-profile, seller-profile, audit-log).
- Payments: MTN MoMo is the SOLE gateway as of 2026-06-06 (PayPack + Airtel fully removed — this supersedes the earlier PayPack-primary note). Two credential sets (Collections + Disbursements). Logic in `apps/order-service/src/order/payment.service.ts`; callback path `/api/v1/orders/payment/mtn/callback`. See [[payment-mtn-migration]]. As of 2026-06-07, PayPack branding also removed from all user-facing pages (earnings, admin readiness, tracking, dashboards, footer, notifications, .env.example).
- Wallet/escrow: balance-holding wallet architecture (recent commit 048d4ed) in `apps/wallet-service` + ledger-entry schema.
- Storage: GCS primary via `@rmf/shared-utils` (getGoogleCloudStorageConfig / uploadToGoogleCloudStorage), then S3/R2, then local FS fallback. See `apps/market-service/src/storage/storage.service.ts`.
- Delivery dispatch: PROGRESSIVE_RADIUS strategy in `apps/delivery-service/src/delivery/delivery.service.ts`; fee = ceil(distanceKm/5)*500 RWF. Socket.IO gateways for real-time.
- Auth: JWT (Passport) + Google OAuth + bcrypt. Shared guards/decorators in `packages/auth/src` (jwt.strategy, roles.guard, roles.decorator). JWT access token = 2h with auto-refresh (commit 68430af).
- Notifications: nodemailer (email), SMS via webhook/Africa's Talking, in-app. `apps/notification-service`.
- Deploy: Render (`render.yaml`), Docker Compose for local dev (mongo, mongo-express, redis, maildev). CI in `.github/workflows/main.yml` runs build + test on push/PR to main; deploy steps commented out.

**Why:** Orchestrator must not assume Prisma/PostgreSQL — the docs say "common RMF patterns: Prisma/PostgreSQL" but reality is Mongoose/MongoDB. Payment reality is now MTN-MoMo-only.
**How to apply:** Brief workers with these real paths. Treat MTN MoMo as the only gateway (see [[payment-mtn-migration]]). Never instruct a Prisma migration.
