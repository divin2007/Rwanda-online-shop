---
name: rmf-api-contract-testing
description: API contract testing procedures for RMF covering OpenAPI spec conformance, request/response schema validation, status codes, error formats, breaking change detection, and consumer-side expectations.
---

# RMF API Contract Testing Skill

## When to Use

Apply this skill when:

- Adding a new API endpoint or modifying an existing one
- Verifying backend API responses match what the frontend expects
- Detecting breaking changes before a merge
- Validating that an external integration (MTN MoMo, etc.) behaves as documented
- Running pre-release API conformance checks
- Debugging "the frontend broke after a backend change" incidents

## Agents That Should Use This Skill

- `rmf-worker-qa` — primary user for API contract testing tasks
- `rmf-qa-commander` — reference when assigning API Contract Test Agent
- `rmf-worker-backend` — reference when adding or modifying API endpoints
- `rmf-worker-frontend` — reference when adding API consumers that depend on specific response shapes

---

## Contract Testing Model

RMF uses a **hybrid approach**:

1. **Provider conformance** — backend must conform to the OpenAPI specification
2. **Consumer expectations** — frontend defines what response fields it needs; backend must not remove them

This catches two failure modes:
- Code changed but spec not updated (provider drift)
- Spec changed but frontend not updated (consumer break)

---

## Level 1: OpenAPI Spec Conformance

Every RMF API endpoint must have an entry in the OpenAPI spec (`apps/api-spec/rmf-api.openapi.yaml` or equivalent).

**For each endpoint, the spec must define:**
- HTTP method and path
- Authentication requirement (`bearerAuth`)
- Required roles (in description or `x-roles` extension)
- Request body schema (for POST/PUT/PATCH)
- Response schema for: 200/201/202, 400, 401, 403, 404, 422, 429, 500
- Error response format (must match the RMF standard error shape)

**RMF Standard Error Response Shape:**
```json
{
  "statusCode": 400,
  "message": "Human-readable message",
  "error": "BadRequest",
  "timestamp": "2026-06-06T10:00:00.000Z",
  "path": "/api/v1/orders/123"
}
```

All 4xx and 5xx responses from RMF backend must follow this shape. Any deviation is a contract violation.

---

## Level 2: Request Validation Tests

For each endpoint, test these input cases:

| Case | Expected response |
|---|---|
| Missing required field | 422 Unprocessable Entity |
| Wrong field type (string instead of number) | 422 |
| Value outside enum | 422 |
| Negative quantity | 422 |
| Request body too large | 413 Payload Too Large |
| Missing auth header | 401 Unauthorized |
| Wrong role token | 403 Forbidden |
| Valid request | 200 / 201 / 202 |

**Tests must verify:**
- Correct HTTP status code
- Response body matches error schema
- No stack trace or internal implementation detail in error response
- Error message is human-readable, not a code

---

## Level 3: Response Schema Tests

For each successful response, verify:

- All required fields are present
- Field types match the spec (string, number, boolean, array)
- Nested objects have all required sub-fields
- Array responses include pagination metadata when applicable
- No undocumented extra fields appear in response (or if they do, verify they are safe to expose)

**RMF Standard Paginated List Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

Any list endpoint that returns more than 20 items without pagination is a contract violation.

---

## Level 4: Critical Contract Tests by Domain

### Buyer Checkout Contract

**POST /orders — Create order**
- Request must include: `items[]`, `deliveryAddress`, `sellerId`
- Response must include: `orderId`, `status: "pending_payment"`, `totalPrice`, `deliveryFee`, `estimatedDelivery`
- Must NOT include: buyer payment method, any internal calculation fields

**POST /orders/{id}/payment — Initiate payment**
- Response must include: `paymentId`, `status: "pending"`, `providerReference`, `expiresAt`
- Must NOT include: any server-side credentials or API keys

