---
name: rmf-security-review
description: Security review checklist for RMF covering OWASP API Top 10, payment security, RBAC, file upload safety, secrets, privacy, and abuse prevention. Apply before any feature is approved for release.
---

# RMF Security Review Skill

## When to Use

Apply this skill when:

- Reviewing any backend API endpoint before approval
- Reviewing payment integration or webhook handling
- Reviewing file upload endpoints
- Reviewing auth, JWT, or RBAC changes
- Conducting a pre-release security gate
- Reviewing any feature that handles PII (phone numbers, addresses, payment details)
- Reviewing any integration with an external provider

## Agents That Should Use This Skill

- `rmf-worker-security` — primary user; apply on every assigned task
- `rmf-worker-integration` — apply when reviewing payment callback handlers and webhook endpoints
- `rmf-master-orchestrator` — reference during final security review (Step 10 of workflow)
- `rmf-qa-commander` — reference when assigning Security Penetration Test Agent tasks

---

## Critical Issues — Escalate Immediately

Report these to `rmf-master-orchestrator` immediately without waiting to finish the review:

- Payment callback accepted without signature verification
- Duplicate payment callback processed twice (double credit/debit)
- Payment amount accepted from client without server-side recalculation
- Any user can access another user's orders, payment records, or personal data
- Admin-only route reachable by buyer, seller, or rider
- API key, JWT secret, database URL, or credential found in source code or logs
- Rider or buyer location data accessible to unauthorized parties
- Order marked complete without verified payment

---

## Section 1: Authentication and Session Security

**JWT Handling**
- [ ] JWT secret is loaded from environment variable — never hardcoded
- [ ] Access token expiry: ≤ 2 hours
- [ ] Refresh token expiry: ≤ 30 days
- [ ] Refresh tokens are stored hashed in the database, not plaintext
- [ ] Refresh token is rotated on every use (old token invalidated)
- [ ] Logout endpoint invalidates the refresh token server-side
- [ ] Expired access token returns 401, not 200 with empty body
- [ ] No JWT payload contains sensitive data (password hash, full payment details)

**Login/Signup**
- [ ] Rate limiting on login endpoint (max 5 attempts per minute per IP)
- [ ] Account lockout after repeated failures (or CAPTCHA challenge)
- [ ] Password reset tokens expire within 1 hour
- [ ] Password reset tokens are single-use
- [ ] Signup does not reveal whether an email already exists (prevents enumeration)

---

## Section 2: Role-Based Access Control (RBAC)

**Route Guard Coverage**
- [ ] Every API endpoint has an explicit `@Roles()` guard — no implicit public routes
- [ ] Buyer cannot access: `/seller/*`, `/rider/*`, `/admin/*`
- [ ] Seller cannot access: `/buyer/*`, `/rider/*`, `/admin/*`
- [ ] Rider cannot access: `/buyer/*`, `/seller/*`, `/admin/*`
- [ ] Admin routes require both authentication AND admin role

**Object-Level Authorization (BOLA)**
- [ ] Buyer can only read their own orders — not orders by ID of other buyers
- [ ] Seller can only read their own products and orders — not other sellers'
- [ ] Rider can only see the delivery assigned to them — not other riders' deliveries
- [ ] Admin can access all records but through explicit admin-scoped endpoints

**Tests required:**
- Buyer JWT + `GET /orders/{other_buyer_order_id}` → must return 403
- Seller JWT + `GET /admin/analytics` → must return 403
- Rider JWT + `GET /orders/{unassigned_order_id}` → must return 403

---

## Section 3: Payment Security

**Server-Side Validation (Non-Negotiable)**
- [ ] Payment amount is recalculated server-side from order items + delivery fee — client value is ignored
- [ ] Commission is calculated server-side — never accepted from client
- [ ] Refund amount is validated against original payment amount before processing
- [ ] Payment status cannot be set to `success` via any API endpoint — only via verified callback

**Webhook Callback Security**
- [ ] MTN MoMo callback signature is verified against provider's documented method before processing
- [ ] Airtel Money webhook authorization header validated before processing
- [ ] Callback amount is compared to stored order total — mismatch → reject + log + alert
- [ ] Duplicate callback protection: check payment record status before updating (idempotency)
- [ ] Callback timestamps older than 5 minutes are rejected (replay attack prevention)
- [ ] Callback URL is registered with provider — not modifiable per-request

**Audit Trail**
- [ ] Every payment state change is logged: initiated → pending → success / failed / refunded
- [ ] Log includes: payment ID, order ID, user ID, amount, timestamp, source (API / callback)
- [ ] Audit logs are append-only — no delete or update path on audit entries

---

## Section 4: File Upload Security

