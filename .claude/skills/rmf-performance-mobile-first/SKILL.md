---
name: rmf-performance-mobile-first
description: Mobile-first performance guidelines for RMF covering Core Web Vitals targets, image optimization, Next.js bundle size, caching strategy, pagination, 3G performance, and performance testing workflow.
---

# RMF Performance — Mobile-First Skill

## When to Use

Apply this skill when:

- Reviewing or optimizing any RMF frontend page
- Implementing image handling for product listings
- Setting up caching for catalog or search data
- Reviewing API response size and pagination
- Running performance audits before release
- Investigating slow page loads or API timeouts reported by users

## Agents That Should Use This Skill

- `rmf-worker-performance` — primary user; apply on every performance task
- `rmf-worker-frontend` — apply when building new pages or components
- `rmf-qa-commander` — reference when assigning Performance and Load Test Agent

---

## Rwandan Market Context (Non-Negotiable)

These constraints shape every performance decision:

- **~40% of users are on 3G or slower** (1–3 Mbps)
- Kigali users: 4G mix available; regional markets: primarily 3G
- **Data costs are high** — users prefer lighter pages and resent slow loading
- **Devices: primarily mid-range Android** (2–3 GB RAM, 720p screens)
- Mid-range Android is slower at JavaScript execution than a developer's laptop
- **3G target is the primary target** — 4G is a bonus

Design for 3G first. Test on real 3G conditions. Every second counts.

---

## Performance Targets

These are RMF's required performance budgets. Measure with Lighthouse in mobile mode or Chrome DevTools 3G throttle.

| Page / Operation | LCP Target | Notes |
|---|---|---|
| Buyer product listing | < 2.5s on 3G | Hero image must use `priority` prop |
| Product detail page | < 2.0s on 3G | First image visible above fold |
| Checkout (address + payment) | < 1.5s on 3G | No images required in checkout |
| Order status / tracking | < 1.0s on 3G | Text-heavy, no large assets |
| Rider dashboard | < 1.5s on 3G | Map loads after initial paint |
| Seller dashboard (list view) | < 2.0s on 3G | Data tables lazy-load |
| Admin analytics | < 3.0s on 3G | Charts can lazy-load |

**Core Web Vitals targets (2025 standards):**
- LCP: < 2.5 seconds
- INP: < 200 milliseconds
- CLS: < 0.1 (no layout shift — always reserve image dimensions)

**Bundle size targets (gzipped JavaScript):**
- Page bundle: < 150 KB
- Shared/common bundle: < 80 KB
- Total initial JS: < 250 KB

---

## Section 1: Image Optimization

Images are the #1 performance problem in marketplace apps. Apply these rules on every image.

### Rules

1. **Always use `next/image`** — never plain `<img>` tags for product images
2. **Set `priority` on the first visible image** (hero, first product card in listing) — this prevents LCP regression
3. **Lazy load everything below the fold** — `next/image` does this by default; do not disable it
4. **Set explicit `width` and `height`** on every image — prevents layout shift (CLS)
5. **Define `sizes` attribute** for responsive images:
   ```
   sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
   ```
6. **Use WebP format** — Next.js Image Component converts automatically if configured
7. **Target compressed sizes:**
   - Product thumbnail (grid): 80–120 KB
   - Product hero image (detail page): 150–200 KB
   - Seller avatar: 20–40 KB
8. **Never serve original uncompressed images** from a camera (these can be 5–15 MB)
9. **Use blur placeholder** for above-fold images: `placeholder="blur"` improves perceived performance

### Common Mistake to Avoid

Lazy loading the largest above-fold image (hero) kills LCP. The `priority` prop tells Next.js to preload it. Missing `priority` on the first product image in a listing is a high-priority performance bug.

---

## Section 2: JavaScript Bundle Optimization

1. **Code split by route** — Next.js App Router does this automatically; do not import large libraries in shared layout files
2. **Defer non-critical JS** — analytics, chat widgets, map libraries — load after page is interactive
3. **Audit heavy dependencies** before adding:
   - Charts library (e.g., Recharts ~300 KB) — lazy load the dashboard page
   - Map library (e.g., Leaflet ~150 KB) — load only on rider/delivery tracking pages
4. **Remove unused dependencies** — run `npx next build --analyze` to identify bundle contributors
5. **Avoid importing entire libraries** — use named imports: `import { format } from 'date-fns'` not `import * as dateFns`

---

## Section 3: Caching Strategy

Different data types have different staleness tolerance. Apply the right cache TTL.

