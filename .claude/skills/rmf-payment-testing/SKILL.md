---
name: rmf-payment-testing
description: Complete payment flow testing procedures for RMF covering MTN MoMo, Airtel Money, callback handling, idempotency, duplicate protection, commission calculation, refunds, and race conditions.
---

# RMF Payment Testing Skill

## When to Use

Apply this skill when:

- Testing any MTN MoMo or Airtel Money integration
- Testing payment callback (webhook) handling
- Testing order → payment → confirmation flow
- Testing commission calculation and seller payout
- Testing refund logic
- Testing payment-related edge cases before any release
- Reproducing a payment-related bug report

## Agents That Should Use This Skill

- `rmf-worker-qa` — primary user; apply for all payment-related testing tasks
- `rmf-qa-commander` — reference when assigning Payment Test Agent
- `rmf-worker-integration` — apply when implementing and verifying payment integrations
- `rmf-worker-security` — cross-reference with `rmf-security-review` skill for callback security

---

## MTN MoMo API — Key Facts for Testing

- **Idempotency key**: `X-Reference-Id` header — must be a UUID v4, unique per request
- Reusing the same `X-Reference-Id` returns HTTP **409 Conflict**
- `externalId` field in request body serves as secondary idempotency reference
- MTN **retries callbacks** — the handler must be idempotent
- Callback domain must match `providerCallbackHost` registered with MTN
- Sandbox base URL: `https://sandbox.momodeveloper.mtn.com`
- Production requires MTN KYC approval and issued production credentials

**Sources (verified 2025):**
- MTN MoMo Developer Portal: momodeveloper.mtn.com/api-documentation
- MTN MoMo Testing docs: momodeveloper.mtn.com/api-documentation/testing

---

## Test Suite Structure

### 1. Happy Path Tests

**Test 1.1: Complete payment flow**
- Precondition: Order exists in `pending_payment` state
- Action: Initiate Request-to-Pay via MTN MoMo sandbox
- Expected: Payment initiated, order stays `pending_payment` while processing
- Verify: `X-Reference-Id` stored in payment record
- Trigger callback: Send simulated success callback
- Expected: Order moves to `confirmed`, wallet credit event recorded
- Acceptance: Order in `confirmed` state, payment record shows `success`, seller wallet credited with order amount minus commission

**Test 1.2: Correct commission deduction**
- Precondition: Platform commission rate configured (e.g., 10%)
- Trigger: Successful payment callback for 10,000 RWF order
- Expected: Seller wallet credited with 9,000 RWF; platform commission ledger shows 1,000 RWF
- Verify: Commission calculated server-side — not from any client-provided field
- Acceptance: `sellerWalletCredit + commissionAmount = orderTotal` (within rounding)

---

### 2. Idempotency Tests

**Test 2.1: Duplicate X-Reference-Id**
- Action: Submit same payment request with identical `X-Reference-Id` twice
- Expected: Second request returns HTTP 409 Conflict
- Verify: Only one payment record exists in database for that reference ID
- Acceptance: No duplicate charge, no duplicate order state change

**Test 2.2: Duplicate callback delivery**
- Action: Send the same callback payload twice (simulating MTN retry)
- Expected: Second callback returns HTTP 200 (acknowledged) but triggers no state change
- Verify: Order state changed only once, wallet credited only once
- Acceptance: Payment record updated once; second callback is a no-op

**Test 2.3: Client double-submit**
- Precondition: User taps "Pay Now" twice rapidly (frontend or API)
- Action: Two identical payment initiation requests, unique reference IDs
- Expected: Only one order is created and paid (or one is rejected as duplicate order)
- Acceptance: No double charge, no duplicate order

---

### 3. Failure and Error Tests

**Test 3.1: Insufficient balance**
- Action: Initiate payment with sandbox account that has insufficient balance
- Expected: Callback arrives with status `FAILED`
- Verify: Order state stays `pending_payment`, not moved to `confirmed`
- User experience: Buyer sees "Payment failed — insufficient balance. Please try again."

**Test 3.2: Buyer cancels payment**
- Action: Initiate payment, simulate buyer cancellation in MTN MoMo app
- Expected: Callback arrives with status `REJECTED`
- Verify: Order returns to `pending_payment` (buyer can retry)
- Acceptance: Order is not abandoned — retry must be possible

**Test 3.3: Callback timeout (no callback arrives)**
- Action: Initiate payment, simulate callback not arriving within SLA window
- Expected: System polls payment status after timeout (or marks as `timeout_pending`)
- Verify: Order does not get stuck permanently in `pending_payment`
- Acceptance: Either automatic resolution or admin-escalation path exists

**Test 3.4: Callback with wrong amount**
- Action: Forge a callback with amount different from order total
- Expected: Server rejects callback, logs security event
- Acceptance: Order NOT marked as paid, security alert triggered

