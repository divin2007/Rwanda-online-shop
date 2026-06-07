# System Architecture

## Monorepo Layout
```
rmf-platform/
├── apps/                         # Microservices (NestJS) + Frontend (Next.js)
│   ├── frontend/                 # Next.js App Router — all 4 portals, port 3000
│   ├── user-service/             # Auth, JWT registry, profiles, wishlists — port 3001
│   ├── market-service/           # Markets directory, contracts, opening rules — port 3002
│   ├── product-service/          # Catalog, categories, variants, recs, videos — port 3003
│   ├── seller-service/           # Seller onboarding, QR codes, change requests — port 3004
│   ├── rider-service/            # Rider profiles, verification, location — port 3005
│   ├── order-service/            # Orders, quote negotiation, disputes — port 3006
│   ├── wallet-service/           # Escrow ledgers, payouts, MoMo hooks — port 3007
│   ├── delivery-service/         # Dispatch algorithm, tracking sockets, handovers — port 3008
│   ├── notification-service/     # SMS (Africa’s Talking), Email, push logs — port 3009
│   ├── review-service/           # Ratings/reviews for products, sellers, markets — port 3010
│   └── admin-service/            # Analytics, fraud, accounting, support tickets — port 3011
├── packages/                     # Shared internal libraries
│   ├── auth/                     # JWT strategy, Roles decorators, Guards, middleware
│   ├── database/                 # Shared MongoDB Mongoose schemas
│   ├── health-check/             # Unified diagnostic utilities
│   ├── location/                 # Coordinates, haversine math, rider lookup
│   ├── shared-types/             # Enums, DTOs, response mappings
│   └── shared-utils/             # Logger, string formats, error wrappers
```

## Service Communication Style
- **Intra-service:** Direct HTTP REST calls (Axios/NestJS HTTP module) with internal service secret headers.
- **Real-time:** Socket.IO for delivery tracking and rider location broadcasts.
- **Eventual consistency:** Some flows rely on polling and webhooks (PayPack payment callbacks).

## Port Map
| Service | Port |
|--------|------|
| frontend | 3000 |
| user-service | 3001 |
| market-service | 3002 |
| product-service | 3003 |
| seller-service | 3004 |
| rider-service | 3005 |
| order-service | 3006 |
| wallet-service | 3007 |
| delivery-service | 3008 |
| notification-service | 3009 |
| review-service | 3010 |
| admin-service | 3011 |

## Frontend Route Groups (Next.js App Router)
- **Public buyer routes:** `/`, `/markets`, `/market/[id]`, `/products`, `/product/[id]`, `/cart`, `/checkout`, `/videos`, `/contact`, `/privacy`, `/terms`
- **Auth / onboarding:** `/login`, `/register`
- **Buyer account:** `/dashboard`, `/orders`, `/wallet`, `/wishlist`, `/settings`, `/preferences`
- **Seller portal:** `(seller)/...` route group
- **Rider portal:** `(rider)/...` route group
- **Admin portal:** `(admin)/...` route group
- **API proxy:** `api/...` (BFF/internal routing)
