# RMF Stitch Rebuild Map

This file tracks the Stitch reference screens against the live RMF implementation. The Stitch files are visual references only; implementation stays inside the existing RMF routes, services, auth guards, socket flows, maps, order logic, catalog taxonomy, variants, and role-specific portals.

## Design Tokens Applied

- Fonts: Work Sans for UI, JetBrains Mono for labels, IDs, chips, technical metadata.
- Colors: RMF orange `#ff6b00`, deep orange `#a04100`, warm background `#fbf9f8`, border `#ebdcd0`, text `#1b1c1c`, logistics blue `#3b82f6`, error red `#ba1a1a`.
- Shape: disciplined 4px to 8px radius, flat cards, 1px warm borders, low shadows only for overlays.
- Interaction: orange active states, clear status chips, compact cards, dense tables, no decorative gradients as the main visual system.

## Route Mapping

| Stitch reference | RMF route/component | Functional requirements to preserve |
| --- | --- | --- |
| Buyer Home | `/`, `Layout`, `ProductCard`, `MarketCard`, `Footer` | Live markets, recommendations, map, sockets, location sorting, cart, auth-aware actions |
| Market Discovery | `/markets`, `MarketCard`, `ProductCard`, `RiderMap` | Product facets, category filters, distance sorting, promotions, active market API |
| Global Product Search | `/products`, `ProductCard` | Infinite loading, recommendations API, filters, wishlist, cart, negotiation |
| Market Storefront | `/market/[slug]` | Market service, products, reviews, videos, promotions, map resilience |
| Product Detail | `/market/[slug]/product/[productId]` | Variants, selected purchasable unit, cart, negotiation, seller details |
| Cart/Checkout | `/cart`, `/checkout` | Cart grouping, price snapshots, payment methods, address/map confirmation |
| Orders/Tracking | `/orders`, `/orders/[orderId]/tracking` | Buyer-only order access, negotiation, escrow, rider tracking, QR handover |
| Seller Portal | `/seller/*` | Seller-only guard, product CRUD, bulk upload, promotions, videos, analytics, QR, payouts |
| Rider Portal | `/rider/*` | Rider-only guard, live jobs, map, pickup proof, QR handover, payouts |
| Admin Portal | `/admin` tabs | Admin guard, approvals, accounting, live map, disputes, fraud, payouts, taxonomy |
| Utility states | `loading.tsx`, `error.tsx`, `not-found.tsx`, auth/settings pages | Clear role mismatch, offline, empty, loading, and error handling |

## Rebuild Order

1. Shared tokens, shell, footer, product cards, market cards.
2. Buyer discovery pages: home, markets, products, market storefront, product detail.
3. Transaction pages: cart, checkout, orders, tracking, escrow and negotiation panels.
4. Seller portal pages.
5. Rider portal pages.
6. Admin portal tabs.
7. System states and mobile/responsive refinements.