**GET /orders/{id} — Order status**
- Response must include: `orderId`, `status`, `totalPrice`, `items[]`, `seller.name`, `seller.verified`
- For buyer: must NOT include seller payout amount or commission deduction
- For seller: must include commission deduction amount and seller net payout

### Rider Contract

**GET /deliveries/available — Available deliveries**
- Response must include: `deliveryId`, `pickupAddress`, `dropoffArea`, `estimatedEarnings`, `distanceKm`
- Must NOT include: full buyer address (only area/district before acceptance)
- Must NOT include: buyer phone number (only after acceptance)

**POST /deliveries/{id}/accept — Accept delivery**
- Response must include: `deliveryId`, `buyerContactInfo`, `pickupAddress` (full), `estimatedPickupTime`

**POST /deliveries/{id}/deliver — Confirm delivery**
- Must be idempotent: calling twice returns same result, does not double-credit rider

### Payment Callback Contract (MTN MoMo Inbound)

**POST /payments/momo/callback — Inbound callback from MTN**
- Must validate: signature header present and valid
- Must validate: `externalId` matches a known payment record
- Must validate: `amount` matches stored order total
- Must respond: 200 with empty body (or simple ack) — not 500 even if processing fails internally
- Must be idempotent: duplicate callback returns 200 without re-processing

---

## Level 5: Breaking Change Detection

Before merging any backend change, verify no breaking changes were introduced:

**Breaking changes (must never ship without coordination):**
- Removing a required response field that frontend currently reads
- Changing a field type (e.g., `price` from `number` to `string`)
- Changing a status code for a common success case (e.g., 200 → 201 for existing endpoint)
- Removing an endpoint entirely without deprecation notice
- Changing an enum value that frontend displays directly

**Non-breaking changes (safe to ship):**
- Adding new optional response fields
- Adding new optional request parameters
- Adding new endpoints
- Making a previously required field optional

**How to check:**
1. Run OpenAPI diff between current branch and main
2. For any removed field: grep frontend code for usage of that field
3. If frontend uses it: coordinate with `rmf-worker-frontend` before merging

---

## Checklist (Quick Reference)

**Before merging any backend API change:**
- [ ] OpenAPI spec updated to reflect changes
- [ ] All new endpoints documented in spec
- [ ] All error responses follow standard shape
- [ ] No required response fields removed without frontend coordination
- [ ] Paginated endpoints return standard `data` + `meta` wrapper
- [ ] Payment callback endpoint is idempotent
- [ ] Sensitive fields (phone, payment details) absent from unauthorized role responses
- [ ] Buyer cannot see seller commission details
- [ ] Rider cannot see buyer full address before accepting assignment

---

## Output Format

For each contract violation found:

```
Contract violation title: [e.g., "GET /orders/{id} returns seller commission to buyer"]
Severity: high
Affected consumer: buyer frontend / seller frontend / rider app
Endpoint: GET /orders/{id}
Expected response field: commission field absent in buyer response
Actual: commission: 1000 present in response
Files involved: [orders.controller.ts, orders.serializer.ts]
Suggested worker: rmf-worker-backend
Privacy impact: seller financial data exposed to buyer
Acceptance criteria: commission field excluded from buyer-facing order serializer
Test that proves fix: authenticated buyer request to GET /orders/{id} — verify commission field absent in response body
```

---

## What Not to Do

- Do not assume the spec is up to date — verify against actual running code
- Do not test only the success response — 4xx responses are equally part of the contract
- Do not accept a response that exposes undocumented fields — evaluate what they contain
- Do not skip idempotency tests on payment callback endpoint — MTN retries in production
- Do not merge a breaking change without coordinating with all consumers

---

## RMF-Specific Rules

- Buyer must never see seller commission or net payout amounts in any API response
- Rider must not see buyer's full address before accepting a delivery
- The payment callback endpoint must be idempotent and must validate signatures
- All list endpoints must be paginated — no unbounded responses allowed in production
- All monetary values in API responses must be in RWF as integers (not floats) to avoid rounding errors