**Test 3.5: Invalid callback signature**
- Action: Send callback with missing or invalid signature header
- Expected: Server returns 400 or 401, does not process callback
- Acceptance: Payment status unchanged, event logged

---

### 4. Race Condition Tests

**Test 4.1: Concurrent payment initiation**
- Action: Submit 5 payment initiation requests for the same order simultaneously
- Expected: Only 1 accepted; others return appropriate error (409 or 400)
- Acceptance: Order has exactly 1 payment record

**Test 4.2: Refund while callback in flight**
- Action: Initiate refund (admin or dispute flow) while payment callback has not yet arrived
- Expected: System handles both correctly — does not refund an unpaid order
- Acceptance: State machine prevents illegal refund of unconfirmed payment

**Test 4.3: Order canceled while payment processing**
- Action: Seller cancels order while buyer's payment is in `pending` state
- Expected: If callback arrives after cancellation, payment is refunded automatically
- Acceptance: Money not captured for canceled order; refund issued if already captured

---

### 5. Refund Tests

**Test 5.1: Full refund**
- Precondition: Order in `confirmed` state with successful payment
- Action: Admin or dispute flow triggers full refund
- Expected: Full order amount returned to buyer's MTN MoMo account
- Verify: Commission reversed proportionally (seller commission reversed, platform commission reversed)
- Acceptance: Buyer wallet balance restored, all ledger entries balanced

**Test 5.2: Partial refund**
- Action: Dispute resolution results in partial refund (50%)
- Expected: 50% of order amount returned
- Verify: Commission proportionally reversed for refunded portion
- Acceptance: All ledger entries balance correctly

**Test 5.3: Refund amount exceeds original payment**
- Action: Attempt to issue refund of 15,000 RWF for 10,000 RWF order
- Expected: Server rejects with 400, logs attempt
- Acceptance: No refund issued, alert to admin

---

### 6. Commission Edge Case Tests

**Test 6.1: Minimum commission boundary**
- Action: Create order at the minimum threshold for platform commission
- Verify: Commission applied correctly at the boundary value
- Acceptance: No commission applied below minimum; commission applied at and above minimum

**Test 6.2: Multiple items in one order**
- Action: Order with 5 different products from same seller, total 25,000 RWF
- Verify: Commission calculated on total order, not per-item
- Acceptance: Single commission deduction, correct seller payout

---

## Test Data Requirements

| Data | Value |
|---|---|
| Sandbox MTN MoMo number (success) | Use MTN sandbox test numbers from developer portal |
| Sandbox MTN MoMo number (insufficient balance) | Specific test number from sandbox docs |
| Sandbox MTN MoMo number (rejected) | Specific test number from sandbox docs |
| Test commission rate | 10% (or current platform config) |
| Test order amounts | 1,000 RWF, 10,000 RWF, 100,000 RWF (to test boundary behaviors) |

---

## Checklist (Quick Reference)

**Before payment feature merge:**
- [ ] Happy path: payment succeeds, order confirmed, commission deducted correctly
- [ ] Duplicate callback: second callback is idempotent (no double credit)
- [ ] Failed payment: order stays pending, buyer can retry
- [ ] Wrong amount in callback: rejected
- [ ] Invalid signature: rejected
- [ ] Refund: correct amount reversed, commission reversed proportionally
- [ ] Race conditions: concurrent submissions safe
- [ ] All payment state changes in audit log

---

## Output Format

For each failed test, report using Problem Reporting Rule:

```
Problem title: [e.g., "Duplicate MTN MoMo callback credited seller wallet twice"]
Severity: critical
Affected user: buyer / seller / system
Affected flow: payment callback handling
Evidence: [test steps + actual result]
Expected: [one credit only]
Actual: [two credits issued]
Files involved: [payment.service.ts, wallet.service.ts]
Suggested worker: rmf-worker-integration / rmf-worker-backend
Payment impact: double payout to seller; platform loss of commission
Acceptance criteria: second callback for same reference ID is a confirmed no-op; wallet credit count = 1
Test that proves fix: run Test 2.2 above; verify wallet credit count = 1
```

---

## What Not to Do

- Do not test only the happy path — failure and edge cases are where money is lost
- Do not skip idempotency tests — MTN MoMo retries callbacks in production
- Do not mock the callback handler without also testing signature verification
- Do not test only at one order amount — test boundary values (minimum, typical, large)
- Do not treat a 200 response from the callback handler as success — verify database state

---

## RMF-Specific Rules

- Commission is always server-side — never test a scenario where client provides commission
- Every test of a callback must also verify the audit log was written
- Test both MTN MoMo and Airtel Money independently — their callback formats differ
- Sandbox tests must pass before any production credential is used
- A test for refund must always verify the commission reversal, not just the buyer refund
