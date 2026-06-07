# RMF Skills Layer — Research Notes

Created: 2026-06-06
Purpose: Documents the research conducted before creating the RMF Skills Layer. Summarizes sources checked, patterns adopted, patterns rejected, and design decisions made.

---

## Research Execution

Research was routed through `rmf-research-intelligence` following the RMF research routing path. Eight research areas were investigated before skill documents were created.

---

## Sources Checked

| Source | Topic | Date | Reliability |
|---|---|---|---|
| Claude Code official docs (code.claude.com) | Skills structure best practices | 2025 | High |
| Anthropic agent skills overview (platform.claude.com) | Skill document format | 2025 | High |
| Shopify Mobile UX Design Guide | Checkout UX, mobile-first patterns | 2025 | High |
| Pixelmatters/Jumia case study | African marketplace design | Documented | High |
| OptiMonk e-commerce UX trends | Checkout UX trends | 2025 | Medium-High |
| Medium — Prajapatisuketu (food delivery UX) | Rider app UX patterns | 2025 | Medium |
| DoorDash real-time logistics design (dev.to) | Delivery dispatch patterns | Current | Medium-High |
| Autviz delivery app UX guide | Rider workflow UX | Current | Medium |
| MTN MoMo Developer Portal (official) | MoMo API, idempotency, callbacks | 2025 | High |
| MTN MoMo Testing Documentation (official) | Sandbox test procedures | 2025 | High |
| CleverEngineer Substack — MoMo live guide | MoMo production integration | 2025 | Medium-High |
| OWASP API Security Top 10 (official) | API security checklist | 2023 (current version) | High |
| AccuKnox OWASP checklist | API security testing | 2026 | High |
| OWASP File Upload Cheat Sheet (official) | File upload security | Current | High |
| PortSwigger Web Security | File upload attacks | Current | High |
| Total Shift Left — API contract testing | Contract testing patterns | 2026 | Medium-High |
| Medium — consumer-driven contracts | Pact/CDCT patterns | Current | Medium |
| Zuplo — schema validation | OpenAPI contract testing | Current | High |
| SystemsArchitect — Core Web Vitals 2025 | LCP/INP/CLS targets | 2025 | Medium-High |
| DebugBear — Next.js image optimization | Image optimization techniques | 2025 | High |
| MakersDen — Core Web Vitals with Next.js | Next.js performance guide | 2025 | Medium-High |
| Strapi — next/image developer guide | Image component best practices | Current | High |
| Brandu Studio — minimalist UI | Design system principles | Current | High |
| Rigby.js — marketplace UX guide | Marketplace UX best practices | Current | High |
| FuturisticBug — minimalist design systems | Mobile design systems | 2026 | Medium |
| Medium Design Bootcamp — minimalism 2025 | When minimal works/fails | 2025 | Medium |
| iGihe.com — Jumia Food Rwanda news | Local competitor context | Regional | High |
| Market Data Forecast — Africa e-commerce | Rwanda market context | 2025-2026 | High |
| JourneyH — marketplace onboarding | Seller onboarding pain points | 2025 | Medium-High |

---

## Useful Patterns Found and Adopted

### Skills Structure
- Progressive disclosure model: metadata → instructions → resources (keeps context efficient)
- Skill composition: skills can reference related skills
- In-skill verification checkpoints for critical flows
- Single-purpose focus per skill document

**Adopted into:** All 8 skill documents follow progressive disclosure and single-purpose design.

### Checkout UX
- Clear step indicators (1 of 3, 2 of 3, 3 of 3) increase checkout completion
- Delivery fee must be visible before payment screen — late disclosure is #1 abandonment cause
- Single primary CTA per step — no competing actions during checkout
- Mobile money processing state must show wait time estimate (MoMo takes 5–30 seconds)
- Trust signals (seller verification, return policy) should appear during checkout, not after

**Adopted into:** `rmf-marketplace-ui-ux/SKILL.md`, `rmf-frontend-design-system/SKILL.md`

### Rider UX
- Per-delivery earnings must be shown before acceptance (trust requirement)
- Accept button must be large, thumb-friendly, positioned for one-handed use
- Stall number must be part of pickup instructions (physical market context)
- Location access scoped to `in_transit` state only (privacy)

**Adopted into:** `rmf-marketplace-ui-ux/SKILL.md`, `rmf-delivery-rider-testing/SKILL.md`

### Payment Testing
- MTN MoMo requires unique UUID v4 per request as X-Reference-Id
- Duplicate X-Reference-Id returns HTTP 409 — test this explicitly
- MTN retries callbacks — idempotency handler is mandatory
- Amount in callback must match stored order total server-side — never trust callback amount
- Replay attack window: reject callbacks with timestamp > 5 minutes old

**Adopted into:** `rmf-payment-testing/SKILL.md`, `rmf-security-review/SKILL.md`

### Security Review
- OWASP API Top 10 #1 (BOLA) and #5 (Broken Function Level Auth) are highest risk for RMF
- Payment amount must never come from client — always recalculate server-side
- File upload: MIME type must be validated by magic bytes, not file extension
- Double extension attack (`shell.php.jpg`) is a real risk on image upload endpoints

**Adopted into:** `rmf-security-review/SKILL.md`

