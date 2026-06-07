---
name: platform-expansion
description: 12-feature platform expansion (Waves 1-4) implementation map, contracts, and deviations from the mission brief
metadata:
  type: project
---

Platform expansion mission (2026-06-06): 12 features across Waves 1-4, built directly (no subagent runtime — see [[runtime-no-subagent-spawn]]).

**Where each feature's backend lives:**
- Cold chain (F6): product-service create/update perishable coercion; order-service `createDeliveryForOrder` computes isPerishable+min maxDeliveryMinutes; delivery-service gateway `prioritizeProximity` sort + `PROGRESSIVE_RADIUS_PRIORITY`; perishable-delay alert in `updateStatus`.
- Tiers (F11): admin-service `tier-calculation.service.ts` (`@Cron 0 2 * * 0`); seller GET `/sellers/me/tier` + `/sellers/:id/tier`.
- Freshness (F12): seller-service `freshness.controller/service` (`/seller/freshness-checkin`, `/sellers/:id/freshness`); rider-service `/riders/stall-confirmation/:sellerId`.
- Price index (F10): admin-service `price-index.service` (`@Cron 0 23 * * 0`) + `price-index.controller` (public `/price-index`, `/price-index/latest`; admin compute/publish).
- Export (F9): seller-service `export/` module; admin-service export buyer/inquiry endpoints.
- Affiliate (F3): user-service `affiliate/` (apply/links/earnings + `/r/:slug` redirect, throttled 3/hr, excluded from api/v1 prefix); seller application approve/reject; order-service `affiliate.service` credits after escrow release.
- Errands (F4): delivery-service `errand/` module + gateway events.
- B2B (F7): user-service `b2b/` (accounts); admin verify; order-service `b2b/` (templates + invoices + `b2b-recurring` `@Cron 0 5 * * *` + `invoice-generation` `@Cron 0 1 1 * *`, pdfkit+GCS).
- Group buy (F1): order-service `group-buy/` (+ OrderModule provides gateway); expiry cron in `scheduled-orders.service` `@Cron 0 * * * *`.
- Bulk delivery (F5): delivery-service `bulk-delivery/` module.
- Catering (F8): order-service `catering/` (`@Cron 0 6 * * 1`).
- Live selling (F4 Wave4): seller-service `live/` — PLACEHOLDER, streamKey=crypto.randomUUID, playbackUrl null.

**Key deviations from brief (reality-driven):**
- Wallet `internal/credit` only persists `{userId, role, amount, orderId, orderNumber, description}` and requires orderId be ObjectId-castable + role SELLER/RIDER. The brief's `account`/`ledgerId`/`referenceType` extended contract does NOT exist. Affiliate credit passes role='BUYER' (ledger account becomes `buyer_wallet_credit`). Errand/bulk credits pass role='RIDER'. Extra fields are sent but ignored by the endpoint.
- Schedule cron added `ScheduleModule.forRoot()` to admin-service (was missing). order-service already had it. seller-service freshness/export don't need cron.
- `@nestjs/schedule` + `nanoid@3` are hoisted at repo ROOT node_modules; declared in admin/seller/user package.json. `pdfkit`+`@types/pdfkit` installed at root.
- Wave0 schema edits made during impl: transaction.settlement.affiliateStatus; group-buy participants.deliveryAddress. Rebuild `packages/database` (tsc) after schema edits — services consume `dist/`.
- Referral `/r/:slug` sets httpOnly cookie on API domain (cross-origin, unreadable by frontend) AND redirects to `/product/:id?ref=slug`; frontend product page persists a client-readable `rmf_ref` cookie; checkout reads it → `affiliateCode`.
- Frontend api.ts default ports differ from mission's stated service ports — trust api.ts (seller=3004, wallet=3007, admin=3011, delivery=3008, user=3001). See [[stack-confirmed]].

**Build verification:** per-service `npx tsc -p apps/<svc>/tsconfig.json --noEmit` and frontend `npx tsc --noEmit` both clean through Wave 3.
