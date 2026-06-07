---
name: rmf-marketplace-ui-ux
description: UX evaluation and UI guidance for RMF buyer, seller, and rider flows. Covers checkout clarity, trust signals, mobile-first layout, emotional friction detection, and design principles for Rwandan public market users.
---

# RMF Marketplace UI/UX Skill

## When to Use

Apply this skill when:

- Evaluating any buyer, seller, or rider flow for user experience quality
- Building or reviewing checkout screens, product browsing, or order tracking UI
- Reviewing seller dashboard, product creation, or payout screens
- Reviewing rider assignment, pickup instructions, or delivery confirmation screens
- Auditing a flow before release
- Designing new screens from scratch

## Agents That Should Use This Skill

- `rmf-ux-analyst` — primary user; apply when testing any flow
- `rmf-worker-frontend` — apply when building or reviewing UI components
- `rmf-master-orchestrator` — reference when reviewing UX-related worker reports

## Research Routing for UX Work

Before evaluating new flow types or when competitor comparison is needed, route through:

```
rmf-ux-analyst or rmf-worker-frontend
  → rmf-worker-research
  → rmf-research-intelligence
```

Request research on: competitor UX patterns, pain points from similar platforms, mobile-first benchmarks, or Rwandan market context. Do not copy competitor designs — extract patterns and pain points, then create original RMF recommendations.

---

## RMF Design Philosophy

RMF must feel **clean, trustworthy, modern, and simple**.

The target users are real Rwandan market participants — buyers who may be new to online ordering, sellers who may not be technical, and riders who need information fast while moving.

**Design direction:**
- Mostly white background
- Restrained color palette — maximum 3–4 colors across the entire UI
- Subtle borders or soft shadows on cards, not heavy outlines
- Clear visual hierarchy: most important action is always obvious
- Good spacing — elements should breathe, not crowd each other
- Simple, readable typography — no decorative fonts
- Clear buttons — one primary CTA per screen
- Mobile-first layout — all flows must work at 375px width

**Avoid:**
- Multiple competing accent colors on the same screen
- Strong color fusion (mixing many colors into gradients or overlays)
- Unnecessary linear gradients (use solid fills instead)
- Heavy shadows, excessive blur, or layered glassmorphism
- Decorative animations that add no information
- Hiding prices, fees, or commission deductions until after user commits
- Confusing navigation that traps users with no back path
- Jargon ("escrow," "commission deduction") — use plain language

---

## Buyer Flow Evaluation

### Step 1: First Impression and Trust

Check:
- Does the page communicate what RMF is within 3 seconds?
- Are verified seller badges visible on product cards?
- Is the platform's reliability signaled visually (ratings, review counts, return policy link)?
- Does the color scheme feel trustworthy (not playful or cluttered)?

Emotional target: **Confident** from first screen.

### Step 2: Product Discovery

Check:
- Is search prominent and fast to reach?
- Are category filters easy to apply on mobile?
- Do product cards show: image, name, price, seller name/badge, rating?
- Is stock status visible before clicking into a product?
- Are delivery estimates shown on the product card or early in product detail?

### Step 3: Checkout Clarity

The checkout flow is the highest-risk UX zone. Check each step:

**Cart review:**
- Are all items listed with name, quantity, and per-item price?
- Is the delivery fee shown before the user proceeds?
- Is the platform fee or commission shown? (If buyer-facing, it must be clear)
- Is the total price the final price — no surprise additions at the end?

**Delivery address:**
- Is address entry simple and mobile-friendly?
- Is there address autocomplete or a structured district/sector/cell selector?
- Is the delivery fee recalculated when address changes?

**Payment selection:**
- Are MTN MoMo and Airtel Money the first payment options shown?
- Are payment method icons visible and labeled in plain language?
- Is the "Submit Payment" button clearly the final action?

**Processing state:**
- After submitting payment, is there an explicit "Processing your payment..." state?
- Is the estimated wait time shown? (Mobile money typically 5–30 seconds)
- Can the user accidentally double-submit?

**Confirmation:**
- Is the order summary shown immediately after payment success?
- Is the expected delivery time shown?
- Is the seller contact accessible?

Emotional target at confirmation: **Satisfied** and **Confident order will arrive**.

### Step 4: Order Tracking

Check:
- Does the buyer see order status in plain language: "Seller is preparing" → "Rider assigned" → "On the way" → "Delivered"?
- Is the rider's first name and photo shown when assigned?
- Is real-time map tracking available during delivery?
- Is there a way to contact the rider or raise a concern?

---

## Seller Flow Evaluation

### Onboarding

Check:
- Does onboarding ask for minimum information first (email, phone)?
- Is sensitive document collection deferred until first product upload?
- Is there a visible progress indicator? ("Step 2 of 4")
- Are instructions simple enough for a non-technical market vendor?

