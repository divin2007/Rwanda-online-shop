# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RMF (Rwanda Market Facilitator) is a digital marketplace platform for Rwandan public markets, deployed at rwshop.org. It is a Turborepo monorepo containing 12 NestJS microservices and one Next.js 14 frontend.

---

## Commands

```bash
# Start everything (MongoDB must be running — use docker-compose up -d first)
npm run dev

# Build all packages and services
npm run build

# Build only shared packages (required before running individual services)
npx turbo run build --filter=@rmf/database --filter=@rmf/shared-types

# Run tests across the entire monorepo
npm run test

# Run tests for a specific service
npx turbo run test --filter=order-service

# Run a single test file (from within the service directory)
npx jest path/to/file.spec.ts --testPathPattern=filename

# Lint
npm run lint

# Seed market data
npm run seed

# TypeScript check for the frontend only
cd apps/frontend && npx tsc --noEmit
```

**Infrastructure (local dev):** `docker-compose up -d` starts MongoDB (:27017), Redis (:6379), Maildev (:1025/:1080), Mongo Express (:8081).

**Env file:** A single `.env` at the repo root is loaded by every service's `main.ts` via a custom env loader that walks up the directory tree. `.env.local` overrides `.env`.

---

## Architecture

### Service Map

| Service | Default Port | Responsibility |
|---|---|---|
| `user-service` | 3001 | Auth (JWT + Google OAuth), user profiles, email verification, affiliate profiles, B2B accounts |
| `market-service` | 3002 | Market and stall management, categories, locations |
| `product-service` | 3003 | Products, stock, seller videos |
| `seller-service` | 3004 | Seller profiles, menus (restaurants/hotels), export catalog, live sessions, freshness check-in |
| `rider-service` | 3005 | Rider profiles, availability, earnings |
| `order-service` | 3006 | **Core service.** Full order lifecycle, payments (MTN MoMo), escrow, disputes, buyer protection, group buying, B2B recurring orders, catering contracts |
| `wallet-service` | 3007 | Wallet balances, ledger entries, MTN MoMo Disbursements (withdrawals) |
| `delivery-service` | 3008 | Delivery assignment, progressive radius dispatch, rider errands, bulk delivery |
| `notification-service` | 3009 | Email (SendGrid/SMTP) and push notifications |
| `review-service` | 3010 | Product and seller reviews |
| `admin-service` | 3011 | Platform stats, seller certification tiers, market price index, B2B verification, export management |
| `frontend` | 3000 | Next.js 14 App Router client |

All service APIs are prefixed with `/api/v1`.

### Shared Packages

- **`@rmf/database`** — All Mongoose schemas. Every service imports models from here via `MongooseModule.forFeature([{ name: 'ModelName', schema: modelSchema }])`. Never define schemas inside a service.
- **`@rmf/shared-types`** — All enums (`OrderStatus`, `UserRole`, `DeliveryStatus`, `SellerTier`, `GroupBuyStatus`, `OrderSource`, etc.).
- **`@rmf/auth`** — `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@Public()`, `OptionalJwtAuthGuard`.
- **`@rmf/location`** — `LocationService` (geocoding) and `RouteService` (distance/routing).
- **`@rmf/shared-utils`** — `StateConflictError` and small helpers.
- **`@rmf/health-check`** — Standard health check module.

Whenever you add a new schema, export it from `packages/database/src/index.ts`. Whenever you add a new enum, add it to `packages/shared-types/src/enums.ts`. Then rebuild shared packages before the consuming service.

### Frontend Architecture

**`src/lib/api.ts`** — 11 pre-configured Axios clients (one per service), with automatic JWT attachment, token refresh on 401, and exponential backoff on network errors. Named exports: `userApi`, `marketApi`, `productApi`, `sellerApi`, `riderApi`, `orderApi`, `walletApi`, `deliveryApi`, `notificationApi`, `reviewApi`, `adminApi`.

**API response envelope** — All service responses follow `{ success: boolean, data: T, message?: string }`. `useApi` automatically unwraps `response.data.data`. Direct Axios calls must access `.data.data` manually.

