---
name: rmf-delivery-rider-testing
description: Testing procedures for RMF delivery and rider flows covering order assignment, pickup confirmation, delivery completion, rider earnings, delivery status state machine, and location privacy.
---

# RMF Delivery and Rider Testing Skill

## When to Use

Apply this skill when:

- Testing any rider-facing flow (assignment, pickup, delivery)
- Testing order-to-delivery state transitions
- Testing rider earnings calculation and payout
- Testing real-time location tracking and privacy
- Testing rider active/inactive toggle and assignment eligibility
- Testing proof of delivery (QR scan or delivery confirmation)
- Reviewing delivery/rider features before release

## Agents That Should Use This Skill

- `rmf-worker-qa` — primary user for targeted delivery testing tasks
- `rmf-qa-commander` — reference when assigning Delivery and Rider Test Agent
- `rmf-worker-backend` — reference when implementing delivery state machine

---

## Delivery State Machine

Every delivery must follow this exact state sequence. No transitions outside this sequence are allowed.

```
ORDER CONFIRMED
     ↓
RIDER ASSIGNED (automatic or manual dispatch)
     ↓
PICKUP CONFIRMED (rider confirms pickup at seller stall)
     ↓
IN TRANSIT (rider en route to buyer)
     ↓
DELIVERED (proof of delivery confirmed)

Alternate paths:
- RIDER ASSIGNED → RIDER REJECTED (rider declines) → back to RIDER ASSIGNED (reassign)
- IN TRANSIT → DELIVERY FAILED (rider cannot reach buyer) → admin/support escalation
- Any state → DISPUTED (buyer or seller raises dispute)
```

---

## Test Suite Structure

### 1. Rider Status and Eligibility Tests

**Test 1.1: Active/inactive toggle**
- Action: Rider sets status to active
- Expected: Rider appears in available pool for dispatch
- Action: Rider sets status to inactive
- Expected: Rider removed from dispatch pool; no new assignments while inactive
- Acceptance: Orders are never assigned to inactive riders

**Test 1.2: Rider cannot receive assignment while on active delivery**
- Precondition: Rider has delivery in `in_transit` state
- Action: System attempts to assign second delivery to same rider
- Expected: Assignment rejected or queued (depending on RMF dispatch policy)
- Acceptance: Rider not double-assigned without explicit policy support

**Test 1.3: Geographic eligibility**
- Action: Order placed in Zone A; nearest rider is in Zone B (outside delivery radius)
- Expected: System does not assign Zone B rider; reassigns to nearest available Zone A rider or notifies admin
- Acceptance: No assignment beyond configured delivery radius

---

### 2. Order Assignment Tests

**Test 2.1: Automatic assignment to nearest rider**
- Precondition: Multiple active riders at varying distances from seller
- Action: Order moves to `confirmed`
- Expected: Nearest available rider is assigned
- Verify: Rider receives push notification with order details, pickup address, earnings preview
- Acceptance: Assignment latency < 1 second for available riders

**Test 2.2: Rider accepts assignment**
- Precondition: Rider receives assignment notification
- Action: Rider taps "Accept"
- Expected: Order state moves to `rider_assigned`; buyer notified with rider first name and ETA
- Verify: Rider sees clear pickup address (stall number + market name)
- Acceptance: Buyer receives real-time notification within 5 seconds of acceptance

**Test 2.3: Rider rejects assignment**
- Action: Rider taps "Reject"
- Expected: Order returned to assignment pool; new nearest rider is tried
- Verify: Rejection is logged; rider's rejection count tracked
- Acceptance: Order is not stuck; next rider is tried within 30 seconds

**Test 2.4: No riders available**
- Precondition: Zero active riders in delivery zone
- Action: Order is confirmed
- Expected: Buyer notified "No riders available; we are finding a rider for you"
- Acceptance: Order is queued, not abandoned; admin can see it

---

### 3. Pickup Confirmation Tests

**Test 3.1: Rider confirms pickup at seller stall**
- Action: Rider taps "Confirm Pickup" after collecting order
- Expected: Order state moves to `pickup_confirmed` → `in_transit`
- Verify: Seller receives notification "Rider has picked up your order"
- Acceptance: State transitions correctly; all parties notified

**Test 3.2: Rider cannot confirm pickup without assignment**
- Action: Unauthorized rider (not assigned to order) attempts to confirm pickup
- Expected: API returns 403 Forbidden
- Acceptance: Only the assigned rider can confirm pickup for a specific order

**Test 3.3: Multiple sellers in one order (if applicable)**
- Action: Order contains products from 2 different stalls
- Expected: Rider can confirm pickup for each stall separately
- Acceptance: Both pickups recorded; order progresses only when all pickups confirmed

---

### 4. Delivery Completion Tests

