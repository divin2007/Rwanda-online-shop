---
name: phase3-search-premium-disputes
description: Phase 3 (2026-06-07) — market/product $text search, sponsored cap, premium rider plan + person pickup, 7-day disputes + partial refund, product condition grades
metadata:
  type: project
---

Phase 3 mission (2026-06-07), built directly (no subagent runtime — see [[runtime-no-subagent-spawn]]). All decisions were pre-made by the user; orchestrator executed end-to-end.

**Schema/enum additions (packages/database, packages/shared-types — rebuild after editing):**
- enums: `DisputeResolution.PARTIAL_REFUND`; new `DisputeType`, `RiderPlan`, `PremiumTier`, `ProductCondition`.
- market.schema: `isPremium`, `premiumTier`, `premiumUntil`, `spotlightScore`; `market_text_search` `$text` index (name^10, description^1); `{premiumTier:1, spotlightScore:-1}`.
- product.schema: `condition`, `qualityNotes`; `product_text_search` `$text` index (name^10, category^5, description^1); `{condition:1}`.
- transaction.schema: `dispute.type` (default GENERAL), `dispute.refundPercentage`.
- errand.schema: `errandType`, `paymentMethod`, `riderEarnings`, `payment` subdoc.
- rider-profile.schema already had `plan`/`premiumUntil` from Phase 2 — no change needed.

**Endpoints added:**
- `GET /markets/search` (market.service `searchMarkets`) — blended rank, `MAX_SPONSORED_SLOTS_PER_PAGE=3` static const, relevance threshold 0.1, `isSponsored` set server-side. Declared before `@Get(':id')`.
- `GET /products/search` (product.service `searchProducts`) — `$text` rank; empty q delegates to `findAll`. Also added `condition` filter to `findAll` + persisted `condition`/`qualityNotes` in `create`.
- `PATCH /riders/me/plan` (RIDER) + `PATCH /riders/:id/plan` (ADMIN) — `me/plan` declared before `:id/*` routes.
- order dispute: `raiseDispute(id,reason,evidenceUrls,type)` + `DISPUTE_WINDOW_HOURS` const (default 168). `resolveDispute(id,resolution,refundPercentage)` — partial refund amount computed from DB total, validated 1–100 server-side.
- errand `create` extended; `accept`/`listOpenForRider` gate person_pickup to active premium riders; gateway `broadcastErrand(errand, allowedRiderIds?)`.

**Frontend:** `ConditionBadge.tsx` (new, with `CONDITION_META`); ProductCard badge; product detail condition block; seller product form condition+qualityNotes; markets page uses `/markets/search` when query present + Sponsored badge; products page uses `/products/search` when query present; order tracking dispute UI gets a type dropdown + 7-day note; new `/rider/plan` page; "Plan" link in `OperationalSidebar` RIDER nav.

**Migration:** `scripts/migrations/003-add-text-indexes.js` (idempotent; skips conflicting pre-existing text index rather than failing).

**Test-infra fix (important, reusable):** order-service AND delivery-service jest runs were ALL failing pre-Phase-3 because `uuid` v11 is ESM-only and ts-jest ignores node_modules. Fix: add `"transformIgnorePatterns": ["/node_modules/(?!(uuid)/)"]` to each service's jest config in package.json. This unblocked the existing 24 order-service tests too. If you add a new service spec that transitively imports uuid (directly or via @rmf/shared-utils dist), apply the same.

**Tests added (all green):** order `dispute-phase3.spec.ts` (6), market `market-search.spec.ts` (3), rider `rider-plan.spec.ts` (4), delivery `errand-person-pickup.spec.ts` (3).

**Verification:** all 5 services + frontend `tsc --noEmit` clean; service jest suites green. See [[rwanda-consumer-protection-2026]] for the legal basis of the 7-day window + sponsored disclosure.