**`src/components/layout/Layout.tsx`** — Single layout for the whole app. The `isDashboard` mode (sidebar navigation for seller/rider/admin/buyer operational views) is **auto-detected from the pathname** — no prop needed. The component wraps all pages; route group layouts (`(seller)/layout.tsx`, etc.) wrap `<Layout>` themselves.

**App Router route groups** — Role-specific layouts enforce auth and redirect:
- `(seller)/layout.tsx` — requires `SELLER` role, checks `sellerApi /sellers/me` approval, redirects unapproved sellers to `/seller/onboarding`
- `(rider)/layout.tsx` — requires `RIDER` role
- `(admin)/layout.tsx` — requires `ADMIN` role

**`src/context/AuthContext.tsx`** — Auth state. Use `const { user, isLoading } = useAuth()`. `user.role` is one of `BUYER`, `SELLER`, `RIDER`, `ADMIN`.

**`src/context/LanguageContext.tsx`** — i18n for English, French, and Kinyarwanda (`en`, `fr`, `kin`). Use `const { t } = useLanguage()` for all user-visible strings. When adding new UI text, add keys to all three language objects in this file.

**`src/components/cart/CartContext.tsx`** — Cart state. Use `const { cartCount, addToCart } = useCart()`.

**`src/context/WishlistContext.tsx`** — Wishlist state. Use `const { wishlist, toggleWishlist, isInWishlist } = useWishlist()`.

**`src/hooks/useApi.ts`** — Generic data-fetching hook. Auto-executes GET on mount, supports `refreshInterval`. Returns `{ data, loading, error, execute }`.

**`src/hooks/useSocket.ts`** — Socket.IO subscription hook. Connects to a service URL with a channel name. Returns `{ data, isConnected, emit }`. Both `order-service` (port 3006) and `delivery-service` (port 3008) expose WebSocket gateways; allowed origins are controlled by `ALLOWED_ORIGINS` env var.

**`src/middleware.ts`** — Subdomain routing: `kimironko.rwshop.org` rewrites to `/market/kimironko`. `PLATFORM_ROUTES` controls which paths are excluded from rewriting and redirect back to the apex domain instead.

---

## Key Business Logic

### Authentication

