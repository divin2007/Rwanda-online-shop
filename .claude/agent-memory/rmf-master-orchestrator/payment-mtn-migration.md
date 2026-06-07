---
name: payment-mtn-migration
description: RMF migrated off PayPack to MTN MoMo (Collections + Disbursements) on 2026-06-06 — gateway transport facts and gotchas
metadata:
  type: project
---

PayPack/Airtel removed; MTN MoMo is the sole gateway as of 2026-06-06 (this supersedes the "PayPack-primary" note in [[stack-confirmed]]).

- Two credential sets: Collections (buyer pay-in, order-service) and Disbursements (payouts/refunds, order-service + wallet-service). Env vars: `MTN_MOMO_{COLLECTION,DISBURSEMENT}_{API_KEY,USER_ID,API_SECRET}`, plus `MTN_MOMO_TARGET_ENV` (sandbox|mtnrwanda), `MTN_MOMO_BASE_URL`, `MTN_MOMO_CALLBACK_URL`, `MTN_MOMO_CURRENCY`.
- Collections logic: `apps/order-service/src/order/payment.service.ts` (requestPaymentPrompt, getPaymentStatus, parseMtnCallback, getMtnReadiness, requestMtnDisbursement/Refund). `normalizeMomoPhone` exported from same file → 2507XXXXXXXX.
- Callback endpoint: `POST /api/v1/orders/payment/mtn/callback` (@Public, no HMAC; verified by referenceId→order lookup via `orderService.findOrderByPaymentReference`; always returns 200). Readiness: `GET /api/v1/orders/payment/mtn/readiness` (admin-only, inline isAdmin check).
- X-Reference-Id (a UUID we generate) IS the `payment.transactionRef` / payout `gatewayRef`. Disbursements derive the reference deterministically from the idempotency key (sha256→uuid) so retries are idempotent.
- Wallet withdrawal flow (`apps/wallet-service/src/wallet/wallet.service.ts`): atomic `findOneAndUpdate({availableBalance:{$gte:amount}})` debit (no double-spend); status set to **PROCESSING** on 202 (never COMPLETED at init); in-process `addWithdrawalStatusPoller` (30s ×10) settles COMPLETED on SUCCESSFUL or reverses on FAILED.
- payout-request.schema now has status enum incl. `PROCESSING`; `paypackRef` dropped, `gatewayRef` is canonical. ledger-entry `ledgerId` is now `unique: true` — every ledger insert MUST set ledgerId or the save throws.

**Why:** A full audit + gateway swap mission on 2026-06-06.
**How to apply:** Treat MTN MoMo as the only gateway. Any new ledger write needs a ledgerId. Internal service calls use the `'internal-service'` identity (INTERNAL_SERVICE_SECRET-validated), never `'system'`.