**Input Validation**
- [ ] Allowed file types explicitly defined (product images: JPG, PNG, WebP only)
- [ ] MIME type validated by magic bytes, not file extension alone
- [ ] File size enforced server-side (product images: max 5 MB)
- [ ] Filenames sanitized or replaced with UUIDs before storage

**Storage Security**
- [ ] Files are stored in Google Cloud Storage, not on the application server
- [ ] Storage bucket is private by default — no public read access
- [ ] Files are served via signed URLs or CDN — not via direct public bucket URL
- [ ] Path traversal is impossible — no user-controlled paths reach the file system

**Attack scenarios to verify:**
- [ ] Double extension file (`shell.php.jpg`) is rejected
- [ ] SVG with embedded `<script>` is rejected or stripped
- [ ] File larger than the limit returns 413, not 500

---

## Section 5: Input Validation and Injection

- [ ] All API inputs pass through DTOs with explicit validation rules
- [ ] No raw `req.body` or `req.query` values reach service layer without validation
- [ ] Integer fields reject strings; enum fields reject unlisted values
- [ ] Negative quantities are rejected (cannot set stock to -10)
- [ ] Phone number fields accept only valid format (not executable code)
- [ ] No SQL/NoSQL injection: queries use parameterized inputs or ORM (never string concatenation)
- [ ] No SSRF: callback URLs, image URLs, and redirect URLs are validated against an allowlist

---

## Section 6: Secrets and Configuration

- [ ] No API keys, JWT secrets, database connection strings, or credentials in any committed file
- [ ] `.env` files are in `.gitignore`
- [ ] `.env.example` contains only placeholder values
- [ ] `git log` and `git blame` show no committed secrets in history
- [ ] Environment variables are injected at runtime (Render dashboard / Vercel dashboard)
- [ ] Production secrets are never in development `.env` files

---

## Section 7: Privacy and PII Handling

- [ ] Phone numbers excluded from list endpoint responses (only accessible to the user themselves or admin)
- [ ] Buyer address excluded from rider view beyond delivery address
- [ ] Seller bank/payout details never appear in any API response to buyers or riders
- [ ] Rider GPS history has a defined retention period (maximum 90 days recommended)
- [ ] PII is not written to application logs in any form
- [ ] Password fields never appear in any API response

**Rwanda Data Protection Law compliance:**
- [ ] Users can request deletion of their data (documented process exists)
- [ ] Data collection is limited to what is operationally necessary
- [ ] Third-party integrations (MTN MoMo, maps, SMS) are disclosed to users

---

## Section 8: Rate Limiting and Abuse Prevention

- [ ] Login endpoint: max 5 requests/minute per IP
- [ ] Payment initiation: max 3 requests/minute per user
- [ ] Product search: max 30 requests/minute per IP
- [ ] Seller product creation: max 20 products/hour per seller
- [ ] Order creation: max 10 orders/hour per buyer (prevent fraud flooding)
- [ ] All rate limiting returns 429 with `Retry-After` header

---

## Checklist Summary (Quick Reference)

| Category | Status |
|---|---|
| JWT config secure | [ ] |
| All endpoints have role guards | [ ] |
| BOLA tests pass | [ ] |
| Payment amounts server-side only | [ ] |
| Callback signature verified | [ ] |
| Duplicate callback protected | [ ] |
| File uploads MIME-validated | [ ] |
| No secrets in code | [ ] |
| PII excluded from logs | [ ] |
| Rate limiting on auth + payment | [ ] |

---

## Output Format

When reporting a security issue, use the Problem Reporting Rule format:

```
Problem title: [specific vulnerability]
Severity: critical / high / medium / low
Affected user: buyer / seller / rider / admin / system
Affected flow: [e.g., payment callback handling]
Evidence: [specific file:line or endpoint]
Expected: [what should happen]
Actual: [what currently happens]
Files involved: [list]
Suggested worker: rmf-worker-security / rmf-worker-backend / rmf-worker-integration
Security impact: [specific risk — e.g., "attacker can mark payment as success without paying"]
Acceptance criteria: [what must be true for this to pass]
Test that proves fix: [specific test case]
```

---

## What Not to Do

- Do not assume a guard exists — check the source code
- Do not trust that "the frontend validates it" — always verify server-side validation exists
- Do not skip payment callback verification testing — it is the highest-risk single point of failure
- Do not assume environment variables are set correctly — confirm in deployment config
- Do not approve a release with any CRITICAL issue unresolved

---

## RMF-Specific Rules

- Commission calculation is always server-side — no exceptions
- Payment amount from any client (frontend, mobile, postman) is always ignored and recalculated
- MTN MoMo and Airtel Money callbacks must both be verified — signature check is mandatory
- Rider location data is never exposed to buyers beyond delivery ETA
- Seller payout details are never visible to buyers
- Any exposed API key found in source code is an immediate CRITICAL escalation to `rmf-master-orchestrator`