### API Contract Testing
- OpenAPI spec as the source of truth for contract validation
- Breaking change detection: removing a required response field breaks consumers silently
- Payment callback endpoint must be explicitly idempotent in the contract
- All monetary values: integers (RWF), not floats — avoids rounding errors

**Adopted into:** `rmf-api-contract-testing/SKILL.md`

### Performance / Mobile-First
- Common Next.js mistake: lazy-loading the hero/first product image (kills LCP)
- Solution: use `priority` prop on first visible image in product listing
- WebP format via next/image reduces typical product image by 30–40%
- 3G target (Slow 3G ~400 Kbps) is the right baseline for Rwanda regional users
- LCP 2025 standard: < 2.5 seconds (stricter than 2022 < 4.0s standard)
- Caching: catalog = 1 hour; order status = no cache; prices = 5 minutes

**Adopted into:** `rmf-performance-mobile-first/SKILL.md`

### Minimal/Premium Design
- 3–5 colors maximum; single strong accent color
- White backgrounds with subtle gray borders on cards
- Gradients on UI elements make the design feel dated and low-trust
- Generous spacing (8px grid) signals premium quality
- Product price: large, bold, always visible without scrolling
- Seller verified badge: always present next to seller name

**Adopted into:** `rmf-frontend-design-system/SKILL.md`, `rmf-marketplace-ui-ux/SKILL.md`

---

## Patterns Rejected and Why

| Pattern | Source | Reason for Rejection |
|---|---|---|
| Glassmorphism UI (frosted glass effects) | Trending design blogs | Too heavy, performance-costly, not appropriate for a trustworthy marketplace |
| Gradient hero banners | Common on e-commerce sites | Rejected per user preference; adds noise without trust value |
| Heavy animation transitions | Mobile app design guides | Performance cost on 3G; distracting in a transactional context |
| Rounded-corner-heavy cards (radius 16px+) | Playful app design patterns | Makes RMF look playful rather than professional |
| Gamification badges everywhere | DoorDash/delivery apps | Appropriate for rider retention features, not for buyer checkout or seller dashboard |
| Pact consumer-driven contracts (full implementation) | Contract testing guides | Too heavy for current RMF stage; adopted lighter OpenAPI-first approach instead |
| Full DAST automation in CI | Security guides | Appropriate for quarterly run, not every PR; out of scope for this skills layer |
| Redis cache for all endpoints | Caching best practices | Premature for current scale; added to skills as a recommendation when load requires it |

---

## Design Preferences Captured

The user explicitly stated:
- Does not like too many colors mixed together
- Does not like strong color fusion
- Does not like unnecessary linear gradients
- Prefers clean, modern, minimal, premium marketplace style
- Prefers mostly white backgrounds
- Prefers subtle borders and clear hierarchy
- Prefers restrained accent colors

These preferences are encoded in:
- `rmf-frontend-design-system/SKILL.md` — color palette, shadow rules, gradient prohibition
- `rmf-marketplace-ui-ux/SKILL.md` — design philosophy section
- `.claude/AGENTS-RMF.md` — UI/UX Design Preference section

---

## Skills Created

| Skill | File | Primary Agent(s) |
|---|---|---|
| rmf-marketplace-ui-ux | `.claude/skills/rmf-marketplace-ui-ux/SKILL.md` | rmf-ux-analyst, rmf-worker-frontend |
| rmf-frontend-design-system | `.claude/skills/rmf-frontend-design-system/SKILL.md` | rmf-worker-frontend, rmf-ux-analyst |
| rmf-security-review | `.claude/skills/rmf-security-review/SKILL.md` | rmf-worker-security, rmf-worker-integration |
| rmf-payment-testing | `.claude/skills/rmf-payment-testing/SKILL.md` | rmf-worker-qa, rmf-qa-commander, rmf-worker-integration |
| rmf-delivery-rider-testing | `.claude/skills/rmf-delivery-rider-testing/SKILL.md` | rmf-worker-qa, rmf-qa-commander |
| rmf-api-contract-testing | `.claude/skills/rmf-api-contract-testing/SKILL.md` | rmf-worker-qa, rmf-qa-commander |
| rmf-performance-mobile-first | `.claude/skills/rmf-performance-mobile-first/SKILL.md` | rmf-worker-performance, rmf-worker-frontend |
| rmf-research-method | `.claude/skills/rmf-research-method/SKILL.md` | rmf-worker-research, rmf-research-intelligence |

---

## Skills Intentionally Not Created

| Skill (not created) | Reason |
|---|---|
| rmf-devops-deployment | DevOps tasks are specific enough that a skill adds little over the agent's own instructions; revisit when deployment complexity increases |
| rmf-database-schema | Schema decisions are too project-specific to generalize; the database worker's instructions are sufficient |
| rmf-accessibility | Accessibility is important but secondary for launch; recommend adding after v1 ships |
| rmf-i18n-kinyarwanda | Internationalization skill would be valuable but no i18n framework is confirmed in the codebase yet |

---

## Recommended Next Research Sessions

1. **Airtel Money API specifics** — research Airtel Money Rwanda Collection API callback format and signature method (currently less documented than MTN MoMo)
2. **Rwanda Data Protection Law compliance checklist** — create a specific checklist for RMF's data handling practices
3. **Progressive Web App (PWA) patterns** — Rwanda users would benefit from offline capability; research PWA feasibility for RMF
4. **Kinyarwanda localization patterns** — how other Rwanda apps handle Kinyarwanda/English toggle