**Test 4.1: Successful delivery confirmation**
- Action: Rider taps "Confirm Delivery" or scans QR code at buyer location
- Expected: Order state moves to `delivered`
- Verify: Buyer notified "Your order has been delivered"
- Verify: Seller notified "Your order was delivered"
- Verify: Rider earnings updated in earnings ledger
- Acceptance: All parties notified; order in final state; earnings calculated correctly

**Test 4.2: QR code proof of delivery**
- Action: Rider scans buyer's order QR code
- Expected: QR code verified server-side; delivery confirmed
- Verify: QR code is single-use — scanning again does not re-confirm
- Acceptance: Delivery confirmed once; duplicate scan is a no-op

**Test 4.3: Delivery failed**
- Precondition: Rider cannot reach buyer (wrong address, buyer unavailable)
- Action: Rider marks delivery as failed with reason
- Expected: Order moves to `delivery_failed` state; admin notified
- Acceptance: Buyer is notified; clear path for rebooking or refund exists

**Test 4.4: Buyer disputes delivery**
- Precondition: Order marked `delivered` by rider
- Action: Buyer disputes ("I never received this")
- Expected: Dispute created; admin notified; rider and seller notified
- Acceptance: Dispute follows the RMF dispute resolution process; rider earnings not released until resolved

---

### 5. Rider Earnings Tests

**Test 5.1: Earnings calculated correctly**
- Precondition: Delivery fee is 2,000 RWF; rider share is 80% (platform policy)
- Action: Rider completes delivery
- Expected: Rider earns 1,600 RWF; platform retains 400 RWF
- Verify: Rider earnings ledger updated; earnings show in rider dashboard
- Acceptance: `riderEarnings + platformShare = deliveryFee` (within rounding)

**Test 5.2: Earnings visible before acceptance**
- Action: New delivery assignment appears with earnings preview
- Expected: Rider sees per-delivery payout before deciding to accept
- Acceptance: Earnings displayed prominently in acceptance screen

**Test 5.3: Earnings withheld during dispute**
- Precondition: Delivery marked complete but buyer raised dispute
- Expected: Rider earnings for that delivery in `pending_dispute` state
- Acceptance: Rider cannot access disputed earnings until resolution

---

### 6. Location Privacy Tests

**Test 6.1: Buyer can see rider location during delivery only**
- Precondition: Order in `in_transit` state
- Action: Buyer requests rider location
- Expected: Returns current rider coordinates (or approximate location)
- Action: Order moves to `delivered`
- Action: Buyer requests rider location again
- Expected: Returns 404 or "no active delivery" — location no longer accessible
- Acceptance: Rider location not accessible after delivery completes

**Test 6.2: Non-buyer cannot access rider location**
- Action: Second buyer (different user) requests location of rider assigned to someone else's order
- Expected: 403 Forbidden
- Acceptance: Location strictly scoped to the assigned buyer only

**Test 6.3: Rider location history retention**
- Verify: Rider GPS coordinates are deleted after configured retention period (max 90 days)
- Acceptance: No GPS history older than retention period exists in database

---

## Checklist (Quick Reference)

**Before delivery feature release:**
- [ ] Active/inactive toggle prevents assignment to inactive riders
- [ ] Assignment goes to nearest available rider
- [ ] Rider sees earnings before accepting
- [ ] Pickup confirmation restricted to assigned rider only
- [ ] Delivery confirmation is idempotent (QR scan can't re-trigger)
- [ ] All state transitions follow the defined state machine
- [ ] Buyer receives real-time notifications on all state changes
- [ ] Rider earnings calculated correctly per platform split
- [ ] Disputed earnings are held until resolution
- [ ] Rider location inaccessible after delivery completes
- [ ] Non-assigned party cannot access delivery location

---

## Output Format

For each failed test, report using Problem Reporting Rule:

```
Problem title: [specific issue]
Severity: critical / high / medium / low
Affected user: rider / buyer / seller / admin
Affected flow: [e.g., "Rider delivery confirmation"]
Evidence: [test steps + actual result]
Expected: [what should have happened]
Actual: [what actually happened]
Files involved: [list]
Suggested worker: rmf-worker-backend / rmf-worker-qa
Impact: [e.g., "Rider earnings not recorded; buyer not notified"]
Acceptance criteria: [specific state + notification + ledger requirements]
Test that proves fix: [specific test from this skill]
```

---

## What Not to Do

- Do not test only successful delivery — failure, dispute, and rejection paths are critical
- Do not skip location privacy tests — rider safety depends on correct access control
- Do not assume earnings are correct — always verify against the platform split formula
- Do not test delivery confirmation without verifying all notifications fire
- Do not allow delivery to complete without proof of delivery verification

---

## RMF-Specific Rules

- Stall number must be part of pickup instructions — test this explicitly
- Rider earnings must be visible before acceptance — this is a trust requirement
- Rider location must be scoped to `in_transit` state only — not before or after
- All delivery state changes must appear in the order audit log
- Dispute during delivery must hold both rider earnings and seller payout