Emotional target: **Confident** throughout; never **Blocked** or **Confused**.

### Product Creation

Check:
- Is image upload simple and mobile-friendly (camera roll or camera)?
- Is there a clear image size/format guide?
- Are required fields obvious vs optional fields?
- Is stock quantity input clear with a visible default?
- Is the product visible after creation in a logical place?

### Earnings and Payouts

Check:
- Does the seller see a clear breakdown: Orders total → Commission deducted → Seller receives?
- Is the payout schedule visible and in plain language?
- Can the seller see individual order contributions to earnings?
- Is there a payout request button and is its state (available / pending / paid) obvious?

Emotional target: **Confident** the platform is fair and transparent.

---

## Rider Flow Evaluation

Riders are moving, often on motorcycles. Every screen must be:
- Large text (minimum 16px body text)
- Large tap targets (minimum 44×44px for all interactive elements)
- Single clear action per screen
- No scrolling required for critical actions

### Order Assignment

Check:
- Is the pickup location shown immediately and clearly?
- Is the per-delivery payout shown before the rider accepts?
- Is the accept button large, thumb-friendly, and positioned for one-handed use?
- Can the rider reject without friction?

### Pickup and Delivery

Check:
- Is the seller's stall number or location described in plain terms?
- Is there an in-app contact option (call or message)?
- Is the delivery confirmation action simple (QR scan or tap "Delivered")?
- Is proof of delivery collected (photo, QR, or signature)?

### Earnings

Check:
- Can the rider see per-delivery earnings in a clear list?
- Is the total earnings for the day/week visible at a glance?
- Is payout status clear?

---

## Flow Scoring

After evaluating a flow, score it on these dimensions (1–10):

| Dimension | Score | Notes |
|---|---|---|
| Ease of Use | /10 | How easy for a first-time user? |
| Trust Level | /10 | Does the user feel safe and confident? |
| Speed | /10 | How fast can the user complete the task? |
| Clarity | /10 | Is everything labeled and explained? |
| Mobile Readiness | /10 | Does it work well on a 375px screen? |
| Emotional Comfort | /10 | Does the user feel good throughout? |

**Verdict:**
- 7–10 on all dimensions: PASS
- 4–6 on any dimension: PASS WITH FIXES
- 1–3 on any dimension: FAIL (do not release)

---

## Checklist (Quick Reference)

**Buyer checkout:**
- [ ] All fees visible before final confirmation
- [ ] Payment method selection clear (MoMo / Airtel prominent)
- [ ] Processing state shown after payment submit
- [ ] No accidental double-submit possible
- [ ] Order confirmation shown with delivery estimate

**Seller dashboard:**
- [ ] Earnings breakdown shows commission deduction clearly
- [ ] Payout status visible
- [ ] Product creation works on mobile

**Rider dashboard:**
- [ ] Payout shown before acceptance
- [ ] Pickup location described in plain terms
- [ ] Confirmation action is one tap

**All flows:**
- [ ] No hidden fees or surprise totals
- [ ] Plain language — no jargon
- [ ] Back navigation always available
- [ ] Error messages are human-readable
- [ ] Loading states shown for all async actions
- [ ] Empty states shown when no data exists
- [ ] Works at 375px width

---

## Output Format

When using this skill, produce findings in this format:

```
## UX Evaluation: [Flow Name]

### Flow Scores
| Dimension | Score | Notes |
...

### Issues Found
For each issue:
- Severity: critical / high / medium / low
- Screen/Step: [exact location]
- User Emotion Caused: [from emotional vocabulary]
- What happens: [description]
- Business impact: [lost trust / lost sale / churn / etc.]
- Suggested fix: [concrete and actionable]

### Verdict: PASS / PASS WITH FIXES / FAIL
```

---

## What Not to Do

- Do not praise a flow unless it is genuinely clear, fast, and trustworthy
- Do not copy competitor screens — extract patterns and create original RMF recommendations
- Do not evaluate only the happy path — test empty states, errors, and edge cases
- Do not ignore mobile — always test at 375px
- Do not suggest decorative design changes that do not serve users
- Do not hide prices, fees, or commission deductions in the design

---

## RMF-Specific Rules

- MTN MoMo and Airtel Money must always be the first payment options shown
- Commission deduction must be visible to sellers in their earnings view
- Delivery fee must be shown to buyers before they reach the payment screen
- Seller verification badge must appear on every product card
- Rider earnings per delivery must be shown before acceptance
- All flows must work on a mid-range Android phone (375px, 3G connectivity)
- Rwandan public market context: stall numbers may be part of pickup instructions — always accommodate this