- **JWT guard:** Apply with `@UseGuards(JwtAuthGuard)`. Mark public endpoints with `@Public()`.
- **Role guard:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.SELLER)`.
- **Service-to-service:** Internal HTTP calls must include `x-internal-service-key: <INTERNAL_SERVICE_SECRET>` in the header. Receiving services call `verifyInternalSecret(req)` before trusting the call.
- **Dev bypass:** `Mock-Bearer userId:role:email` header is accepted when `NODE_ENV !== 'production'` AND `DISABLE_MOCK_AUTH !== 'true'`. Never use this in production contexts.

### Payment — MTN MoMo

Full configuration reference: **`PAYMENT_GATEWAY.md`** at the repo root.

Two separate credential sets:
- **Collections** (`MTN_MOMO_COLLECTION_*`) — charges the buyer. `payment.service.ts` in `order-service`.
- **Disbursements** (`MTN_MOMO_DISBURSEMENT_*`) — pays out seller/rider. Used in both `order-service` (refunds) and `wallet-service` (withdrawals).

`order-service` needs both sets; `wallet-service` needs only disbursements.

Environment switching: `MTN_MOMO_TARGET_ENV=sandbox` + `MTN_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com` for local dev; `MTN_MOMO_TARGET_ENV=mtnrwanda` for production. The `X-Target-Environment` header is derived from this var on every call.

The MTN MoMo `X-Reference-Id` header is a UUID set by the **caller**, not returned in the 202 response. This UUID is stored as `order.payment.transactionRef` and used for polling (`GET /collection/v1_0/requesttopay/{referenceId}`).

Phone numbers are normalized to 12-digit MSISDN format (`2507XXXXXXXX`) by `normalizeMomoPhone()` in `payment.service.ts` — all MoMo calls go through this helper.

Set `AUTO_CONFIRM_PAYMENTS=true` in `.env` to skip real MoMo API calls during local development (requires `NODE_ENV !== 'production'`).

Sandbox test phone numbers: `+46733123450` (SUCCESSFUL), `+46733123451` (FAILED). Sandbox provisioning: `scripts/setup-momo-sandbox.js`.

Admin readiness check: `GET /api/v1/orders/payment/mtn/readiness` (admin-only) — reports which credentials are present and whether the callback URL is configured.

### Commission & Fee Math

```
platformCommission = max(subtotal × 1.5%, 100 RWF)
deliveryFee        = ceil(distanceKm / 5) × DELIVERY_FEE_PER_5KM (default 500 RWF)
riderPayout        = deliveryFee × 90%
gatewayFee         = ceil((subtotal + deliveryFee) × 2%)
totalAmount        = subtotal + deliveryFee + gatewayFee
```

The backend in `order-service` **always recalculates and validates** subtotal, commission, and total from database prices. Any client-supplied prices that deviate by more than a small epsilon are rejected.

### Order Lifecycle

`AWAITING_QUOTE → QUOTE_SENT → PLACED → CONFIRMED → PREPARING → READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT → AWAITING_CONFIRMATION → DELIVERED → DISPUTED → RESOLVED`

`SCHEDULED` is a parallel entry point: `SCHEDULED → PLACED → CONFIRMED → ...`

State transitions are enforced via the `ORDER_TRANSITIONS` map in `order.service.ts`. `StateConflictError` is thrown on invalid transitions. There is also a `PAYMENT_TRANSITIONS` map for `PaymentStatus` (`PENDING → PAID/FAILED; PAID → REFUNDED`).

**Fraud detection:** `FraudDetectionService` runs synchronously during order creation (rules F001–F007). `shouldBlock: true` rejects the order with `BadRequestException`; `shouldBlock: false` (including F999 system errors) flags for review but lets the order through (fail-open). F002 checks that the buyer's delivery address is ≤50 km from the selected market's coordinates.

**Buyer protection:** `BuyerProtectionService.executeInstantRefund()` handles MoMo disbursement refunds. It deduplicates by querying `LedgerEntry` for an existing `account: 'buyer_mtn_refund'` entry before initiating any MoMo call — safe to call multiple times.

Escrow is held in the payment provider until 24 hours after delivery (`ESCROW_RELEASE_DELAY_HOURS`). On release, seller and rider wallets are credited internally via `wallet-service`. The `escrowReleaseTimers` Map in `order.service.ts` is in-process; `onModuleInit` re-hydrates pending timers on startup.

### Wallet System

`Wallet` document tracks: `availableBalance`, `pendingBalance`, `totalEarned`, `totalWithdrawn`. Role must be one of `SELLER`, `RIDER`, `BUYER`, `INFLUENCER`.

`LedgerEntry` is the audit trail. `transactionId` is optional; use `referenceType` + `referenceId` for non-order credits (errands, affiliates). Every insert must set a unique `ledgerId`.

Withdrawal flow: atomic `findOneAndUpdate` with `availableBalance: { $gte: amount }` pre-condition → call MTN Disbursements → set payout-request to `PROCESSING` → poll for `SUCCESSFUL`/`FAILED` (every 30s, max 10 attempts) → finalize.

### Delivery Dispatch

`delivery-service` uses progressive radius dispatch: broadcasts to riders within an initial radius, expanding over time if no rider accepts. Perishable orders (`isPerishable=true`) get priority — closer riders are sorted first.

### Seller Menus (Restaurants/Hotels/Cafés)

Sellers with `businessType` set can create structured menus (`Menu` collection: sections → items → modifiers). Menu item orders flow through the standard order pipeline. `order-service` uses `snapshotMenuItems()` to price from the `Menu` collection server-side, ignoring any client-supplied prices.

### Search & Discovery (Phase 3)

- `GET /markets/search?q=&lat=&lng=&sort=&type=` (public, market-service) — blended ranking `textRelevance*0.40 + reviewScore*0.25 + proximityScore*0.20 + premiumBoost*0.15`. Backed by the `market_text_search` `$text` index. Premium markets get a boost but must clear a relevance threshold (`textRelevance > 0.1`) — they cannot buy into unrelated queries. At most `MarketService.MAX_SPONSORED_SLOTS_PER_PAGE` (=3) results are flagged `isSponsored` (set server-side; never trusted from the client). The "Sponsored" label is mandatory per **Rwanda Law n°011/2026** sponsored-listing disclosure.
- `GET /products/search?q=&marketId=&sort=&condition=&category=` (public, product-service) — blended ranking `textRelevance*0.50 + ratingScore*0.30 + recencyScore*0.10 + premiumBoostFromSeller*0.10`. Backed by the `product_text_search` `$text` index. Empty `q` delegates to the personalized browse pipeline (`findAll`).
- Both endpoints are declared **before** the `@Get(':id')` route so the literal `/search` path is not captured by the param route.
- Market coordinates are GeoJSON `[lng, lat]` (see `location.schema.ts`). Proximity math reads `coords[1]` as lat, `coords[0]` as lng.

### Premium Rider Plan & Person Pickup (Phase 3)

- `PATCH /riders/me/plan` (RIDER) — self-upgrade to premium for 30 days. Requires `isApproved`. Idempotent: re-upgrading while premium extends from the later of now/current expiry. Billing is a future feature.
- `PATCH /riders/:id/plan` (ADMIN) — set/revoke any rider's plan (`{ plan, durationDays? }`).
- `POST /errands` (BUYER) extended with `errandType` (`goods_pickup`|`person_pickup`) and `paymentMethod` (`platform`|`external`). Person-pickup errands are broadcast to, listable by, and acceptable only by **active premium** riders (server-side gate in `accept()`, not just the socket filter). Fee is distance-based `ceil(km/5) × DELIVERY_FEE_PER_5KM` (same as delivery); platform keeps 10%, rider earns 90% (`riderEarnings`). `paymentMethod: 'external'` skips MoMo collection AND skips wallet credit (cash to rider).

### Disputes (Phase 3)

- Dispute window is **7 days (168h)** post-delivery (`DISPUTE_WINDOW_HOURS` env, default 168), aligned with Rwanda Law n°011/2026's 7-day withdrawal right.
- `POST /orders/:id/dispute` accepts `type: DisputeType` (`general`|`quality_mismatch`|`not_delivered`|`wrong_item`|`other`), defaulting to `general`.
- `POST /orders/:id/dispute/resolve` accepts `DisputeResolution.PARTIAL_REFUND` with `refundPercentage` (1–100, integer). The refund amount is computed **server-side** from `order.financials.totalAmount` — client-supplied amounts are never trusted. A partial refund sets `settlement.status='partial'` and leaves `payment.status=PAID`; a full refund marks `REFUNDED`.

### Product Condition Grades (Phase 3)

`product.condition` ∈ `new | grade_a | grade_b | grade_c | refurbished` (null = unspecified, treated as new), plus optional `qualityNotes` (≤500 chars). Surfaced as a badge on `ProductCard`/markets and a labelled block on the product detail page. Sellers set both on the create/edit form.

---

## Important Constraints

- **Schema ownership:** All schemas live in `packages/database`. Never define a Mongoose schema inside a service directory.
- **`contract.schema.ts`** is the seller Terms-of-Service contract. Do not repurpose it.
- **`delivery.schema.ts` `dropoff`** (singular) is kept for backward compatibility alongside the newer `dropoffs[]` array for group-buy and bulk delivery. Do not remove the singular field.
- **Live session `streamKey`** must never appear in viewer-facing API responses. It is `select: false` on the schema and must be explicitly stripped from any public endpoint.
- **Affiliate commission** must never fire when `buyer.userId === affiliate.userId`.
- The `getPublicStats()` method in `order-service` loads all DELIVERED orders into memory — this is a known performance issue. Do not add more unbounded queries near it.

---

## Production Deployment

Deployed on Render. `render.yaml` at the repo root defines all 12 service configurations. Environment variables marked `sync: false` must be set manually in the Render dashboard (secrets: MTN credentials, JWT secrets, etc.).

DB migration scripts live in `scripts/migrations/` and must be run manually with `MONGODB_URI=<uri> node scripts/migrations/<file>.js` before deploying schema changes. The latest is `003-add-text-indexes.js` (creates the `market_text_search` / `product_text_search` `$text` indexes plus the `condition` and `premiumTier+spotlightScore` indexes that back Phase 3 search). In dev these are auto-created via `autoIndex:true`; in production run the migration before/after deploy.