| Data Type | Cache TTL | Rationale |
|---|---|---|
| Product catalog (all products) | 1 hour | Changes infrequently; stale catalog is acceptable |
| Single product detail | 5 minutes | Price/stock may change; tolerable delay |
| Seller information | 24 hours | Changes very rarely |
| Category list / market list | 24 hours | Static reference data |
| Current product price | 5 minutes | Price changes are meaningful but infrequent |
| Order status | No cache | Real-time; stale state misleads user |
| Buyer cart | No cache | Real-time; stale cart causes checkout errors |
| Rider location | No cache | Real-time; must be live |
| Search results | 30 seconds | Tolerable brief delay; reduces DB load |

**Implementation note:** Use HTTP `Cache-Control` headers for public catalog data (CDN-caching). Use server-side Redis (or equivalent) for computed data (e.g., product availability, seller rating aggregates). Never cache authentication tokens or personal data.

---

## Section 4: Pagination

Every list endpoint that could return more than 20 items must be paginated.

**Required pagination on:**
- Product listing (buyer)
- Seller's product management list
- Order history (buyer and seller)
- Admin user list, order list, transaction list
- Rider delivery history

**Default pagination:**
- Default page size: 20 items
- Maximum page size: 50 items (enforce server-side)
- Cursor-based pagination preferred for real-time lists (delivery tracking, rider queue)
- Offset pagination acceptable for admin and analytics pages

**Anti-pattern:** `db.products.find({})` with no limit. This causes unbounded queries and will break under real data volumes.

---

## Section 5: API Response Size

- Exclude unused fields from list endpoint responses (e.g., full product description not needed in product card endpoint)
- Use separate endpoints or query parameters for full detail vs. summary
- Compress API responses with gzip (should be enabled by default in NestJS/Vercel/Render)
- Large admin analytics queries should run as background jobs and return a job ID, not block the HTTP request

---

## Section 6: Caching and Database Queries

- Add indexes on all fields used in WHERE, ORDER BY, and JOIN clauses (see `rmf-worker-database`)
- Avoid N+1 queries: use `include` / `populate` for related data in a single query
- For product search: evaluate full-text index vs. simple LIKE queries at scale
- Rider assignment query (nearest available rider): ensure geographic index exists on rider location field
- Commission aggregate queries: use pre-aggregated summaries rather than summing all orders on every dashboard load

---

## Performance Testing Workflow

**Before every merge (automated):**
1. Run `next build` — check bundle size output
2. Run Lighthouse in CI (headless Chrome) — fail if LCP > 2.5s in simulated mobile 3G

**Before every release (manual):**
1. Run Lighthouse on production or staging URL — capture LCP, INP, CLS scores
2. Use Chrome DevTools Network tab with "Slow 3G" throttle — visually inspect product listing and checkout load
3. Run bundle analyzer — identify any new large dependencies
4. Check image sizes in Network tab — flag any image > 200 KB on product listing

**Performance regression = high severity bug:**
- LCP regression of > 500ms on product listing or checkout is a high-priority issue
- Any page exceeding 2× its target is a high-priority issue

---

## Checklist (Quick Reference)

**For any new page:**
- [ ] First visible image uses `priority` prop
- [ ] All images have explicit `width`, `height`, and `sizes`
- [ ] No `<img>` tags — use `next/image` exclusively
- [ ] Heavy libraries (charts, maps) are lazy-loaded
- [ ] All list views are paginated (max 50 per page)
- [ ] API responses exclude unused fields for list views
- [ ] Caching applied per the TTL table above
- [ ] Page tested at Slow 3G in Chrome DevTools before ship

---

## Output Format

For each performance issue found:

```
Problem title: [e.g., "Product listing LCP 4.2s on 3G — hero image not prioritized"]
Severity: high
Affected user: buyer
Affected flow: product browse
Evidence: Lighthouse report — LCP 4.2s, mobile 3G
Expected: LCP < 2.5s on 3G
Actual: LCP 4.2s
Files involved: [app/products/page.tsx, components/ProductCard.tsx]
Suggested worker: rmf-worker-frontend / rmf-worker-performance
Impact: ~20% conversion loss per additional second of load time; frustration for 3G users
Acceptance criteria: LCP < 2.5s on Slow 3G in Lighthouse; hero image preloaded via priority prop
Test that proves fix: Lighthouse mobile test on product listing page — LCP < 2.5s
```

---

## What Not to Do

- Do not optimize without measuring first — identify the actual bottleneck
- Do not optimize code that has no demonstrated performance problem
- Do not lazy-load the first visible product image (common mistake that wrecks LCP)
- Do not add caching to order status or cart data — these must be real-time
- Do not serve original uncompressed camera images to buyers

---

## RMF-Specific Rules

- 3G is the primary test target — not 4G, not WiFi
- Product listing LCP must be < 2.5s on Slow 3G — this is non-negotiable for Rwandan market reach
- All monetary values in API responses must be integers (RWF cents or full RWF as integers) — no floats
- Rider location updates must have < 100ms API latency — real-time UX requirement
- Admin analytics dashboards may load up to 3s — but must show skeleton while loading, not blank screen
